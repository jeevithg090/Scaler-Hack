"""Runtime configuration — hackathon sprint uses hardcoded Gemini key."""

GEMINI_API_KEY = "AQ.Ab8RN6LrsTzpK_9Z-vVi1VOqHgQw-OsbSJw8LS_pDC5MBlMajA"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

ELEVENLABS_API_KEY = "sk_946fd54deb0c6455c80e21807f51a5e59c0a68597a58a8b8"
TWILIO_ACCOUNT_SID = "ACa256ef730ed27154495a2320d1def387"
TWILIO_AUTH_TOKEN = "8516d776bd64c47529b69bea1306e49b"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# GCP (optional — enable per GCP_ENABLE.md)
GCP_PROJECT_ID = ""
GCS_BUCKET_NAME = ""
FIRESTORE_COLLECTION = "analyses"
ENVIRONMENT = "development"
