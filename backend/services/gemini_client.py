from __future__ import annotations

import json
import re
from typing import Any, Optional

import httpx

from config import GEMINI_API_KEY, GEMINI_BASE, GEMINI_MODEL

_JSON_BLOCK = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    match = _JSON_BLOCK.search(text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)


async def generate(
    prompt: str,
    *,
    system: Optional[str] = None,
    json_mode: bool = True,
    temperature: float = 0.2,
) -> str:
    url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:generateContent"
    parts: list[dict[str, str]] = []
    if system:
        parts.append({"text": f"[SYSTEM]\n{system}\n[/SYSTEM]"})
    parts.append({"text": prompt})

    body: dict[str, Any] = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": temperature},
    }
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            url,
            params={"key": GEMINI_API_KEY},
            json=body,
        )
        resp.raise_for_status()
        data = resp.json()

    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError(f"Gemini returned no candidates: {data}")

    parts_out = candidates[0].get("content", {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts_out)
    if not text:
        raise ValueError("Empty Gemini response")
    return text


async def generate_json(
    prompt: str,
    *,
    system: Optional[str] = None,
    temperature: float = 0.2,
) -> dict[str, Any]:
    raw = await generate(
        prompt, system=system, json_mode=True, temperature=temperature
    )
    try:
        return _parse_json(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON from Gemini: {raw[:500]}") from e
