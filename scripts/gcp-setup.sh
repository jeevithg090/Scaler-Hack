#!/usr/bin/env bash
# LEXGUARD — one-shot GCP setup (run from repo root)
# Usage:
#   export PROJECT_ID=your-gcp-project-id
#   export BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX   # optional if billing already linked
#   ./scripts/gcp-setup.sh
#
# Prerequisites: gcloud installed, `gcloud auth login` done

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID (e.g. export PROJECT_ID=lexguard-hackathon)}"

REGION="${REGION:-us-central1}"
BUCKET="${GCS_BUCKET_NAME:-lexguard-docs-temp}"
SERVICE_NAME="${CLOUD_RUN_SERVICE:-lexguard-backend}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Project: $PROJECT_ID | Region: $REGION"

gcloud config set project "$PROJECT_ID"

# --- 1. Billing (skip if already linked) ---
if [[ -n "${BILLING_ACCOUNT_ID:-}" ]]; then
  echo "==> Linking billing account..."
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
else
  echo "==> Billing: skipping link (set BILLING_ACCOUNT_ID to link, or enable in console)"
  echo "    List accounts: gcloud billing accounts list"
fi

# --- 2. Enable APIs ---
echo "==> Enabling APIs..."
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
  firebase.googleapis.com \
  firebasehosting.googleapis.com

# --- 3. Firestore (Native, us-central1) ---
echo "==> Firestore..."
if gcloud firestore databases describe --database="(default)" &>/dev/null; then
  echo "    Firestore already exists"
else
  gcloud firestore databases create \
    --database="(default)" \
    --location="$REGION" \
    --type=firestore-native
fi

# --- 4. Cloud Storage + 24h lifecycle ---
echo "==> Cloud Storage bucket gs://$BUCKET ..."
if gsutil ls -b "gs://$BUCKET" &>/dev/null; then
  echo "    Bucket already exists"
else
  gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://$BUCKET"
fi

LIFECYCLE_FILE="$(mktemp)"
cat > "$LIFECYCLE_FILE" <<'EOF'
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {"age": 1}
  }]
}
EOF
gsutil lifecycle set "$LIFECYCLE_FILE" "gs://$BUCKET"
rm -f "$LIFECYCLE_FILE"

# --- 5. Secret Manager (optional — uses GEMINI_API_KEY env or skips) ---
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  echo "==> Secret Manager: gemini-api-key"
  if gcloud secrets describe gemini-api-key &>/dev/null; then
    echo -n "$GEMINI_API_KEY" | gcloud secrets versions add gemini-api-key --data-file=-
  else
    echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key \
      --data-file=- --replication-policy=automatic
  fi
else
  echo "==> Secret Manager: skipped (export GEMINI_API_KEY to create secret)"
fi

# --- 6. Deploy Cloud Run ---
echo "==> Deploying Cloud Run ($SERVICE_NAME)..."
cd "$REPO_ROOT/backend"
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 2Gi \
  --timeout 300 \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,GCS_BUCKET_NAME=$BUCKET,ENVIRONMENT=production"

CLOUD_RUN_URL="$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" --format='value(status.url)')"
echo "    Cloud Run URL: $CLOUD_RUN_URL"

# Grant default compute SA access to secrets (if secret exists)
if gcloud secrets describe gemini-api-key &>/dev/null; then
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  gcloud secrets add-iam-policy-binding gemini-api-key \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet || true
fi

# --- 7. Monitoring uptime check ---
HOSTNAME="$(echo "$CLOUD_RUN_URL" | sed -e 's|https://||' -e 's|/.*||')"
echo "==> Uptime check on $HOSTNAME/api/health ..."
if gcloud monitoring uptime list --filter="displayName=LEXGUARD Health" --format="value(name)" 2>/dev/null | grep -q .; then
  echo "    Uptime check already exists"
else
  gcloud monitoring uptime create lexguard-health \
    --display-name="LEXGUARD Health" \
    --resource-type=uptime-url \
    --http-check-path="/api/health" \
    --hostname="$HOSTNAME" \
    --period=60s || echo "    (Uptime CLI failed — create manually in Cloud Console Monitoring)"
fi

# --- 8. Firebase Hosting (optional) ---
if command -v firebase &>/dev/null && [[ "${DEPLOY_FIREBASE:-0}" == "1" ]]; then
  echo "==> Firebase..."
  firebase projects:addfirebase "$PROJECT_ID" 2>/dev/null || true
  cd "$REPO_ROOT/frontend"
  if [[ ! -f firebase.json ]]; then
    echo "    Run once: cd frontend && firebase init hosting"
    echo "    Then: npm run build && firebase deploy --only hosting"
  else
    npm ci && npm run build
    firebase deploy --only hosting --project "$PROJECT_ID"
  fi
else
  echo "==> Firebase: skipped (install firebase-tools, set DEPLOY_FIREBASE=1, run firebase init hosting first)"
fi

echo ""
echo "========== DONE =========="
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCS_BUCKET_NAME=$BUCKET"
echo "CLOUD_RUN_URL=$CLOUD_RUN_URL"
echo ""
echo "Frontend local:  cd frontend && echo \"NEXT_PUBLIC_API_URL=$CLOUD_RUN_URL\" > .env.local && npm run dev"
echo "Health check:    curl -s $CLOUD_RUN_URL/api/health"
