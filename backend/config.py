"""Runtime configuration, read once from environment variables.

See ``.env.example`` for the full list of supported variables.
"""

from __future__ import annotations

import os


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in _env(name, default).split(",") if item.strip()]


ENVIRONMENT = _env("ENVIRONMENT", "development")

# ── Gemini ────────────────────────────────────────────────────────
GEMINI_API_KEY = _env("GEMINI_API_KEY")
GEMINI_MODEL = _env("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_BASE = _env("GEMINI_BASE", "https://generativelanguage.googleapis.com/v1beta").rstrip("/")
GEMINI_TIMEOUT_SECONDS = float(_env("GEMINI_TIMEOUT_SECONDS", "120"))

# ── ElevenLabs ────────────────────────────────────────────────────
ELEVENLABS_API_KEY = _env("ELEVENLABS_API_KEY")
ELEVENLABS_MODEL_ID = _env("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
ELEVENLABS_NARRATOR_VOICE_ID = _env("ELEVENLABS_NARRATOR_VOICE_ID", "iP95p4xoKVk53GoZ742B")
ELEVENLABS_RISK_HUNTER_VOICE_ID = _env("ELEVENLABS_RISK_HUNTER_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
ELEVENLABS_DEFENDER_VOICE_ID = _env("ELEVENLABS_DEFENDER_VOICE_ID", "9BWtsMINqrJLrRacOk9x")

# ── Twilio ────────────────────────────────────────────────────────
TWILIO_ACCOUNT_SID = _env("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = _env("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = _env("TWILIO_FROM_NUMBER")
PUBLIC_BASE_URL = _env("PUBLIC_BASE_URL").rstrip("/")

# ── Security ──────────────────────────────────────────────────────
# Browser origins allowed to call the API (comma separated).
CORS_ORIGINS = _env_list("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
# Bearer token required for operator-only endpoints (outbound phone calls).
# When unset those endpoints are disabled.
ADMIN_API_TOKEN = _env("ADMIN_API_TOKEN")
# Bearer token ElevenLabs must send to the OpenAI-compatible custom LLM endpoint.
# When unset the endpoint is disabled.
CUSTOM_LLM_API_KEY = _env("CUSTOM_LLM_API_KEY")
# Secret used to sign TTS URLs handed to Twilio. Falls back to the Twilio auth token.
TTS_SIGNING_SECRET = _env("TTS_SIGNING_SECRET") or TWILIO_AUTH_TOKEN

# ── Limits ────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_DOCUMENT_CHARS = 200_000
MAX_URL_FETCH_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_CHAT_MESSAGE_CHARS = 2_000
MIN_DOCUMENT_CHARS = 50

# ── GCP (optional) ────────────────────────────────────────────────
GCP_PROJECT_ID = _env("GCP_PROJECT_ID")
GCS_BUCKET_NAME = _env("GCS_BUCKET_NAME")
FIRESTORE_COLLECTION = _env("FIRESTORE_COLLECTION", "analyses")
USE_FIRESTORE = ENVIRONMENT == "production" or bool(GCP_PROJECT_ID)
