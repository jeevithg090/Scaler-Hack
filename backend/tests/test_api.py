from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

import config
import main
from security import sign_text
from services import analysis_store, pipeline

CONTRACT = "The Employee agrees that the Employer may terminate this agreement at any time. " * 2


@pytest.fixture
def client(fake_agents):
    return TestClient(main.app)


def _complete_analysis(client) -> str:
    resp = client.post("/api/analyze", data={"text": CONTRACT})
    assert resp.status_code == 200
    return resp.json()["analysis_id"]


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert "risk_hunter" in body["agents"]
    assert body["environment"]["firestore"] is False
    assert all(isinstance(v, bool) for v in body["environment"].values())


def test_cors_allows_configured_origin_only(client):
    ok = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options(
        "/api/health",
        headers={"Origin": "https://evil.test", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_analyze_rejects_short_documents(client):
    resp = client.post("/api/analyze", data={"text": "too short"})
    assert resp.status_code == 400


def test_analyze_rejects_missing_input(client):
    assert client.post("/api/analyze", data={}).status_code == 400


def test_analyze_rejects_oversized_upload(client, monkeypatch):
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 10)
    resp = client.post("/api/analyze", files={"file": ("c.txt", b"x" * 100, "text/plain")})
    assert resp.status_code == 413


def test_full_analysis_flow(client):
    analysis_id = _complete_analysis(client)

    data = client.get(f"/api/analyze/{analysis_id}").json()
    assert data["status"] == "complete"
    assert data["lexscore"] == 62
    assert "document_text" not in data and "events" not in data

    with client.stream("GET", f"/api/analyze/{analysis_id}/stream") as resp:
        events = [
            json.loads(line[len("data: ") :])
            for line in resp.iter_lines()
            if line.startswith("data: ")
        ]
    assert events[0] == {"agent": "orchestrator", "status": "running"}
    assert events[-1]["type"] == "complete"
    assert events[-1]["data"]["analysis_id"] == analysis_id

    pack = client.get(f"/api/analyze/{analysis_id}/negotiation-pack?format=txt")
    assert pack.status_code == 200
    assert pack.headers["content-disposition"].endswith('.txt"')
    assert "Ask for 30 days notice." in pack.text


def test_unknown_analysis_is_404(client):
    assert client.get("/api/analyze/nope").status_code == 404
    assert client.get("/api/analyze/nope/stream").status_code == 404


def test_pipeline_failure_is_reported(client, monkeypatch):
    async def boom(*_):
        raise RuntimeError("internal detail")

    monkeypatch.setattr(pipeline.orchestrator, "run", boom)
    analysis_id = _complete_analysis(client)
    record = analysis_store.get_analysis(analysis_id)
    assert record["status"] == "error"
    assert record["events"][-1] == {"type": "error", "message": "Analysis pipeline failed"}


def test_chat_requires_complete_analysis(client):
    analysis_id = analysis_store.create_analysis("doc")
    resp = client.post(f"/api/analyze/{analysis_id}/chat", json={"message": "hi"})
    assert resp.status_code == 409


def test_chat_validates_message(client):
    analysis_id = _complete_analysis(client)
    assert client.post(f"/api/analyze/{analysis_id}/chat", json={"message": ""}).status_code == 422


def test_chat_replies(client, monkeypatch):
    from agents import chat

    captured = {}

    async def fake_chat(**kwargs):
        captured.update(kwargs)
        return "Push back on C001."

    monkeypatch.setattr(chat, "run", fake_chat)
    analysis_id = _complete_analysis(client)
    resp = client.post(f"/api/analyze/{analysis_id}/chat", json={"message": "What now?"})
    assert resp.json() == {"reply": "Push back on C001."}
    assert captured["lexscore"] == 62


def test_negotiation_pack_rejects_unknown_format(client):
    analysis_id = _complete_analysis(client)
    resp = client.get(f"/api/analyze/{analysis_id}/negotiation-pack?format=exe")
    assert resp.status_code == 422


def test_voice_endpoints_report_unconfigured(client, monkeypatch):
    monkeypatch.setattr(config, "ELEVENLABS_API_KEY", "")
    analysis_id = _complete_analysis(client)
    assert client.post(f"/api/analyze/{analysis_id}/voice/briefing").status_code == 503
    assert client.post(f"/api/analyze/{analysis_id}/voice/debate/C999").status_code == 404


def test_outbound_call_disabled_without_admin_token(client, monkeypatch):
    monkeypatch.setattr(config, "ADMIN_API_TOKEN", "")
    resp = client.post("/api/twilio/call", json={"to_number": "+15555550100"})
    assert resp.status_code == 503


def test_outbound_call_requires_valid_token(client, monkeypatch):
    monkeypatch.setattr(config, "ADMIN_API_TOKEN", "s3cret")
    body = {"to_number": "+15555550100"}
    assert client.post("/api/twilio/call", json=body).status_code == 401
    wrong = {"Authorization": "Bearer nope"}
    assert client.post("/api/twilio/call", json=body, headers=wrong).status_code == 401
    good = {"Authorization": "Bearer s3cret"}
    bad_number = client.post("/api/twilio/call", json={"to_number": "123"}, headers=good)
    assert bad_number.status_code == 422


def test_voice_webhook_falls_back_to_twilio_tts(client, monkeypatch):
    monkeypatch.setattr(config, "ELEVENLABS_API_KEY", "")
    resp = client.post("/api/twilio/voice?message=Hello+there")
    assert resp.status_code == 200
    assert "<Say" in resp.text and "Hello there" in resp.text


def test_voice_webhook_uses_signed_tts_url(client, monkeypatch):
    monkeypatch.setattr(config, "ELEVENLABS_API_KEY", "k")
    monkeypatch.setattr(config, "PUBLIC_BASE_URL", "https://api.example.com")
    monkeypatch.setattr(config, "TTS_SIGNING_SECRET", "secret")
    resp = client.get("/api/twilio/voice?message=Hi")
    assert "<Play>https://api.example.com/api/twilio/tts.mp3?text=Hi&amp;sig=" in resp.text


def test_tts_proxy_rejects_unsigned_text(client, monkeypatch):
    monkeypatch.setattr(config, "TTS_SIGNING_SECRET", "secret")
    assert client.get("/api/twilio/tts.mp3?text=free+audio").status_code == 403
    assert client.get("/api/twilio/tts.mp3?text=x&sig=deadbeef").status_code == 403


def test_tts_proxy_accepts_signed_text(client, monkeypatch):
    from services import elevenlabs_client

    async def fake_audio(text):
        return b"ID3" + text.encode()

    monkeypatch.setattr(config, "TTS_SIGNING_SECRET", "secret")
    monkeypatch.setattr(elevenlabs_client, "generate_audio_briefing", fake_audio)
    resp = client.get("/api/twilio/tts.mp3", params={"text": "Hi", "sig": sign_text("Hi")})
    assert resp.status_code == 200
    assert resp.content == b"ID3Hi"


def test_custom_llm_endpoint_requires_key(client, monkeypatch):
    body = {"model": "m", "messages": [{"role": "user", "content": "hi"}]}
    monkeypatch.setattr(config, "CUSTOM_LLM_API_KEY", "")
    assert client.post("/v1/chat/completions", json=body).status_code == 503
    monkeypatch.setattr(config, "CUSTOM_LLM_API_KEY", "llm-key")
    assert client.post("/v1/chat/completions", json=body).status_code == 401


def test_custom_llm_streams_openai_chunks(client, monkeypatch):
    from services import gemini_client

    async def fake_stream(prompt, **_):
        yield "Hello"

    monkeypatch.setattr(config, "CUSTOM_LLM_API_KEY", "llm-key")
    monkeypatch.setattr(gemini_client, "generate_stream", fake_stream)
    body = {"model": "m", "messages": [{"role": "user", "content": "hi"}]}
    resp = client.post(
        "/v1/chat/completions", json=body, headers={"Authorization": "Bearer llm-key"}
    )
    lines = [line for line in resp.text.split("\n\n") if line]
    assert lines[-1] == "data: [DONE]"
    contents = [json.loads(line[6:])["choices"][0]["delta"]["content"] for line in lines[:-1]]
    assert contents[-1] == "Hello"
