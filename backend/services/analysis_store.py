from __future__ import annotations

"""In-memory store for hackathon MVP. Swap for Firestore when GCP is enabled."""

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from models.schemas import LexGuardAnalysis

_analyses: dict[str, dict[str, Any]] = {}
_events: dict[str, list[dict[str, Any]]] = {}


def create_analysis(document_text: str = "") -> str:
    aid = str(uuid4())
    _analyses[aid] = {
        "analysis_id": aid,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "document_text": document_text,
    }
    _events[aid] = []
    return aid


def append_event(analysis_id: str, event: dict[str, Any]) -> None:
    if analysis_id in _events:
        _events[analysis_id].append(event)


def get_events(analysis_id: str) -> list[dict[str, Any]]:
    return list(_events.get(analysis_id, []))


def save_result(analysis_id: str, result: LexGuardAnalysis) -> None:
    _analyses[analysis_id] = result.model_dump()


def get_analysis(analysis_id: str) -> dict[str, Any] | None:
    return _analyses.get(analysis_id)


def update_status(analysis_id: str, status: str) -> None:
    if analysis_id in _analyses:
        _analyses[analysis_id]["status"] = status
