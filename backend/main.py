from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator

from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from config import GEMINI_MODEL, MAX_UPLOAD_BYTES
from models.schemas import AnalyzeResponse, HealthResponse
from services import analysis_store, document_parser, pipeline

app = FastAPI(title="LEXGUARD API", version="0.1.0")

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
    return HealthResponse(status="ok", model=GEMINI_MODEL, agents=AGENT_NAMES)


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    background_tasks: BackgroundTasks,
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
):
    file_bytes: Optional[bytes] = None
    filename: Optional[str] = None

    if file and file.filename:
        file_bytes = await file.read()
        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 10MB limit")
        filename = file.filename

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


@app.post("/api/analyze/{analysis_id}/chat")
async def chat(analysis_id: str, body: ChatRequest):
    from agents import chat as chat_agent

    data = analysis_store.get_analysis(analysis_id)
    if not data:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if data.get("status") != "complete":
        raise HTTPException(status_code=400, detail="Analysis not yet complete")

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
