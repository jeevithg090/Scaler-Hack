"""Outbound phone calls via Twilio."""

from __future__ import annotations

from urllib.parse import urlencode, urlparse

from fastapi import HTTPException
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client

import config


def _require(value: str, name: str) -> str:
    if not value:
        raise HTTPException(status_code=503, detail=f"{name} is not configured")
    return value


def _normalized_public_base_url() -> str:
    base_url = _require(config.PUBLIC_BASE_URL, "PUBLIC_BASE_URL").rstrip("/")
    parsed = urlparse(base_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=500, detail="PUBLIC_BASE_URL must be a valid http(s) URL")
    return base_url


def get_client() -> Client:
    sid = _require(config.TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID")
    token = _require(config.TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN")
    return Client(sid, token)


def get_from_number() -> str:
    return _require(config.TWILIO_FROM_NUMBER, "TWILIO_FROM_NUMBER")


def build_voice_webhook_url(
    analysis_id: str | None = None,
    custom_message: str | None = None,
) -> str:
    base = _normalized_public_base_url()
    params = {}
    if analysis_id:
        params["analysis_id"] = analysis_id
    if custom_message:
        params["message"] = custom_message
    query = f"?{urlencode(params)}" if params else ""
    return f"{base}/api/twilio/voice{query}"


def is_configured() -> bool:
    return bool(
        config.TWILIO_ACCOUNT_SID
        and config.TWILIO_AUTH_TOKEN
        and config.TWILIO_FROM_NUMBER
        and config.PUBLIC_BASE_URL
    )


def create_outbound_call(
    *,
    to_number: str,
    analysis_id: str | None = None,
    custom_message: str | None = None,
):
    client = get_client()
    from_number = get_from_number()
    voice_url = build_voice_webhook_url(analysis_id=analysis_id, custom_message=custom_message)

    try:
        call = client.calls.create(
            to=to_number,
            from_=from_number,
            url=voice_url,
            method="POST",
            status_callback_event=["initiated", "ringing", "answered", "completed"],
            status_callback=f"{_normalized_public_base_url()}/api/twilio/status",
            status_callback_method="POST",
        )
    except TwilioRestException as exc:
        raise HTTPException(
            status_code=400, detail=f"Twilio call creation failed: {exc.msg}"
        ) from exc

    return {
        "sid": call.sid,
        "status": call.status,
        "to": call.to,
        "from": call.from_,
        "direction": call.direction,
    }
