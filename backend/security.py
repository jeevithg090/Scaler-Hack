"""Request authentication helpers."""

from __future__ import annotations

import hashlib
import hmac

from fastapi import Header, HTTPException

import config


def _bearer(authorization: str | None) -> str:
    if not authorization:
        return ""
    scheme, _, token = authorization.partition(" ")
    return token.strip() if scheme.lower() == "bearer" else ""


def _check_bearer(expected: str, authorization: str | None, feature: str) -> None:
    if not expected:
        raise HTTPException(status_code=503, detail=f"{feature} is disabled on this server")
    if not hmac.compare_digest(_bearer(authorization).encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing bearer token")


def require_admin(authorization: str | None = Header(default=None)) -> None:
    """Guard for operator-only endpoints (e.g. placing real phone calls)."""
    _check_bearer(config.ADMIN_API_TOKEN, authorization, "Outbound calling")


def require_custom_llm_key(authorization: str | None = Header(default=None)) -> None:
    """Guard for the OpenAI-compatible endpoint used by the ElevenLabs agent."""
    _check_bearer(config.CUSTOM_LLM_API_KEY, authorization, "The custom LLM endpoint")


def sign_text(text: str) -> str:
    """HMAC signature binding a TTS text to this server's secret."""
    if not config.TTS_SIGNING_SECRET:
        raise HTTPException(status_code=503, detail="TTS signing secret is not configured")
    return hmac.new(config.TTS_SIGNING_SECRET.encode(), text.encode(), hashlib.sha256).hexdigest()


def verify_text_signature(text: str, signature: str) -> bool:
    if not config.TTS_SIGNING_SECRET or not signature:
        return False
    return hmac.compare_digest(sign_text(text), signature)
