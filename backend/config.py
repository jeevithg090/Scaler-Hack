import os

"""Runtime configuration."""

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_BASE = os.getenv("GEMINI_BASE", "https://generativelanguage.googleapis.com/v1beta")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# GCP (optional — enable per GCP_ENABLE.md)
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
FIRESTORE_COLLECTION = os.getenv("FIRESTORE_COLLECTION", "analyses")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
