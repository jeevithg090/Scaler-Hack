"""LEXGUARD API — adversarial multi-agent contract analysis."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field
from twilio.twiml.voice_response import VoiceResponse

import config
from models.schemas import AnalyzeResponse, HealthResponse
from security import require_admin, require_custom_llm_key, sign_text, verify_text_signature
from services import (
    analysis_store,
    document_parser,
    elevenlabs_client,
    gemini_client,
    pipeline,
    twilio_client,
)
from services.negotiation_pack import briefing_script, build_negotiation_pack

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("lexguard")

APP_VERSION = "0.2.0"
AGENT_NAMES = [
    "orchestrator",
    "extractor",
    "risk_hunter",
    "devils_advocate",
    "synthesis",
    "comparator",
]
STREAM_POLL_SECONDS = 0.4
STREAM_MAX_SECONDS = 600
MAX_TTS_CHARS = 1000

app = FastAPI(title="LEXGUARD API", version=APP_VERSION)
APP_STARTED_AT = datetime.now(UTC)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


# ── Request models ────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=config.MAX_CHAT_MESSAGE_CHARS)


class OutboundCallRequest(BaseModel):
    to_number: str = Field(pattern=r"^\+[1-9]\d{6,14}$", description="E.164 phone number")
    analysis_id: str | None = None
    message: str | None = Field(default=None, max_length=MAX_TTS_CHARS)


class OpenAIMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    messages: list[OpenAIMessage]
    model: str
    temperature: float | None = 0.7
    max_tokens: int | None = None
    stream: bool | None = False
    elevenlabs_extra_body: dict[str, Any] | None = None


# ── Helpers ───────────────────────────────────────────────────────
def _require_complete_analysis(analysis_id: str) -> dict[str, Any]:
    data = analysis_store.get_analysis(analysis_id)
    if not data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if data.get("status") != "complete":
        raise HTTPException(status_code=409, detail="Analysis not yet complete")
    return data


def _find_clause(data: dict[str, Any], clause_id: str) -> dict[str, Any]:
    clause = next((c for c in data.get("clauses", []) if c.get("clause_id") == clause_id), None)
    if not clause:
        raise HTTPException(status_code=404, detail="Clause not found")
    return clause


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _run_background(analysis_id: str, document_text: str) -> None:
    try:
        await pipeline.run_analysis(analysis_id, document_text)
    except Exception as exc:
        logger.exception("Analysis %s failed", analysis_id)
        message = (
            str(exc) if isinstance(exc, gemini_client.GeminiError) else "Analysis pipeline failed"
        )
        analysis_store.update_status(analysis_id, "error")
        analysis_store.append_event(analysis_id, {"type": "error", "message": message})


# ── Health ────────────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    uptime_seconds = int((datetime.now(UTC) - APP_STARTED_AT).total_seconds())
    return HealthResponse(
        status="ok",
        version=APP_VERSION,
        model=config.GEMINI_MODEL,
        agents=AGENT_NAMES,
        uptime_seconds=uptime_seconds,
        queue_depth=analysis_store.queue_depth(),
        environment={
            "gemini_api_key": bool(config.GEMINI_API_KEY),
            "firestore": config.USE_FIRESTORE,
            "gcs_bucket_name": bool(config.GCS_BUCKET_NAME),
            "elevenlabs": elevenlabs_client.is_configured(),
            "twilio": twilio_client.is_configured(),
            "outbound_calls_enabled": bool(config.ADMIN_API_TOKEN),
            "custom_llm_enabled": bool(config.CUSTOM_LLM_API_KEY),
        },
    )


# ── Analysis ──────────────────────────────────────────────────────
@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    url: str | None = Form(None),
) -> AnalyzeResponse:
    file_bytes: bytes | None = None
    filename: str | None = None

    if file and file.filename:
        file_bytes = await file.read(config.MAX_UPLOAD_BYTES + 1)
        if len(file_bytes) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 10MB limit")
        filename = file.filename

    if url and url.strip():
        document_text = await document_parser.extract_text_from_url(url)
    else:
        document_text = document_parser.extract_text(filename, file_bytes, text)

    if len(document_text) < config.MIN_DOCUMENT_CHARS:
        raise HTTPException(
            status_code=400,
            detail="Document too short — paste at least ~50 characters",
        )

    analysis_id = analysis_store.create_analysis(document_text)
    background_tasks.add_task(_run_background, analysis_id, document_text)
    return AnalyzeResponse(analysis_id=analysis_id)


@app.get("/api/analyze/{analysis_id}")
async def get_analysis(analysis_id: str) -> dict[str, Any]:
    data = analysis_store.get_analysis(analysis_id)
    if not data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis_store.public_view(data)


@app.get("/api/analyze/{analysis_id}/stream")
async def stream_analysis(analysis_id: str) -> StreamingResponse:
    if not analysis_store.get_analysis(analysis_id):
        raise HTTPException(status_code=404, detail="Analysis not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        seen = 0
        deadline = time.monotonic() + STREAM_MAX_SECONDS
        while time.monotonic() < deadline:
            record = analysis_store.get_analysis(analysis_id) or {}
            events = record.get("events", [])
            for event in events[seen:]:
                seen += 1
                if event.get("type") == "complete":
                    yield _sse({"type": "complete", "data": analysis_store.public_view(record)})
                    return
                yield _sse(event)
                if event.get("type") == "error":
                    return

            status = record.get("status")
            if status == "complete" and "lexscore" in record:
                yield _sse({"type": "complete", "data": analysis_store.public_view(record)})
                return
            if status == "error" or not record:
                yield _sse({"type": "error", "message": "Analysis failed"})
                return
            await asyncio.sleep(STREAM_POLL_SECONDS)
        yield _sse({"type": "error", "message": "Analysis timed out"})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/analyze/{analysis_id}/chat")
async def chat(analysis_id: str, body: ChatRequest) -> dict[str, str]:
    from agents import chat as chat_agent

    data = _require_complete_analysis(analysis_id)
    clauses_summary = [
        {
            "clause_id": c.get("clause_id"),
            "clause_type": c.get("clause_type"),
            "verdict": c.get("verdict"),
            "severity": c.get("severity"),
            "plain_english": c.get("plain_english"),
            "negotiation_script": c.get("negotiation_script"),
        }
        for c in data.get("clauses", [])
    ]
    try:
        reply = await chat_agent.run(
            message=body.message,
            doc_type=data.get("doc_type", "other"),
            weaker_party=data.get("weaker_party", "unknown"),
            lexscore=data.get("lexscore", 0),
            clause_analysis=clauses_summary,
            critical_issues=data.get("summary", {}).get("critical_issues", []),
            missing_protections=data.get("missing_protections", []),
        )
    except gemini_client.GeminiError as exc:
        logger.warning("Chat failed for %s: %s", analysis_id, exc)
        raise HTTPException(status_code=502, detail="The language model is unavailable") from exc
    return {"reply": reply}


@app.get("/api/analyze/{analysis_id}/negotiation-pack", response_class=PlainTextResponse)
async def negotiation_pack(
    analysis_id: str, format: str = Query("md", pattern="^(md|txt)$")
) -> PlainTextResponse:
    data = _require_complete_analysis(analysis_id)
    return PlainTextResponse(
        build_negotiation_pack(data),
        headers={
            "Content-Disposition": (
                f'attachment; filename="lexguard-negotiation-pack-{analysis_id[:8]}.{format}"'
            )
        },
    )


# ── ElevenLabs voice features ─────────────────────────────────────
@app.post("/api/analyze/{analysis_id}/voice/briefing")
async def voice_briefing(analysis_id: str) -> Response:
    data = _require_complete_analysis(analysis_id)
    audio = await elevenlabs_client.generate_audio_briefing(briefing_script(data))
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/api/analyze/{analysis_id}/voice/debate/{clause_id}")
async def voice_debate(analysis_id: str, clause_id: str) -> Response:
    clause = _find_clause(_require_complete_analysis(analysis_id), clause_id)
    risk_text = clause.get("plain_english") or "This clause is risky."
    defense_text = clause.get("defense_argument") or "It's standard practice."
    audio = await elevenlabs_client.generate_agent_debate(risk_text, defense_text)
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/api/analyze/{analysis_id}/voice/negotiate/{clause_id}")
async def voice_negotiate(analysis_id: str, clause_id: str) -> Response:
    clause = _find_clause(_require_complete_analysis(analysis_id), clause_id)
    script = clause.get("negotiation_script") or "I cannot agree to this clause."
    audio = await elevenlabs_client.generate_negotiation_coach(script)
    return Response(content=audio, media_type="audio/mpeg")


# ── Twilio call flow ──────────────────────────────────────────────
FALLBACK_CALL_SCRIPT = (
    "Hello from LEXGUARD. Your contract analysis call is ready. "
    "Please open the app to review full details and suggested redlines."
)


def _resolve_call_script(analysis_id: str | None, message: str | None) -> str:
    if message and message.strip():
        return message.strip()[:MAX_TTS_CHARS]
    if analysis_id:
        data = analysis_store.get_analysis(analysis_id)
        if data and data.get("status") == "complete":
            return briefing_script(data)
    return FALLBACK_CALL_SCRIPT


@app.post("/api/twilio/call", dependencies=[Depends(require_admin)])
async def create_twilio_call(body: OutboundCallRequest) -> dict[str, Any]:
    if body.analysis_id and not analysis_store.get_analysis(body.analysis_id):
        raise HTTPException(status_code=404, detail="Analysis not found")
    call = await asyncio.to_thread(
        twilio_client.create_outbound_call,
        to_number=body.to_number,
        analysis_id=body.analysis_id,
        custom_message=body.message,
    )
    return {"ok": True, "call": call}


@app.api_route("/api/twilio/voice", methods=["GET", "POST"])
async def twilio_voice_webhook(
    analysis_id: str | None = None,
    message: str | None = None,
) -> Response:
    twiml = VoiceResponse()
    script = _resolve_call_script(analysis_id=analysis_id, message=message)

    if elevenlabs_client.is_configured() and config.PUBLIC_BASE_URL and config.TTS_SIGNING_SECRET:
        query = urlencode({"text": script, "sig": sign_text(script)})
        twiml.play(f"{config.PUBLIC_BASE_URL}/api/twilio/tts.mp3?{query}")
    else:
        # Native Twilio TTS when ElevenLabs or a public URL is not configured.
        twiml.say(script, voice="alice")

    twiml.hangup()
    return Response(content=str(twiml), media_type="application/xml")


@app.get("/api/twilio/tts.mp3")
async def twilio_tts_proxy(text: str, sig: str = "") -> Response:
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > MAX_TTS_CHARS:
        raise HTTPException(status_code=400, detail="text is too long")
    # Only URLs generated by the voice webhook are honoured, so this cannot be
    # used as an open text-to-speech proxy.
    if not verify_text_signature(text, sig):
        raise HTTPException(status_code=403, detail="Invalid signature")
    audio = await elevenlabs_client.generate_audio_briefing(text)
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/api/twilio/status")
async def twilio_status_callback(
    CallSid: str | None = Form(None),
    CallStatus: str | None = Form(None),
    CallDuration: str | None = Form(None),
) -> dict[str, Any]:
    logger.info("Twilio call %s status=%s duration=%s", CallSid, CallStatus, CallDuration)
    return {"ok": True}


# ── OpenAI-compatible custom LLM endpoint for ElevenLabs agents ───
@app.post("/v1/chat/completions", dependencies=[Depends(require_custom_llm_key)])
async def custom_llm_completion(request: ChatCompletionRequest) -> StreamingResponse:
    # ElevenLabs forwards dynamic variables in extra_body; the widget sets UUID=analysis_id.
    analysis_id = (request.elevenlabs_extra_body or {}).get("UUID")

    system_prompt = "You are LEXGUARD, an AI contract intelligence system."
    if analysis_id:
        data = analysis_store.get_analysis(str(analysis_id))
        if data and data.get("status") == "complete":
            critical = json.dumps(data.get("summary", {}).get("critical_issues", []))
            system_prompt += (
                f" You have analyzed their document. LEXSCORE: {data.get('lexscore', 0)}."
                f" Critical issues: {critical}. Keep answers short."
            )

    conversation = "\n".join(f"{m.role}: {m.content}" for m in request.messages[-20:])
    prompt = f"Conversation history:\n{conversation}\n\nRespond to the last message concisely."

    def chunk(content: str) -> dict[str, Any]:
        return {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": request.model,
            "choices": [{"delta": {"content": content}, "index": 0, "finish_reason": None}],
        }

    chunk_id = f"chatcmpl-{int(time.time())}"

    async def event_stream() -> AsyncGenerator[str, None]:
        # Initial filler keeps the voice agent's prosody natural while Gemini starts up.
        yield _sse(chunk("Let me check that for you... "))
        try:
            async for text_chunk in gemini_client.generate_stream(
                prompt, system=system_prompt, temperature=request.temperature or 0.5
            ):
                yield _sse(chunk(text_chunk))
        except Exception:
            logger.exception("Custom LLM stream failed")
            yield _sse({"error": "upstream model error"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
