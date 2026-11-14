from __future__ import annotations

import pytest
from fastapi import HTTPException

import config
import security
from services import analysis_store


def test_memory_store_lifecycle():
    aid = analysis_store.create_analysis("text")
    assert analysis_store.get_analysis(aid)["status"] == "queued"
    analysis_store.append_event(aid, {"agent": "x"})
    analysis_store.update_status(aid, "running")
    assert analysis_store.get_events(aid) == [{"agent": "x"}]
    assert analysis_store.queue_depth() == {"queued": 0, "running": 1, "total": 1}
    public = analysis_store.public_view(analysis_store.get_analysis(aid))
    assert "document_text" not in public and "events" not in public


def test_memory_store_returns_copies_of_events():
    aid = analysis_store.create_analysis()
    analysis_store.get_analysis(aid)["events"].append({"tampered": True})
    assert analysis_store.get_events(aid) == []


def test_memory_store_evicts_oldest():
    store = analysis_store.MemoryStore(max_items=2)
    for i in range(3):
        store.create({"analysis_id": str(i)})
    assert store.get("0") is None and store.get("2") is not None


def test_unknown_ids_are_safe():
    analysis_store.append_event("missing", {"a": 1})
    analysis_store.update_status("missing", "error")
    assert analysis_store.get_analysis("missing") is None
    assert analysis_store.get_events("missing") == []


def test_signatures(monkeypatch):
    monkeypatch.setattr(config, "TTS_SIGNING_SECRET", "k1")
    sig = security.sign_text("hello")
    assert security.verify_text_signature("hello", sig)
    assert not security.verify_text_signature("hello!", sig)
    monkeypatch.setattr(config, "TTS_SIGNING_SECRET", "k2")
    assert not security.verify_text_signature("hello", sig)


def test_signing_without_secret(monkeypatch):
    monkeypatch.setattr(config, "TTS_SIGNING_SECRET", "")
    assert not security.verify_text_signature("x", "abc")
    with pytest.raises(HTTPException):
        security.sign_text("x")


@pytest.mark.parametrize(
    ("header", "ok"),
    [
        ("Bearer tok", True),
        ("bearer tok", True),
        ("Bearer nope", False),
        ("tok", False),
        (None, False),
    ],
)
def test_admin_bearer_parsing(monkeypatch, header, ok):
    monkeypatch.setattr(config, "ADMIN_API_TOKEN", "tok")
    if ok:
        security.require_admin(header)
    else:
        with pytest.raises(HTTPException) as exc:
            security.require_admin(header)
        assert exc.value.status_code == 401
