"""Analysis persistence.

Uses Google Cloud Firestore when running in production / with a GCP project
configured (so several Cloud Run instances share state), and an in-memory
store otherwise. The in-memory store is per-process, so run a single worker
when Firestore is disabled.
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from datetime import UTC, datetime
from typing import Any, Protocol
from uuid import uuid4

import config
from models.schemas import LexGuardAnalysis

logger = logging.getLogger(__name__)

# Fields kept for internal use that are not returned by the public API.
PRIVATE_FIELDS = ("document_text", "events")


class Store(Protocol):
    def create(self, data: dict[str, Any]) -> None: ...
    def get(self, analysis_id: str) -> dict[str, Any] | None: ...
    def merge(self, analysis_id: str, data: dict[str, Any]) -> None: ...
    def append_event(self, analysis_id: str, event: dict[str, Any]) -> None: ...
    def count_by_status(self, status: str) -> int: ...


class MemoryStore:
    """Thread-safe, size-bounded in-memory store (oldest analyses are evicted first)."""

    def __init__(self, max_items: int = 500) -> None:
        self._items: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._lock = threading.Lock()
        self._max_items = max_items

    def create(self, data: dict[str, Any]) -> None:
        with self._lock:
            self._items[data["analysis_id"]] = data
            while len(self._items) > self._max_items:
                self._items.popitem(last=False)

    def get(self, analysis_id: str) -> dict[str, Any] | None:
        with self._lock:
            item = self._items.get(analysis_id)
            if item is None:
                return None
            return {**item, "events": list(item.get("events", []))}

    def merge(self, analysis_id: str, data: dict[str, Any]) -> None:
        with self._lock:
            if analysis_id in self._items:
                self._items[analysis_id].update(data)

    def append_event(self, analysis_id: str, event: dict[str, Any]) -> None:
        with self._lock:
            if analysis_id in self._items:
                self._items[analysis_id].setdefault("events", []).append(event)

    def count_by_status(self, status: str) -> int:
        with self._lock:
            return sum(1 for item in self._items.values() if item.get("status") == status)

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


class FirestoreStore:
    def __init__(self, collection: str) -> None:
        from google.cloud import firestore

        self._firestore = firestore
        self._collection = firestore.Client().collection(collection)

    def create(self, data: dict[str, Any]) -> None:
        self._collection.document(data["analysis_id"]).set(data)

    def get(self, analysis_id: str) -> dict[str, Any] | None:
        doc = self._collection.document(analysis_id).get()
        return doc.to_dict() if doc.exists else None

    def merge(self, analysis_id: str, data: dict[str, Any]) -> None:
        self._collection.document(analysis_id).set(data, merge=True)

    def append_event(self, analysis_id: str, event: dict[str, Any]) -> None:
        self._collection.document(analysis_id).update(
            {"events": self._firestore.ArrayUnion([event])}
        )

    def count_by_status(self, status: str) -> int:
        query = self._collection.where(filter=self._firestore.FieldFilter("status", "==", status))
        return len(list(query.select([]).stream()))


def _build_store() -> Store:
    if config.USE_FIRESTORE:
        try:
            store = FirestoreStore(config.FIRESTORE_COLLECTION)
            logger.info(
                "Persisting analyses in Firestore collection %r", config.FIRESTORE_COLLECTION
            )
            return store
        except Exception:
            logger.exception("Failed to initialise Firestore; falling back to in-memory store")
    return MemoryStore()


_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = _build_store()
    return _store


def set_store(store: Store | None) -> None:
    """Override the backing store (used by tests)."""
    global _store
    _store = store


def create_analysis(document_text: str = "") -> str:
    analysis_id = str(uuid4())
    get_store().create(
        {
            "analysis_id": analysis_id,
            "status": "queued",
            "created_at": datetime.now(UTC).isoformat(),
            "document_text": document_text,
            "events": [],
        }
    )
    return analysis_id


def append_event(analysis_id: str, event: dict[str, Any]) -> None:
    try:
        get_store().append_event(analysis_id, event)
    except Exception:
        logger.exception("Failed to append event for analysis %s", analysis_id)


def get_events(analysis_id: str) -> list[dict[str, Any]]:
    try:
        record = get_store().get(analysis_id)
    except Exception:
        logger.exception("Failed to load events for analysis %s", analysis_id)
        return []
    return list((record or {}).get("events", []))


def get_analysis(analysis_id: str) -> dict[str, Any] | None:
    """Full internal record, including private fields."""
    try:
        return get_store().get(analysis_id)
    except Exception:
        logger.exception("Failed to load analysis %s", analysis_id)
        return None


def public_view(record: dict[str, Any]) -> dict[str, Any]:
    """Record without internal-only fields, safe to return to clients."""
    return {k: v for k, v in record.items() if k not in PRIVATE_FIELDS}


def save_result(analysis_id: str, result: LexGuardAnalysis) -> None:
    get_store().merge(analysis_id, result.model_dump())


def update_status(analysis_id: str, status: str) -> None:
    try:
        get_store().merge(analysis_id, {"status": status})
    except Exception:
        logger.exception("Failed to update status for analysis %s", analysis_id)


def queue_depth() -> dict[str, int]:
    try:
        store = get_store()
        queued = store.count_by_status("queued")
        running = store.count_by_status("running")
    except Exception:
        logger.exception("Failed to compute queue depth")
        queued = running = 0
    return {"queued": queued, "running": running, "total": queued + running}
