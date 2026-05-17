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

Set `GEMINI_API_KEY` in environment. Default model: `gemini-2.5-flash`.

## Twilio + ElevenLabs (real phone calls)

Set these environment variables before starting backend:

```bash
export GEMINI_API_KEY="..."
export ELEVENLABS_API_KEY="..."
export TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export TWILIO_FROM_NUMBER="+1XXXXXXXXXX"   # Twilio number
export PUBLIC_BASE_URL="https://<your-public-host>"  # ngrok/cloud run URL
```

If you run locally, expose backend publicly so Twilio can reach your webhooks:

```bash
ngrok http 8000
```

Then set `PUBLIC_BASE_URL` to the generated HTTPS URL.

Create an outbound call:

```bash
curl -X POST http://localhost:8000/api/twilio/call \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "+1XXXXXXXXXX",
    "message": "Hello from Lexguard. This is a live call test."
  }'
```

Use analysis-based briefing call:

```bash
curl -X POST http://localhost:8000/api/twilio/call \
  -H "Content-Type: application/json" \
  -d '{
    "to_number": "+1XXXXXXXXXX",
    "analysis_id": "your_analysis_id"
  }'
```

## GCP

See **[GCP_ENABLE.md](./GCP_ENABLE.md)** for Cloud Run, Firestore, GCS, Firebase, Monitoring.

After you enable GCP, send:

- `GCP_PROJECT_ID`
- `GCS_BUCKET_NAME`
- Cloud Run URL (after deploy)

## Architecture

See [context.md](./context.md) for full agent prompts and sprint plan.
