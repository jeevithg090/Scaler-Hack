"""Thin async client for the Gemini ``generateContent`` REST API."""

from __future__ import annotations

import json
import re
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from config import GEMINI_API_KEY, GEMINI_BASE, GEMINI_MODEL, GEMINI_TIMEOUT_SECONDS

_JSON_BLOCK = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


class GeminiError(RuntimeError):
    """Raised when Gemini is misconfigured or returns an unusable response."""


def parse_json(text: str) -> dict[str, Any]:
    """Parse a JSON object from model output, tolerating Markdown code fences."""
    text = text.strip()
    match = _JSON_BLOCK.search(text)
    if match:
        text = match.group(1).strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        raise json.JSONDecodeError("Expected a JSON object", text, 0)
    return data


def _headers() -> dict[str, str]:
    if not GEMINI_API_KEY:
        raise GeminiError("GEMINI_API_KEY is not configured")
    # Send the key as a header so it never appears in URLs or access logs.
    return {"x-goog-api-key": GEMINI_API_KEY, "Content-Type": "application/json"}


def _build_body(
    prompt: str, system: str | None, temperature: float, json_mode: bool
) -> dict[str, Any]:
    parts: list[dict[str, str]] = []
    if system:
        parts.append({"text": f"[SYSTEM]\n{system}\n[/SYSTEM]"})
    parts.append({"text": prompt})
    config: dict[str, Any] = {"temperature": temperature}
    if json_mode:
        config["responseMimeType"] = "application/json"
    return {"contents": [{"role": "user", "parts": parts}], "generationConfig": config}


def _extract_text(data: dict[str, Any]) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        reason = (data.get("promptFeedback") or {}).get("blockReason", "unknown")
        raise GeminiError(f"Gemini returned no candidates (block reason: {reason})")
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts)


async def generate(
    prompt: str,
    *,
    system: str | None = None,
    json_mode: bool = True,
    temperature: float = 0.2,
) -> str:
    url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:generateContent"
    body = _build_body(prompt, system, temperature, json_mode)
    async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
        resp = await client.post(url, headers=_headers(), json=body)
    if resp.status_code >= 400:
        raise GeminiError(f"Gemini request failed with HTTP {resp.status_code}")
    text = _extract_text(resp.json())
    if not text:
        raise GeminiError("Empty Gemini response")
    return text


async def generate_json(
    prompt: str,
    *,
    system: str | None = None,
    temperature: float = 0.2,
) -> dict[str, Any]:
    raw = await generate(prompt, system=system, json_mode=True, temperature=temperature)
    try:
        return parse_json(raw)
    except json.JSONDecodeError as e:
        raise GeminiError("Gemini returned malformed JSON") from e


async def generate_stream(
    prompt: str,
    *,
    system: str | None = None,
    temperature: float = 0.5,
) -> AsyncGenerator[str, None]:
    url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:streamGenerateContent"
    body = _build_body(prompt, system, temperature, json_mode=False)
    async with (
        httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client,
        client.stream("POST", url, params={"alt": "sse"}, headers=_headers(), json=body) as resp,
    ):
        if resp.status_code >= 400:
            raise GeminiError(f"Gemini stream failed with HTTP {resp.status_code}")
        async for line in resp.aiter_lines():
            if not line.startswith("data: "):
                continue
            payload = line[len("data: ") :]
            if payload == "[DONE]":
                break
            try:
                text = _extract_text(json.loads(payload))
            except (json.JSONDecodeError, GeminiError):
                continue
            if text:
                yield text
