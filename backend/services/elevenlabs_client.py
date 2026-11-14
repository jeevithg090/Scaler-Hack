"""ElevenLabs text-to-speech helpers.

The ElevenLabs SDK is synchronous, so calls are pushed onto a worker thread
to avoid blocking the event loop.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import HTTPException

import config

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(config.ELEVENLABS_API_KEY)


def _synthesize(text: str, voice_id: str) -> bytes:
    from elevenlabs import ElevenLabs

    client = ElevenLabs(api_key=config.ELEVENLABS_API_KEY)
    chunks = client.text_to_speech.convert(
        voice_id=voice_id, text=text, model_id=config.ELEVENLABS_MODEL_ID
    )
    return b"".join(chunks)


async def synthesize(text: str, voice_id: str | None = None) -> bytes:
    if not is_configured():
        raise HTTPException(status_code=503, detail="Voice features are not configured")
    try:
        return await asyncio.to_thread(
            _synthesize, text, voice_id or config.ELEVENLABS_NARRATOR_VOICE_ID
        )
    except Exception as exc:
        logger.exception("ElevenLabs synthesis failed")
        raise HTTPException(status_code=502, detail="Text-to-speech provider error") from exc


async def generate_audio_briefing(text: str) -> bytes:
    """Narrated summary of an analysis."""
    return await synthesize(text)


async def generate_negotiation_coach(text: str) -> bytes:
    """Narrated negotiation pushback for a single clause."""
    return await synthesize(text)


async def generate_agent_debate(risk_hunter_text: str, devils_advocate_text: str) -> bytes:
    """Two-voice debate: both MP3 segments are synthesized concurrently and concatenated."""
    risk, defense = await asyncio.gather(
        synthesize(f"Risk Hunter here. {risk_hunter_text}", config.ELEVENLABS_RISK_HUNTER_VOICE_ID),
        synthesize(
            f"Devil's Advocate here. {devils_advocate_text}", config.ELEVENLABS_DEFENDER_VOICE_ID
        ),
    )
    return risk + defense
