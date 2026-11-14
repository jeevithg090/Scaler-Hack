#!/bin/bash
# ─────────────────────────────────────────────────────────────
# LEXGUARD — GCP Setup & Deploy Script
# Run this in Google Cloud Shell (project: scaler-hack)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-scaler-hack}"
REGION="${REGION:-us-central1}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_SERVICE="lexguard-backend"
FRONTEND_SERVICE="lexguard-frontend"
BUCKET_NAME="lexguard-docs-temp-${PROJECT_ID}"

echo "═══════════════════════════════════════════════════"
echo "  LEXGUARD — GCP Deployment"
echo "  Project: ${PROJECT_ID} | Region: ${REGION}"
echo "═══════════════════════════════════════════════════"

# ── 1. Set project ──────────────────────────────────────────
echo ""
echo "▶ [1/8] Setting project..."
gcloud config set project ${PROJECT_ID}

# ── 2. Enable APIs ─────────────────────────────────────────
echo ""
echo "▶ [2/8] Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  generativelanguage.googleapis.com \
  --quiet

echo "   ✓ All APIs enabled"

# ── 3. Create Cloud Storage bucket ──────────────────────────
echo ""
echo "▶ [3/8] Creating Cloud Storage bucket..."
if gcloud storage ls gs://${BUCKET_NAME} 2>/dev/null; then
  echo "   ✓ Bucket already exists"
else
  gcloud storage buckets create gs://${BUCKET_NAME} --project=${PROJECT_ID} --location=${REGION} --uniform-bucket-level-access
  echo "   ✓ Bucket created: gs://${BUCKET_NAME}"
fi

# Set 24h auto-delete lifecycle
cat > /tmp/lifecycle.json <<'EOF'
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {"age": 1}
  }]
}
EOF
gcloud storage buckets update gs://${BUCKET_NAME} --lifecycle-file=/tmp/lifecycle.json
echo "   ✓ 24h auto-delete lifecycle set"

# ── 4. Create Firestore database ───────────────────────────
echo ""
echo "▶ [4/8] Setting up Firestore..."
gcloud firestore databases create --location=${REGION} --type=firestore-native 2>/dev/null || echo "   ✓ Firestore already exists"

# ── 5. Locate repo ─────────────────────────────────────────
echo ""
echo "▶ [5/8] Using repository at ${REPO_ROOT}"

# ── 6. Deploy backend to Cloud Run ─────────────────────────
echo ""
echo "▶ [6/8] Deploying backend to Cloud Run..."
echo "   (This takes 3-5 minutes for the first deploy)"

cd "${REPO_ROOT}/backend"

if [ -f .env ]; then
  echo "   ✓ Loading variables from backend/.env"
  set -a; . ./.env; set +a
fi

gcloud run deploy ${BACKEND_SERVICE} \
  --source . \
  --region ${REGION} \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${BUCKET_NAME},ENVIRONMENT=production,GEMINI_API_KEY=${GEMINI_API_KEY:-},ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-},TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID:-},TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN:-},TWILIO_FROM_NUMBER=${TWILIO_FROM_NUMBER:-},ADMIN_API_TOKEN=${ADMIN_API_TOKEN:-},CUSTOM_LLM_API_KEY=${CUSTOM_LLM_API_KEY:-},WEB_CONCURRENCY=2" \
  --quiet

BACKEND_URL=$(gcloud run services describe ${BACKEND_SERVICE} --region=${REGION} --format='value(status.url)')
echo ""
echo "   ✓ Backend deployed: ${BACKEND_URL}"

# ── 7. Deploy frontend to Cloud Run ────────────────────────
echo ""
echo "▶ [7/8] Deploying frontend to Cloud Run..."
echo "   (This takes 3-5 minutes)"

cd "${REPO_ROOT}/frontend"

if [ -f .env.local ]; then
  echo "   ✓ Loading variables from frontend/.env.local"
  set -a; . ./.env.local; set +a
fi

# NEXT_PUBLIC_* values are inlined at build time, so write them to .env
# (copied into the Cloud Build context) before building.
{
  echo "NEXT_PUBLIC_API_URL=${BACKEND_URL}"
  echo "NEXT_PUBLIC_ELEVENLABS_AGENT_ID=${NEXT_PUBLIC_ELEVENLABS_AGENT_ID:-}"
} > .env

gcloud run deploy ${FRONTEND_SERVICE} \
  --source . \
  --region ${REGION} \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 5 \
  --memory 1Gi \
  --timeout 60 \
  --set-env-vars "NEXT_PUBLIC_API_URL=${BACKEND_URL},NEXT_PUBLIC_ELEVENLABS_AGENT_ID=${NEXT_PUBLIC_ELEVENLABS_AGENT_ID:-}" \
  --quiet


FRONTEND_URL=$(gcloud run services describe ${FRONTEND_SERVICE} --region=${REGION} --format='value(status.url)')
echo ""
echo "   ✓ Frontend deployed: ${FRONTEND_URL}"

# Allow the frontend origin to call the backend.
gcloud run services update ${BACKEND_SERVICE} --region ${REGION} \
  --update-env-vars "CORS_ORIGINS=${FRONTEND_URL},PUBLIC_BASE_URL=${BACKEND_URL}" --quiet
echo "   ✓ Backend CORS_ORIGINS set to ${FRONTEND_URL}"

# ── 8. Verify & Summary ───────────────────────────────────
echo ""
echo "▶ [8/8] Verifying deployment..."

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BACKEND_URL}/api/health")
if [ "${HTTP_CODE}" = "200" ]; then
  echo "   ✓ Backend health check passed (200 OK)"
else
  echo "   ⚠ Backend health check returned ${HTTP_CODE}"
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ LEXGUARD DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Frontend:  ${FRONTEND_URL}"
echo "  Backend:   ${BACKEND_URL}"
echo "  Health:    ${BACKEND_URL}/api/health"
echo ""
echo "  GCP Project:  ${PROJECT_ID}"
echo "  Region:       ${REGION}"
echo "  Storage:      gs://${BUCKET_NAME}"
echo ""
echo "  Quick test:"
echo "  curl ${BACKEND_URL}/api/health"
echo ""
echo "═══════════════════════════════════════════════════"
