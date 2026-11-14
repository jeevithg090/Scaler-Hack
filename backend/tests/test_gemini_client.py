from __future__ import annotations

import json

import httpx
import pytest
import respx

import config
from services import gemini_client

URL = f"{config.GEMINI_BASE}/models/{config.GEMINI_MODEL}:generateContent"


def _reply(text: str) -> httpx.Response:
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": text}]}}]})


def test_parse_json_handles_code_fences():
    assert gemini_client.parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert gemini_client.parse_json(' {"b": 2} ') == {"b": 2}


def test_parse_json_rejects_non_objects():
    with pytest.raises(json.JSONDecodeError):
        gemini_client.parse_json("[1, 2]")


@respx.mock
async def test_generate_sends_key_in_header_not_url():
    route = respx.post(URL).mock(return_value=_reply("hi"))
    assert await gemini_client.generate("prompt", system="sys", json_mode=False) == "hi"
    request = route.calls.last.request
    assert request.headers["x-goog-api-key"] == config.GEMINI_API_KEY
    assert "key=" not in str(request.url)
    body = json.loads(request.content)
    assert body["contents"][0]["parts"][0]["text"].startswith("[SYSTEM]")
    assert "responseMimeType" not in body["generationConfig"]


@respx.mock
async def test_generate_json_parses_response():
    respx.post(URL).mock(return_value=_reply('{"ok": true}'))
    assert await gemini_client.generate_json("p") == {"ok": True}


@respx.mock
async def test_generate_json_malformed():
    respx.post(URL).mock(return_value=_reply("not json"))
    with pytest.raises(gemini_client.GeminiError, match="malformed"):
        await gemini_client.generate_json("p")


@respx.mock
async def test_http_error_does_not_leak_body():
    respx.post(URL).mock(return_value=httpx.Response(403, text="secret details"))
    with pytest.raises(gemini_client.GeminiError) as exc:
        await gemini_client.generate("p")
    assert "403" in str(exc.value) and "secret" not in str(exc.value)


@respx.mock
async def test_blocked_prompt():
    respx.post(URL).mock(
        return_value=httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})
    )
    with pytest.raises(gemini_client.GeminiError, match="SAFETY"):
        await gemini_client.generate("p")


async def test_missing_key(monkeypatch):
    monkeypatch.setattr(gemini_client, "GEMINI_API_KEY", "")
    with pytest.raises(gemini_client.GeminiError, match="not configured"):
        await gemini_client.generate("p")


@respx.mock
async def test_generate_stream_yields_text_chunks():
    stream_url = f"{config.GEMINI_BASE}/models/{config.GEMINI_MODEL}:streamGenerateContent"
    lines = [
        'data: {"candidates": [{"content": {"parts": [{"text": "Hel"}]}}]}',
        "data: not-json",
        'data: {"candidates": [{"content": {"parts": [{"text": "lo"}]}}]}',
    ]
    respx.post(stream_url).mock(return_value=httpx.Response(200, text="\n\n".join(lines)))
    chunks = [c async for c in gemini_client.generate_stream("p")]
    assert chunks == ["Hel", "lo"]
