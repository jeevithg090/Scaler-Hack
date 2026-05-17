"""Runtime configuration — hackathon sprint uses hardcoded Gemini key."""

GEMINI_API_KEY = "AQ.Ab8RN6LrsTzpK_9Z-vVi1VOqHgQw-OsbSJw8LS_pDC5MBlMajA"
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# GCP (optional — enable per GCP_ENABLE.md)
GCP_PROJECT_ID = ""
GCS_BUCKET_NAME = ""
FIRESTORE_COLLECTION = "analyses"
ENVIRONMENT = "development"
