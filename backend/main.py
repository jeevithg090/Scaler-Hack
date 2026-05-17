from __future__ import annotations

import asyncio
import json
import os
import time
from datetime import datetime, timezone
from urllib.parse import urlencode
from typing import Optional
from typing import AsyncGenerator

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel
from twilio.twiml.voice_response import VoiceResponse

from config import GEMINI_MODEL, MAX_UPLOAD_BYTES, PUBLIC_BASE_URL
from models.schemas import AnalyzeResponse, HealthResponse
from services import analysis_store, document_parser, pipeline, twilio_client

app = FastAPI(title="LEXGUARD API", version="0.1.0")
APP_STARTED_AT = datetime.now(timezone.utc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AGENT_NAMES = [
    "orchestrator",
    "extractor",
    "risk_hunter",
    "devils_advocate",
    "synthesis",
    "comparator",
]


@app.get("/api/health", response_model=HealthResponse)
async def health():
    now = datetime.now(timezone.utc)
    uptime_seconds = int((now - APP_STARTED_AT).total_seconds())
    return HealthResponse(
        status="ok",
        model=GEMINI_MODEL,
        agents=AGENT_NAMES,
        uptime_seconds=uptime_seconds,
        queue_depth=analysis_store.queue_depth(),
        environment={
            "gcp_project_id": bool(os.environ.get("GCP_PROJECT_ID")),
            "gcs_bucket_name": bool(os.environ.get("GCS_BUCKET_NAME")),
            "google_application_credentials": bool(
                os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            ),
            "elevenlabs_api_key": bool(os.environ.get("ELEVENLABS_API_KEY")),
            "twilio_account_sid": bool(os.environ.get("TWILIO_ACCOUNT_SID")),
            "twilio_auth_token": bool(os.environ.get("TWILIO_AUTH_TOKEN")),
            "twilio_from_number": bool(os.environ.get("TWILIO_FROM_NUMBER")),
            "public_base_url": bool(os.environ.get("PUBLIC_BASE_URL")),
        },
    )


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
):
    file_bytes: Optional[bytes] = None
    filename: Optional[str] = None

    if file and file.filename:
        file_bytes = await file.read()
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 10MB limit")
        filename = file.filename

    if url and url.strip():
        document_text = await document_parser.extract_text_from_url(url)
    else:
        document_text = document_parser.extract_text(filename, file_bytes, text)
    if len(document_text) < 50:
        raise HTTPException(
            status_code=400,
            detail="Document too short — paste at least ~50 characters",
        )

    analysis_id = analysis_store.create_analysis(document_text)

    background_tasks.add_task(_run_background, analysis_id, document_text)
    return AnalyzeResponse(analysis_id=analysis_id)


async def _run_background(analysis_id: str, document_text: str) -> None:
    try:
        await pipeline.run_analysis(analysis_id, document_text)
    except Exception as e:
        analysis_store.update_status(analysis_id, "error")
        analysis_store.append_event(
            analysis_id, {"type": "error", "message": str(e)}
        )


@app.get("/api/analyze/{analysis_id}")
async def get_analysis(analysis_id: str):
    data = analysis_store.get_analysis(analysis_id)
    if not data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return data


@app.get("/api/analyze/{analysis_id}/stream")
async def stream_analysis(analysis_id: str):
    if not analysis_store.get_analysis(analysis_id):
        raise HTTPException(status_code=404, detail="Analysis not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        seen = 0
        while True:
            events = analysis_store.get_events(analysis_id)
            while seen < len(events):
                yield f"data: {json.dumps(events[seen])}\n\n"
                seen += 1
                if events[seen - 1].get("type") == "complete":
                    return
                if events[seen - 1].get("type") == "error":
                    return

            record = analysis_store.get_analysis(analysis_id) or {}
            if record.get("status") in ("complete", "error"):
                if seen >= len(events):
                    if record.get("status") == "complete" and "lexscore" in record:
                        yield f"data: {json.dumps({'type': 'complete', 'data': record})}\n\n"
                    break
            await asyncio.sleep(0.4)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Follow-up chat ────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str


class OutboundCallRequest(BaseModel):
    to_number: str
    analysis_id: Optional[str] = None
    message: Optional[str] = None


def _require_complete_analysis(analysis_id: str) -> dict:
    data = analysis_store.get_analysis(analysis_id)
    if not data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if data.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Analysis not yet complete")
    return data


@app.post("/api/analyze/{analysis_id}/chat")
async def chat(analysis_id: str, body: ChatRequest):
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

    reply = await chat_agent.run(
        message=body.message,
        doc_type=data.get("doc_type", "other"),
        weaker_party=data.get("weaker_party", "unknown"),
        lexscore=data.get("lexscore", 0),
        clause_analysis=clauses_summary,
        critical_issues=data.get("summary", {}).get("critical_issues", []),
        missing_protections=data.get("missing_protections", []),
    )

    return {"reply": reply}


# ── Negotiation export pack ───────────────────────────────────────
def _build_negotiation_pack(data: dict) -> str:
    clauses = data.get("clauses", [])
    risky = [c for c in clauses if c.get("verdict") in {"RED", "AMBER"}]
    risky = sorted(risky, key=lambda c: (0 if c.get("verdict") == "RED" else 1, c.get("clause_id", "")))
    top_risky = risky[:5]

    lines: list[str] = []
    lines.append("# LEXGUARD Negotiation Pack")
    lines.append("")
    lines.append(f"- Analysis ID: {data.get('analysis_id')}")
    lines.append(f"- LEXSCORE: {data.get('lexscore')} ({str(data.get('lexscore_label', '')).replace('_', ' ')})")
    lines.append(f"- Document Type: {str(data.get('doc_type', 'other')).replace('_', ' ')}")
    lines.append(f"- Weaker Party: {data.get('weaker_party', 'unknown')}")
    lines.append("")
    lines.append("## Top Risky Clauses")
    lines.append("")
    if not top_risky:
        lines.append("No RED/AMBER clauses detected.")
    for idx, clause in enumerate(top_risky, start=1):
        lines.append(f"### {idx}. {clause.get('clause_id')} — {clause.get('clause_type', '').replace('_', ' ')}")
        lines.append(f"- Verdict: {clause.get('verdict')} | Severity: {clause.get('severity')}")
        lines.append(f"- Plain English: {clause.get('plain_english', '')}")
        lines.append(f"- Worst Case: {clause.get('worst_case', '')}")
        lines.append(f"- Ask For: {clause.get('negotiation_script', '')}")
        lines.append("")

    lines.append("## Ready-to-send Negotiation Email")
    lines.append("")
    lines.append("Subject: Request to revise a few contract terms")
    lines.append("")
    lines.append("Hi [Name],")
    lines.append("")
    lines.append(
        "Thank you for sharing the agreement. I reviewed the terms and I am aligned on the overall intent. "
        "Before signing, I would like to request a few clause-level edits to make the terms balanced for both sides:"
    )
    lines.append("")
    for clause in top_risky:
        ask = clause.get("negotiation_script", "")
        lines.append(f"- {clause.get('clause_id')}: {ask}")
    lines.append("")
    lines.append("I can sign immediately after these updates are reflected in the next draft.")
    lines.append("")
    lines.append("Best regards,")
    lines.append("[Your Name]")
    lines.append("")
    lines.append("## Clause-by-clause Redlines")
    lines.append("")
    for clause in top_risky:
        lines.append(f"### {clause.get('clause_id')}")
        lines.append("Current:")
        lines.append(clause.get("original_text", ""))
        lines.append("")
        lines.append("Proposed:")
        lines.append(clause.get("suggested_redline", ""))
        lines.append("")

    return "\n".join(lines).strip() + "\n"


@app.get("/api/analyze/{analysis_id}/negotiation-pack", response_class=PlainTextResponse)
async def negotiation_pack(analysis_id: str, format: str = "md"):
    data = _require_complete_analysis(analysis_id)
    body = _build_negotiation_pack(data)
    ext = "txt" if format.lower() == "txt" else "md"
    return PlainTextResponse(
        body,
        headers={
            "Content-Disposition": (
                f'attachment; filename="lexguard-negotiation-pack-{analysis_id[:8]}.{ext}"'
            )
        },
    )


# ── ElevenLabs Voice Features ─────────────────────────────────────
from services import elevenlabs_client


def _analysis_briefing_script(data: dict) -> str:
    lexscore = data.get("lexscore", 0)
    critical_issues = data.get("summary", {}).get("critical_issues", [])
    top_issue = critical_issues[0] if critical_issues else "no major issues"
    return (
        f"Here is your contract briefing. The LEXSCORE is {lexscore} out of 100. "
        f"The most critical issue is {top_issue}. Please review the red clauses carefully."
    )

@app.post("/api/analyze/{analysis_id}/voice/briefing")
async def voice_briefing(analysis_id: str):
    data = _require_complete_analysis(analysis_id)

    script = _analysis_briefing_script(data)

    audio = await elevenlabs_client.generate_audio_briefing(script)
    return Response(content=audio, media_type="audio/mpeg")

@app.post("/api/analyze/{analysis_id}/voice/debate/{clause_id}")
async def voice_debate(analysis_id: str, clause_id: str):
    data = _require_complete_analysis(analysis_id)
        
    clause = next((c for c in data.get("clauses", []) if c.get("clause_id") == clause_id), None)
    if not clause:
        raise HTTPException(status_code=404, detail="Clause not found")
        
    # We create a fake debate from the plain english / negotiation script if we don't have separate agent logs stored.
    # We can ask Gemini to synthesize a debate quickly or just use the data we have.
    # To keep latency low, we just use the clause data.
    rh_text = clause.get("plain_english", "This clause is risky.")
    da_text = "It's standard practice. " + clause.get("negotiation_script", "We can just ask them to remove it.")
    
    audio = await elevenlabs_client.generate_agent_debate(rh_text, da_text)
    return Response(content=audio, media_type="audio/mpeg")

@app.post("/api/analyze/{analysis_id}/voice/negotiate/{clause_id}")
async def voice_negotiate(analysis_id: str, clause_id: str):
    data = _require_complete_analysis(analysis_id)
        
    clause = next((c for c in data.get("clauses", []) if c.get("clause_id") == clause_id), None)
    if not clause:
        raise HTTPException(status_code=404, detail="Clause not found")
        
    script = clause.get("negotiation_script", "I cannot agree to this clause.")
    audio = await elevenlabs_client.generate_negotiation_coach(script)
    return Response(content=audio, media_type="audio/mpeg")


# ── Twilio + ElevenLabs Call Flow ─────────────────────────────────
def _fallback_call_script() -> str:
    return (
        "Hello from LEXGUARD. Your contract analysis call is ready. "
        "Please open the app to review full details and suggested redlines."
    )


def _resolve_call_script(analysis_id: Optional[str], message: Optional[str]) -> str:
    if message and message.strip():
        return message.strip()
    if analysis_id:
        data = analysis_store.get_analysis(analysis_id)
        if data and data.get("status") == "complete":
            return _analysis_briefing_script(data)
    return _fallback_call_script()


@app.post("/api/twilio/call")
async def create_twilio_call(body: OutboundCallRequest):
    if body.analysis_id:
        data = analysis_store.get_analysis(body.analysis_id)
        if not data:
            raise HTTPException(status_code=404, detail="Analysis not found")

    call = twilio_client.create_outbound_call(
        to_number=body.to_number,
        analysis_id=body.analysis_id,
        custom_message=body.message,
    )
    return {"ok": True, "call": call}


@app.api_route("/api/twilio/voice", methods=["GET", "POST"])
async def twilio_voice_webhook(
    analysis_id: Optional[str] = None,
    message: Optional[str] = None,
):
    twiml = VoiceResponse()
    script = _resolve_call_script(analysis_id=analysis_id, message=message)
    base_url = PUBLIC_BASE_URL.rstrip("/")
    has_elevenlabs = bool(os.environ.get("ELEVENLABS_API_KEY"))

    if has_elevenlabs and base_url:
        play_url = f"{base_url}/api/twilio/tts.mp3?{urlencode({'text': script})}"
        twiml.play(play_url)
    else:
        # Fallback to native Twilio TTS if ElevenLabs or public URL is not configured.
        twiml.say(script, voice="alice")

    twiml.hangup()
    return Response(content=str(twiml), media_type="application/xml")


@app.get("/api/twilio/tts.mp3")
async def twilio_tts_proxy(text: str):
    if not text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if len(text) > 1000:
        raise HTTPException(status_code=400, detail="text is too long")

    audio = await elevenlabs_client.generate_audio_briefing(text.strip())
    return Response(content=audio, media_type="audio/mpeg")


@app.post("/api/twilio/status")
async def twilio_status_callback(
    CallSid: Optional[str] = Form(None),
    CallStatus: Optional[str] = Form(None),
    To: Optional[str] = Form(None),
    From: Optional[str] = Form(None),
    CallDuration: Optional[str] = Form(None),
):
    return {
        "ok": True,
        "call_sid": CallSid,
        "call_status": CallStatus,
        "to": To,
        "from": From,
        "duration_seconds": CallDuration,
    }

# ── Custom LLM Endpoint for ElevenAgents ─────────────────────────
class OpenAIMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    messages: list[OpenAIMessage]
    model: str
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: Optional[bool] = False
    elevenlabs_extra_body: Optional[dict] = None

@app.post("/v1/chat/completions")
async def custom_llm_completion(request: ChatCompletionRequest):
    # ElevenLabs passes custom variables in extra_body. We expect UUID (analysis_id)
    extra = request.elevenlabs_extra_body or {}
    analysis_id = extra.get("UUID")
    
    system_prompt = "You are LEXGUARD, an AI contract intelligence system."
    if analysis_id:
        data = analysis_store.get_analysis(analysis_id)
        if data and data.get("status") == "complete":
            lexscore = data.get("lexscore", 0)
            critical = json.dumps(data.get("summary", {}).get("critical_issues", []))
            system_prompt += f" You have analyzed their document. LEXSCORE: {lexscore}. Critical issues: {critical}. Keep answers short."
    
    # We extract the last user message, or we can format the whole conversation for Gemini
    conversation = "\n".join([f"{m.role}: {m.content}" for m in request.messages])
    prompt = f"Conversation history:\n{conversation}\n\nRespond to the last message concisely."
    
    from services.gemini_client import generate_stream
    stream = generate_stream(prompt, system=system_prompt, temperature=request.temperature or 0.5)
    
    async def event_stream():
        chunk_id = f"chatcmpl-{int(time.time())}"
        try:
            # Yield an initial buffer chunk for ElevenLabs to maintain prosody if there's a delay
            initial_chunk = {
                "id": chunk_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": request.model,
                "choices": [{"delta": {"content": "Let me check that for you... "}, "index": 0, "finish_reason": None}]
            }
            yield f"data: {json.dumps(initial_chunk)}\n\n"
            
            async for text_chunk in stream:
                oai_chunk = {
                    "id": chunk_id,
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": request.model,
                    "choices": [{"delta": {"content": text_chunk}, "index": 0, "finish_reason": None}]
                }
                yield f"data: {json.dumps(oai_chunk)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
