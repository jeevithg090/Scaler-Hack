#!/usr/bin/env bash
# Usage: GEMINI_API_KEY=your_key ./test-gemini.sh
set -euo pipefail

API_KEY="${GEMINI_API_KEY:?Set GEMINI_API_KEY}"
MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
BASE="https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent"

run_test() {
  local name="$1"
  local payload="$2"
  echo ""
  echo "=== $name ==="
  http_code=$(curl -s -o /tmp/gemini_resp.json -w "%{http_code}" \
    "${BASE}?key=${API_KEY}" \
    -H 'Content-Type: application/json' \
    -d "$payload")
  echo "HTTP $http_code"
  cat /tmp/gemini_resp.json | python3 -m json.tool 2>/dev/null || cat /tmp/gemini_resp.json
}

run_test "1. Text generation" \
  '{"contents":[{"parts":[{"text":"Reply with exactly: GEMINI_OK"}]}]}'

run_test "2. Multi-turn chat" \
  '{"contents":[
    {"role":"user","parts":[{"text":"My name is Alex."}]},
    {"role":"model","parts":[{"text":"Hello Alex!"}]},
    {"role":"user","parts":[{"text":"What is my name? Reply with only the name."}]}
  ]}'

run_test "3. JSON structured output" \
  '{"contents":[{"parts":[{"text":"Return JSON with keys status and message for a health check."}]}],
    "generationConfig":{"responseMimeType":"application/json"}}'
