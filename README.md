# LEXGUARD

**Adversarial multi-agent contract analysis. Six AI agents argue over every clause before you sign.**

LEXGUARD takes a contract (offer letter, NDA, freelance agreement, terms of service, lease and so on) and runs it through a pipeline of Gemini-powered agents. One agent hunts for clauses that hurt the weaker party. Another argues the other side's case. A third settles the argument. You get a 0–100 **LEXSCORE**, a verdict for each clause (RED / AMBER / GREEN), negotiation scripts, suggested redlines and a negotiation pack you can download.

It was built during the H2S *Build with AI* hackathon (Google for Developers).

> LEXGUARD is not legal advice. It helps you understand a document; it does not replace a lawyer.

## Features

- **Three ways to submit a document:** upload a PDF, DOCX or TXT file (up to 10 MB), paste text, or give a public URL.
- **Live agent progress:** results stream to the browser over Server-Sent Events while the agents run.
- **Clause-level verdicts:** each clause gets a severity, a risk type (exploit, liability, ambiguity, practical risk, missing protection), a worst-case scenario, the opposing defense, a confidence level and an industry-norm comparison.
- **Action plan:** an overall recommendation (sign / negotiate first / walk away) based on the score and the number of risky clauses.
- **Score simulator:** tick off clauses you expect to win in negotiation and see the projected score.
- **Negotiation pack:** a Markdown or TXT download with the riskiest clauses, a ready-to-send email and clause-by-clause redlines.
- **Contract chat:** ask follow-up questions about the analyzed document.
- **Offer comparison:** analyze two offers side by side and compare their scores.
- **Optional voice features** (ElevenLabs): an audio briefing, a two-voice clause debate, a negotiation coach, and a conversational voice agent.
- **Optional phone briefings** (Twilio): an operator can call a number and read out the analysis summary.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion |
| Backend | Python 3.11+, FastAPI, Pydantic v2, httpx |
| AI | Google Gemini (`gemini-2.5-flash` by default) via the REST API |
| Parsing | PyMuPDF (PDF), python-docx (DOCX) |
| Persistence | In-memory (development) or Google Cloud Firestore (production) |
| Voice / phone | ElevenLabs, Twilio (both optional) |
| Tooling | Ruff and pytest (backend); ESLint, Prettier and Vitest (frontend); GitHub Actions |
| Deployment | Docker and Google Cloud Run |

## Architecture

```
┌──────────────┐  POST /api/analyze   ┌──────────────────────────────────────────────┐
│  Next.js UI  │ ───────────────────▶ │ FastAPI                                      │
│              │                      │  document_parser → analysis_store (queued)   │
│              │  GET …/stream (SSE)  │  BackgroundTask: pipeline.run_analysis       │
│              │ ◀─────────────────── │                                              │
└──────────────┘                      │   0 Orchestrator   doc type, weaker party    │
                                      │   1 Extractor      clauses (≤25)             │
                                      │   2 Risk Hunter    attacks each clause       │
                                      │   3 Devil's Adv.   defends flagged clauses   │
                                      │   4 Synthesis      verdicts + LEXSCORE       │
                                      │   5 Comparator     industry benchmarks       │
                                      │        │                                     │
                                      │        ▼                                     │
                                      │  build_final_result → Firestore / memory     │
                                      └──────────────────────────────────────────────┘
```

1. The frontend posts the document. The backend extracts the text, creates an analysis record and returns its `analysis_id` straight away.
2. The six agents run as a background task. Each step appends a progress event to the record.
3. The frontend subscribes to `/api/analyze/{id}/stream`, which relays those events and then sends the final result. If the stream drops, the frontend polls `GET /api/analyze/{id}` instead.
4. `services/pipeline.py` merges the agent outputs into a typed `LexGuardAnalysis`: verdict counts, risk taxonomy, confidence, action plan and adversarial metrics.

**Persistence.** With `ENVIRONMENT=production` or `GCP_PROJECT_ID` set, analyses are stored in Firestore, so several Cloud Run instances or workers share state. Otherwise an in-memory store is used. It holds up to 500 analyses and keeps them per process, so run a single worker (`WEB_CONCURRENCY=1`, the Docker default) in that mode.

### Security notes

- CORS only allows the origins listed in `CORS_ORIGINS`.
- URL fetching resolves the host and refuses loopback, private and link-local addresses on every redirect hop (SSRF protection). Responses are capped at 5 MB.
- `POST /api/twilio/call` places real phone calls, so it needs `Authorization: Bearer $ADMIN_API_TOKEN`. It is disabled when no token is set.
- `/v1/chat/completions`, the OpenAI-compatible endpoint used by the ElevenLabs agent, needs `Authorization: Bearer $CUSTOM_LLM_API_KEY`. It is disabled when no key is set.
- The TTS URLs handed to Twilio are signed with HMAC, so `/api/twilio/tts.mp3` cannot be used as an open text-to-speech proxy.
- The Gemini API key is sent in a request header, never in a URL. Upstream error bodies are not passed on to clients.
- `GET /api/analyze/{id}` does not return the original document text or the internal event log.

## Getting started

### Prerequisites

- Python 3.11 or newer
- Node.js 20.9 or newer (22 recommended)
- A [Gemini API key](https://aistudio.google.com/apikey)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # then set GEMINI_API_KEY
set -a; source .env; set +a   # the app reads plain environment variables
uvicorn main:app --reload --port 8000
```

Health check: <http://localhost:8000/api/health>. Interactive API docs: <http://localhost:8000/docs>.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open <http://localhost:3000>. To try it, paste the text of one of the files in [`samples/`](./samples) or upload one.

## Environment variables

### Backend (`backend/.env.example`)

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Gemini API key |
| `GEMINI_MODEL` | no | Model name (default `gemini-2.5-flash`) |
| `GEMINI_BASE` | no | Gemini REST base URL |
| `CORS_ORIGINS` | no | Comma-separated allowed browser origins (default: localhost:3000) |
| `ENVIRONMENT` | no | `development` / `production` (`production` turns on Firestore) |
| `ELEVENLABS_API_KEY` | no | Turns on the voice endpoints |
| `ELEVENLABS_*_VOICE_ID`, `ELEVENLABS_MODEL_ID` | no | Override the default voices and model |
| `CUSTOM_LLM_API_KEY` | no | Bearer token for `/v1/chat/completions` (ElevenLabs agent) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | no | Twilio credentials for phone briefings |
| `PUBLIC_BASE_URL` | no | Public HTTPS URL of the backend that Twilio can reach |
| `ADMIN_API_TOKEN` | no | Bearer token for `POST /api/twilio/call` |
| `TTS_SIGNING_SECRET` | no | HMAC secret for TTS URLs (defaults to `TWILIO_AUTH_TOKEN`) |
| `GCP_PROJECT_ID` | no | Turns on Firestore persistence |
| `FIRESTORE_COLLECTION` | no | Firestore collection name (default `analyses`) |
| `GCS_BUCKET_NAME` | no | Reported in the health check only; not used by the code yet |
| `WEB_CONCURRENCY` | no | Uvicorn workers in Docker (default `1`) |

### Frontend (`frontend/.env.local.example`)

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend base URL. Inlined at **build** time. |
| `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` | Optional ElevenLabs Conversational AI agent id; shows the voice widget on results. |

## Testing, linting and building

```bash
# backend
cd backend
ruff check . && ruff format --check .
pytest

# frontend
cd frontend
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

The backend tests stub every Gemini call, so they need no API key or network access. They cover the result-merging logic, document parsing (including the SSRF guards), the Gemini client, persistence, request authentication and every HTTP endpoint. The frontend tests cover the scoring helpers and the API client.

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request, plus `pip-audit` and `npm audit`.

## Phone calls (Twilio)

1. Set the Twilio variables, `PUBLIC_BASE_URL` and `ADMIN_API_TOKEN`. For local development, expose the backend with `ngrok http 8000` and use the HTTPS URL it prints.
2. Place a call:

```bash
curl -X POST http://localhost:8000/api/twilio/call \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to_number": "+1XXXXXXXXXX", "analysis_id": "<analysis id>"}'
```

When ElevenLabs is configured, the call plays ElevenLabs audio. Otherwise Twilio's built-in voice reads the briefing.

## Voice agent (ElevenLabs)

Create an ElevenLabs Conversational AI agent that uses a **custom LLM**:

- Point it at `https://<backend>/v1/chat/completions`.
- Set its API key to the value of `CUSTOM_LLM_API_KEY`.

Then set `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` in the frontend. The widget passes the analysis id as the `UUID` dynamic variable, so the agent knows which document it is discussing.

## Deployment

Both services have production Dockerfiles. The backend honors `$PORT` and runs as a non-root user. The frontend uses Next.js standalone output.

```bash
docker build -t lexguard-backend backend
docker run -p 8080:8080 -e GEMINI_API_KEY=... -e CORS_ORIGINS=http://localhost:3000 lexguard-backend

docker build -t lexguard-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 frontend
docker run -p 3000:3000 lexguard-frontend
```

For Google Cloud Run, `scripts/gcp-deploy.sh` does the full setup. It enables the APIs, creates Firestore, deploys both services from source, then sets the backend's `CORS_ORIGINS` and `PUBLIC_BASE_URL` to the deployed URLs. It reads secrets from `backend/.env`. For production, prefer Secret Manager (`--set-secrets`); see [`docs/gcp.md`](./docs/gcp.md).

## Project structure

```
.
├── backend/
│   ├── main.py               # FastAPI app and routes
│   ├── config.py             # Environment configuration
│   ├── security.py           # Bearer-token guards and TTS URL signing
│   ├── agents/               # One module per Gemini agent (+ chat)
│   ├── models/schemas.py     # Pydantic response models
│   ├── services/
│   │   ├── pipeline.py       # Agent orchestration and result merging
│   │   ├── analysis_store.py # Firestore / in-memory persistence
│   │   ├── document_parser.py# PDF/DOCX/TXT/URL extraction with SSRF guard
│   │   ├── gemini_client.py  # Gemini REST client
│   │   ├── negotiation_pack.py
│   │   ├── elevenlabs_client.py
│   │   └── twilio_client.py
│   └── tests/                # pytest suite
├── frontend/
│   ├── app/                  # Landing page, /analyze/[id], error and 404 pages
│   ├── components/           # Clause cards, score gauge, agent progress, audio, voice widget
│   ├── lib/                  # API client, types, scoring helpers
│   └── __tests__/            # Vitest suite
├── samples/                  # Demo contracts
├── scripts/                  # GCP setup/deploy, Gemini smoke test
├── docs/                     # GCP guide and original design notes
└── .github/workflows/ci.yml
```
