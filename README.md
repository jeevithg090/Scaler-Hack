# LEXGUARD

Adversarial multi-agent contract intelligence (H2S / Google hackathon sprint).

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Health: http://localhost:8000/api/health

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — paste text from `samples/demo-employment.txt` or upload a file.

## Gemini

API key is in `backend/config.py` (hackathon hardcode). Model: `gemini-2.5-flash`.

## GCP

See **[GCP_ENABLE.md](./GCP_ENABLE.md)** for Cloud Run, Firestore, GCS, Firebase, Monitoring.

After you enable GCP, send:

- `GCP_PROJECT_ID`
- `GCS_BUCKET_NAME`
- Cloud Run URL (after deploy)

## Architecture

See [context.md](./context.md) for full agent prompts and sprint plan.
