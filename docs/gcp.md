# GCP setup for LEXGUARD (step-by-step)

Use one Google Cloud project for everything. Replace `YOUR_PROJECT_ID` with your project ID (e.g. `lexguard-hackathon`).

## 0. Prerequisites

1. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Login and pick project:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

3. Enable billing on the project (required for Cloud Run, Firestore, etc.)

---

## 1. Enable APIs (run once)

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  generativelanguage.googleapis.com
```

| API | Why |
|-----|-----|
| `run.googleapis.com` | Host FastAPI backend |
| `firestore.googleapis.com` | Store analysis results |
| `secretmanager.googleapis.com` | API keys (production) |
| `storage.googleapis.com` | Temp uploaded PDFs |
| `generativelanguage.googleapis.com` | Gemini (already working for your key) |
| `logging.googleapis.com` / `monitoring.googleapis.com` | Ops + uptime checks |

**Gemini only (if you use AI Studio key):**  
https://aistudio.google.com/apikey — often no manual API enable needed.

**If Gemini returns `SERVICE_DISABLED`:**  
https://console.developers.google.com/apis/api/generativelanguage.googleapis.com/overview?project=YOUR_PROJECT_ID

---

## 2. Firestore

1. Console → **Firestore** → **Create database**
2. Mode: **Native**
3. Region: `us-central1` (same as Cloud Run)
4. Start in **production** mode (we add rules later)

Send me when done:
- `GCP_PROJECT_ID`
- Confirm collection name: `analyses` (default)

---

## 3. Cloud Storage (temp documents)

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export BUCKET=lexguard-docs-temp

gsutil mb -p $PROJECT_ID -l us-central1 gs://$BUCKET

# 24h auto-delete lifecycle
cat > /tmp/lifecycle.json <<'EOF'
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {"age": 1}
  }]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://$BUCKET
```

Send me: `GCS_BUCKET_NAME=lexguard-docs-temp`

---

## 4. Secret Manager (optional for prod)

```bash
echo -n "AQ.your-gemini-key" | gcloud secrets create gemini-api-key \
  --data-file=- --replication-policy=automatic

# Grant Cloud Run access (after first deploy):
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

For hackathon MVP we hardcode Gemini in `backend/config.py`; move to Secret Manager before public deploy.

---

## 5. Deploy backend to Cloud Run

```bash
cd backend
gcloud run deploy lexguard-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars GCP_PROJECT_ID=YOUR_PROJECT_ID,GCS_BUCKET_NAME=lexguard-docs-temp
```

Copy the service URL (e.g. `https://lexguard-backend-xxxxx-uc.a.run.app`) and set:

`NEXT_PUBLIC_API_URL=<that-url>`

---

## 6. Firebase Hosting (frontend)

1. Console → **Firebase** → Add project (link same GCP project)
2. Install CLI: `npm i -g firebase-tools`
3. `firebase login`
4. In `frontend/`: `firebase init hosting` → select project, `out` or Next.js export dir
5. `firebase deploy --only hosting`

---

## 7. Cloud Monitoring uptime check

Console → **Monitoring** → **Uptime checks** → Create:
- Protocol: HTTPS
- Host: your Cloud Run hostname
- Path: `/api/health`
- Period: 1 min

Or CLI:

```bash
gcloud monitoring uptime create lexguard-health \
  --resource-type=uptime-url \
  --display-name="LEXGUARD Health" \
  --http-check-path=/api/health \
  --hostname=YOUR_CLOUD_RUN_HOST
```

---

## 8. What to send back after enabling

Reply with:

```
GCP_PROJECT_ID=
GCS_BUCKET_NAME=
CLOUD_RUN_URL=
FIREBASE_HOSTING_URL= (if deployed)
```

Optional service account JSON only if you want Firestore/GCS from local dev (not needed for Cloud Run default SA).

---

## Quick local run (no GCP)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

```bash
cd frontend
npm install && npm run dev
```

Frontend: http://localhost:3000 — API: http://localhost:8000
