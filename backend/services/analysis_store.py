from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from models.schemas import LexGuardAnalysis

# Determine if we should use Firestore (if running in Cloud Run/GCP production)
USE_FIRESTORE = os.environ.get("ENVIRONMENT") == "production" or os.environ.get("GCP_PROJECT_ID") is not None

# Local fallback in-memory store
_analyses: dict[str, dict[str, Any]] = {}
_events: dict[str, list[dict[str, Any]]] = {}

db = None
FieldValue = None

if USE_FIRESTORE:
    try:
        from google.cloud import firestore
        db = firestore.Client()
        FieldValue = firestore.FieldValue
        print("✓ Persisting using Google Cloud Firestore Native mode.")
    except Exception as e:
        print(f"⚠ Failed to initialize Firestore, falling back to memory: {e}")
        USE_FIRESTORE = False


def create_analysis(document_text: str = "") -> str:
    aid = str(uuid4())
    data = {
        "analysis_id": aid,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "document_text": document_text,
        "events": [],
    }
    if USE_FIRESTORE and db:
        db.collection("analyses").document(aid).set(data)
    else:
        _analyses[aid] = data
        _events[aid] = []
    return aid


def append_event(analysis_id: str, event: dict[str, Any]) -> None:
    if USE_FIRESTORE and db and FieldValue:
        try:
            db.collection("analyses").document(analysis_id).update({
                "events": FieldValue.arrayUnion([event])
            })
        except Exception:
            # Fallback if document not yet created
            pass
    else:
        if analysis_id in _events:
            _events[analysis_id].append(event)


def get_events(analysis_id: str) -> list[dict[str, Any]]:
    if USE_FIRESTORE and db:
        try:
            doc = db.collection("analyses").document(analysis_id).get()
            if doc.exists:
                return doc.to_dict().get("events", [])
        except Exception:
            pass
        return []
    else:
        return list(_events.get(analysis_id, []))


def save_result(analysis_id: str, result: LexGuardAnalysis) -> None:
    data = result.model_dump()
    if USE_FIRESTORE and db:
        db.collection("analyses").document(analysis_id).set(data, merge=True)
    else:
        _analyses[analysis_id] = data


def get_analysis(analysis_id: str) -> dict[str, Any] | None:
    if USE_FIRESTORE and db:
        try:
            doc = db.collection("analyses").document(analysis_id).get()
            return doc.to_dict() if doc.exists else None
        except Exception:
            return None
    else:
        return _analyses.get(analysis_id)


def update_status(analysis_id: str, status: str) -> None:
    if USE_FIRESTORE and db:
        try:
            db.collection("analyses").document(analysis_id).update({"status": status})
        except Exception:
            pass
    else:
        if analysis_id in _analyses:
            _analyses[analysis_id]["status"] = status
