# LEXGUARD — AI Rights & Contract Intelligence System
## Project Context, Architecture & Build Blueprint
> H2S Build with AI Hackathon | Google for Developers | 5-Hour Sprint

---

## 1. VISION & PHILOSOPHY

LEXGUARD is not another AI document summarizer. It is an **adversarial intelligence layer** that sits between a person and an agreement they are about to sign — and fights for them.

The core insight: most people sign contracts without reading them. Of those who read them, most cannot identify which clauses are dangerous. Of those who identify danger, most don't know how to negotiate or what the real-world consequences are. LEXGUARD closes all three gaps simultaneously.

**The adversarial design principle** is what sets this apart from every other "AI lawyer" tool:
- Most tools have one AI agent summarize a document. We have multiple agents in tension with each other.
- Agent A finds every risk. Agent B steelmans why the clause might be acceptable. Agent C scores the disagreement. Agent D gives you the verdict and negotiation script.
- The output isn't a summary — it's a **battle-tested risk assessment** where the AI has already argued both sides.

**Who is the user?**
- A fresher reading their first job offer letter
- A freelancer reviewing a client services agreement
- A consumer about to click "I agree" on a SaaS ToS
- A small business owner reviewing a supplier quotation
- A tenant reviewing a lease agreement

These are not lawyers. They are people who deserve the same protection that a lawyer would give them, delivered in plain English, in under 60 seconds.

---

## 2. PROBLEM STATEMENT DECODED

The challenge asks for an **adversarial multi-agent AI system** that handles:
- Contracts (employment, service, vendor, NDA)
- Offer letters (compensation, IP assignment, non-compete)
- Quotations (payment terms, liability caps, delivery conditions)
- Ticket terms (refund policies, force majeure, data capture)
- Online policies (ToS, privacy policies, cookie consent)

### The Four Harms to Detect
1. **Exploitative clauses** — terms that unfairly benefit one party (e.g., "employer may change compensation at any time without notice")
2. **Hidden liabilities** — obligations buried in definitions or annexures (e.g., "you indemnify us for all third-party claims")
3. **Legal ambiguities** — vague language that will be interpreted against you in court (e.g., "reasonable efforts" without definition)
4. **Real-world risks** — clauses that are legal but practically devastating (e.g., a non-compete so broad it prevents you from working in your field)

---

## 3. THE MULTI-AGENT ARCHITECTURE (Core Technical Innovation)

This is the most important section. The adversarial multi-agent design is your primary differentiator among 200 teams.

```
                         ┌─────────────────────────────────────────────┐
                         │              DOCUMENT INGESTION              │
                         │   (PDF / DOCX / Plain Text / URL paste)      │
                         └──────────────────────┬──────────────────────┘
                                                │
                         ┌──────────────────────▼──────────────────────┐
                         │           AGENT 0: ORCHESTRATOR              │
                         │  Routes document to correct analysis chain   │
                         │  Detects document type and jurisdiction hints │
                         └──────┬──────────┬──────────┬───────┬────────┘
                                │          │          │       │
               ┌────────────────▼──┐  ┌───▼──────┐  │  ┌────▼────────┐
               │  AGENT 1:         │  │ AGENT 2: │  │  │  AGENT 3:   │
               │  EXTRACTOR        │  │ RISK     │  │  │  DEVIL'S    │
               │                   │  │ HUNTER   │  │  │  ADVOCATE   │
               │  Segments the doc │  │          │  │  │             │
               │  into numbered    │  │ Flags    │  │  │  For each   │
               │  clauses. Builds  │  │ each     │  │  │  flagged    │
               │  a clause map     │  │ clause   │  │  │  clause,    │
               │  with metadata    │  │ against  │  │  │  argues why │
               │  (type, position, │  │ a risk   │  │  │  it might   │
               │  party affected)  │  │ taxonomy │  │  │  be OK      │
               └────────────────┬──┘  └───┬──────┘  │  └────┬────────┘
                                │         │         │       │
                         ┌──────▼─────────▼─────────▼───────▼────────┐
                         │              AGENT 4: SYNTHESIS             │
                         │                                             │
                         │  Weighs Risk Hunter vs Devil's Advocate     │
                         │  Assigns a LEXSCORE (0–100)                 │
                         │  Generates plain English risk card per      │
                         │  clause with: severity, explanation,        │
                         │  negotiation script, red-line suggestion    │
                         └──────────────────────┬──────────────────────┘
                                                │
                         ┌──────────────────────▼──────────────────────┐
                         │           AGENT 5: COMPARATOR                │
                         │  Benchmarks clauses against industry norms   │
                         │  "This non-compete is broader than 94%       │
                         │   of standard tech employment contracts"      │
                         └──────────────────────┬──────────────────────┘
                                                │
                         ┌──────────────────────▼──────────────────────┐
                         │              FINAL REPORT OUTPUT             │
                         │  LEXSCORE + Per-clause risk cards +          │
                         │  Negotiation scripts + Red-line document     │
                         └─────────────────────────────────────────────┘
```

### Agent Prompts (Copy-paste ready for your codebase)

#### Agent 0 — Orchestrator
```
You are the Orchestrator of a legal document analysis system. You receive a raw document.

Your tasks:
1. Identify the document type: [employment_contract, service_agreement, nda, offer_letter, quotation, terms_of_service, privacy_policy, lease, other]
2. Identify the weaker party: [employee, contractor, consumer, tenant, buyer, user, unknown]
3. Identify any jurisdiction signals (country, state references)
4. Estimate document complexity: [simple, moderate, complex]

Return ONLY valid JSON:
{
  "doc_type": "...",
  "weaker_party": "...",
  "jurisdiction_hints": ["..."],
  "complexity": "...",
  "proceed": true
}
```

#### Agent 1 — Extractor
```
You are a legal document parser. You receive a full document text.

Extract every distinct clause or provision as a numbered list. For each clause:
- Assign a clause_id (C001, C002, ...)
- Identify the clause_type (e.g., compensation, termination, ip_assignment, non_compete, indemnification, limitation_of_liability, data_use, dispute_resolution, governing_law, auto_renewal, confidentiality, unilateral_modification)
- Extract the verbatim text
- Identify which party this clause primarily affects

Return ONLY valid JSON:
{
  "clauses": [
    {
      "clause_id": "C001",
      "clause_type": "...",
      "text": "...",
      "affects_party": "..."
    }
  ]
}
```

#### Agent 2 — Risk Hunter
```
You are an aggressive legal risk analyst hired to protect the weaker party in a contract.

Document type: {{doc_type}}
Weaker party: {{weaker_party}}

For each clause provided, assess it for:
- EXPLOIT: Does this clause unfairly advantage the stronger party?
- LIABILITY: Does this create hidden or disproportionate liability?
- AMBIGUITY: Is the language vague in a way that will be interpreted against the weaker party?
- PRACTICAL_RISK: Is this legal but practically devastating?
- MISSING: Is a standard protection clause absent that should be present?

Risk severity: [CRITICAL, HIGH, MEDIUM, LOW, CLEAN]

Return ONLY valid JSON:
{
  "risk_assessments": [
    {
      "clause_id": "C001",
      "risk_type": "EXPLOIT",
      "severity": "CRITICAL",
      "legal_basis": "...",
      "plain_english": "...",
      "worst_case_scenario": "..."
    }
  ]
}
```

#### Agent 3 — Devil's Advocate
```
You are a defense attorney representing the company/stronger party in this agreement.

For each flagged risk, construct the strongest possible argument for why the clause is:
- Industry standard
- Legally necessary
- Practically reasonable
- Balanced when read in full context

Be genuinely persuasive. Do not strawman. If the clause is genuinely indefensible, say so.

Return ONLY valid JSON:
{
  "defenses": [
    {
      "clause_id": "C001",
      "defense_strength": "STRONG | MODERATE | WEAK | INDEFENSIBLE",
      "argument": "...",
      "counterpoint_weakness": "..."
    }
  ]
}
```

#### Agent 4 — Synthesis
```
You are the final arbiter in a legal risk review panel.

You have received:
- Risk Hunter's assessment of flagged clauses
- Devil's Advocate's defense of each clause

For each clause, synthesize both perspectives and produce:
1. FINAL_VERDICT: [RED, AMBER, GREEN]
2. LEXSCORE_IMPACT: (-10 to 0) per clause on a 100-point document scale
3. PLAIN_ENGLISH: A single sentence explaining the real risk to a non-lawyer
4. NEGOTIATION_SCRIPT: Exact words the user can say/write to push back
5. SUGGESTED_REDLINE: A rewritten version of the clause that would be fair

Also compute the overall LEXSCORE for the document (100 = perfectly fair, 0 = predatory).

Return ONLY valid JSON with the full synthesis object.
```

#### Agent 5 — Comparator
```
You are a contract benchmarking expert with knowledge of industry-standard terms across tech, finance, healthcare, retail, and professional services.

For each RED or AMBER clause, provide:
1. How common is this clause in standard contracts in this industry? (percentage estimate)
2. Is this clause more or less aggressive than typical?
3. What do top-tier companies typically offer instead?
4. Any notable legal precedents or regulatory context?

Return ONLY valid JSON benchmarking object.
```

---

## 4. TECHNOLOGY STACK

### Frontend
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 14 (App Router) | SSR for first load, streaming for AI responses |
| Styling | Tailwind CSS + Framer Motion | Fast, animated, polished |
| PDF Viewer | react-pdf | Show document alongside analysis |
| State | Zustand | Lightweight, works well with streaming |
| Upload | react-dropzone | Drag-and-drop PDF/DOCX |

### Backend
| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Python FastAPI | Fast async, great for streaming AI responses |
| AI Orchestration | LangChain OR direct Anthropic SDK | Agent chaining |
| AI Model | Claude claude-sonnet-4-20250514 (Anthropic) | Best instruction-following for structured JSON |
| Doc Parsing | PyMuPDF (fitz) + python-docx | Handle PDF + DOCX |
| Background Jobs | FastAPI BackgroundTasks | Queue long analyses |

### GCP Services to Use
| Service | Usage | Why It Matters for Judging |
|---------|-------|--------------------------|
| **Cloud Run** | Deploy FastAPI backend | Auto-scales, no infra management, stable |
| **Firebase Hosting** | Deploy Next.js frontend | Fast CDN, custom domain |
| **Firestore** | Store analysis results, user sessions | Real-time, serverless |
| **Cloud Storage** | Store uploaded documents (temp) | GDPR-friendly: set 24h auto-delete |
| **Secret Manager** | Store Anthropic API key | Security best practice |
| **Cloud Logging** | Structured logs from all agents | Shows production-readiness |
| **Cloud Armor** | Basic DDoS protection on Cloud Run | Stability under load |
| **Vertex AI** | Optional: Gemini Flash for initial OCR/extraction | Shows GCP ecosystem depth |

> **Judging Tip**: Using 5+ GCP services coherently signals production maturity. Make sure Cloud Run health checks are enabled. Set up uptime monitoring under Cloud Monitoring for extra points on "platform stability."

### Document Processing
```python
# PDF extraction pipeline
import fitz  # PyMuPDF

def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text("text")
    return text

# DOCX extraction
from docx import Document
import io

def extract_text_from_docx(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
```

---

## 5. PROJECT FILE STRUCTURE

```
lexguard/
├── frontend/                          # Next.js app
│   ├── app/
│   │   ├── page.tsx                   # Landing / upload page
│   │   ├── analyze/[id]/page.tsx      # Analysis results page (streaming)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── DocumentUpload.tsx         # Drag-drop upload with preview
│   │   ├── LexScore.tsx               # Animated score gauge (0–100)
│   │   ├── ClauseCard.tsx             # Per-clause risk card (RED/AMBER/GREEN)
│   │   ├── AgentThinking.tsx          # Live streaming agent status
│   │   ├── NegotiationScript.tsx      # Copy-paste pushback text
│   │   └── RedlineModal.tsx           # Suggested clause rewrites
│   ├── lib/
│   │   ├── api.ts                     # API calls to backend
│   │   └── types.ts                   # Shared TypeScript types
│   ├── Dockerfile
│   └── package.json
│
├── backend/                           # FastAPI app
│   ├── main.py                        # App entrypoint, routes
│   ├── agents/
│   │   ├── orchestrator.py            # Agent 0
│   │   ├── extractor.py               # Agent 1
│   │   ├── risk_hunter.py             # Agent 2
│   │   ├── devils_advocate.py         # Agent 3
│   │   ├── synthesis.py               # Agent 4
│   │   └── comparator.py             # Agent 5
│   ├── services/
│   │   ├── document_parser.py         # PDF/DOCX → text
│   │   ├── firestore_service.py       # DB operations
│   │   └── storage_service.py        # GCS upload/delete
│   ├── models/
│   │   └── schemas.py                 # Pydantic models
│   ├── utils/
│   │   └── streaming.py              # SSE streaming helper
│   ├── requirements.txt
│   └── Dockerfile
│
├── infrastructure/
│   ├── cloudbuild.yaml                # CI/CD pipeline
│   ├── cloud-run-backend.yaml         # Cloud Run service config
│   └── firestore.rules               # Security rules
│
├── CONTEXT.md                         # This file
└── README.md
```

---

## 6. API DESIGN

### Core Endpoints

```
POST /api/analyze
  Body: multipart/form-data { file: File | text: string }
  Response: { analysis_id: string }
  → Kicks off background analysis, returns ID immediately

GET /api/analyze/{id}/stream
  Response: Server-Sent Events (SSE)
  → Streams agent progress in real-time:
    data: {"agent": "extractor", "status": "running", "progress": 20}
    data: {"agent": "risk_hunter", "status": "complete", "clauses_flagged": 7}
    data: {"type": "result", "data": {...full analysis object...}}

GET /api/analyze/{id}
  Response: Full analysis JSON (for page refresh / sharing)

POST /api/analyze/{id}/chat
  Body: { message: string }
  Response: SSE stream
  → Ask follow-up questions about the document ("What happens if I don't sign the NDA?")

GET /api/health
  Response: { status: "ok", agents: [...], version: "..." }
  → Cloud Run health check endpoint
```

### Full Analysis Response Schema
```typescript
interface LexGuardAnalysis {
  analysis_id: string;
  doc_type: string;
  weaker_party: string;
  lexscore: number;           // 0–100
  lexscore_label: "PREDATORY" | "HIGH_RISK" | "MODERATE" | "FAIR" | "EXCELLENT";
  created_at: string;
  
  summary: {
    total_clauses: number;
    red_clauses: number;
    amber_clauses: number;
    green_clauses: number;
    critical_issues: string[];    // Top 3 plain-English warnings
  };
  
  clauses: ClauseAnalysis[];
  missing_protections: string[]; // Clauses that SHOULD be there but aren't
  document_benchmark: {
    percentile: number;          // "Riskier than 87% of similar contracts"
    industry_comparison: string;
  };
}

interface ClauseAnalysis {
  clause_id: string;
  clause_type: string;
  original_text: string;
  verdict: "RED" | "AMBER" | "GREEN";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  risk_type: string;
  plain_english: string;        // "They can fire you without notice or reason"
  worst_case: string;           // "You could lose 2 years of unvested stock"
  defense_argument: string;     // Devil's advocate position
  defense_strength: string;
  negotiation_script: string;   // "I'd like to propose we change this to..."
  suggested_redline: string;    // Rewritten fair version
  industry_norm: string;        // Benchmark context
}
```

---

## 7. THE LEXSCORE

The LEXSCORE is your product's signature metric. It should be front and center.

```
100 — EXCELLENT    Contract is unusually fair. Sign with confidence.
80–99 — GOOD       Minor items to note. Mostly standard and acceptable.
60–79 — MODERATE   Several amber clauses. Negotiate before signing.
40–59 — HIGH RISK  Multiple red clauses. Get advice before signing.
20–39 — PREDATORY  Seriously imbalanced. Do not sign as-is.
0–19  — HOSTILE    Almost certainly exploitative. Walk away or get a lawyer.
```

**Score calculation** (in Agent 4 synthesis):
- Start at 100
- CRITICAL clause: -15 points
- HIGH clause: -8 points  
- MEDIUM clause: -4 points
- LOW clause: -1 point
- Missing protection: -5 points each
- Each INDEFENSIBLE defense: additional -3 points
- Each STRONG defense: +2 points (softens the impact)
- Floor: 0

---

## 8. STREAMING ARCHITECTURE (Real-time UX Differentiator)

The analysis takes 15–45 seconds. Don't show a spinner. Show the agents *working*.

```python
# backend/utils/streaming.py
from fastapi.responses import StreamingResponse
import json
import asyncio

async def stream_analysis(analysis_id: str, document_text: str):
    async def event_generator():
        yield f"data: {json.dumps({'agent': 'orchestrator', 'status': 'running'})}\n\n"
        
        # Run orchestrator
        doc_meta = await orchestrator.run(document_text)
        yield f"data: {json.dumps({'agent': 'orchestrator', 'status': 'complete', 'result': doc_meta})}\n\n"
        
        # Run extractor
        yield f"data: {json.dumps({'agent': 'extractor', 'status': 'running'})}\n\n"
        clauses = await extractor.run(document_text)
        yield f"data: {json.dumps({'agent': 'extractor', 'status': 'complete', 'clause_count': len(clauses)})}\n\n"
        
        # Run risk_hunter and devils_advocate in PARALLEL
        yield f"data: {json.dumps({'agent': 'risk_hunter', 'status': 'running'})}\n\n"
        yield f"data: {json.dumps({'agent': 'devils_advocate', 'status': 'running'})}\n\n"
        
        risks, defenses = await asyncio.gather(
            risk_hunter.run(clauses, doc_meta),
            devils_advocate.run(clauses, doc_meta)
        )
        
        yield f"data: {json.dumps({'agent': 'risk_hunter', 'status': 'complete', 'flagged': len(risks)})}\n\n"
        yield f"data: {json.dumps({'agent': 'devils_advocate', 'status': 'complete'})}\n\n"
        
        # Synthesis
        yield f"data: {json.dumps({'agent': 'synthesis', 'status': 'running'})}\n\n"
        synthesis = await synthesis_agent.run(clauses, risks, defenses)
        yield f"data: {json.dumps({'agent': 'synthesis', 'status': 'complete'})}\n\n"
        
        # Comparator
        yield f"data: {json.dumps({'agent': 'comparator', 'status': 'running'})}\n\n"
        benchmark = await comparator.run(synthesis, doc_meta)
        
        # Final result
        final_result = build_final_result(doc_meta, clauses, synthesis, benchmark)
        await save_to_firestore(analysis_id, final_result)
        
        yield f"data: {json.dumps({'type': 'complete', 'data': final_result})}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## 9. FIVE-HOUR SPRINT PLAN

### Hour 1 (0:00–1:00) — Foundation
- [ ] Set up Next.js frontend with Tailwind
- [ ] Set up FastAPI backend skeleton
- [ ] Implement document upload (PDF + DOCX + plain text paste)
- [ ] Implement text extraction (PyMuPDF + python-docx)
- [ ] Connect to Anthropic API with a simple single-agent smoke test

### Hour 2 (1:00–2:00) — Core Agents
- [ ] Implement Agent 0 (Orchestrator) with JSON parsing
- [ ] Implement Agent 1 (Extractor)
- [ ] Implement Agent 2 (Risk Hunter)
- [ ] Run these three in sequence on a test contract
- [ ] Verify structured JSON output for all three

### Hour 3 (2:00–3:00) — Adversarial Layer + Synthesis
- [ ] Implement Agent 3 (Devil's Advocate)
- [ ] Run Agent 2 + 3 in parallel with asyncio.gather
- [ ] Implement Agent 4 (Synthesis + LEXSCORE)
- [ ] Implement Agent 5 (Comparator)
- [ ] Implement SSE streaming endpoint
- [ ] Implement Firestore save/retrieve

### Hour 4 (3:00–4:00) — Frontend Polish
- [ ] Build the upload page (drag-drop, paste, URL)
- [ ] Build the streaming analysis page (live agent status)
- [ ] Build the results page:
  - LEXSCORE gauge (animated)
  - RED/AMBER/GREEN clause cards
  - Negotiation script cards
  - Redline suggestions
- [ ] Follow-up chat interface

### Hour 5 (4:00–5:00) — Deploy + Demo Prep
- [ ] Dockerize both services
- [ ] Deploy backend to Cloud Run
- [ ] Deploy frontend to Firebase Hosting
- [ ] Set up Cloud Storage with 24h auto-delete lifecycle rule
- [ ] Store API key in Secret Manager
- [ ] Enable Cloud Logging
- [ ] Set up uptime check in Cloud Monitoring
- [ ] Write 5–6 demo test documents (one employment contract, one ToS, one NDA)
- [ ] Do a full end-to-end test run
- [ ] Record a 2-minute demo video

> **If time is short**: Cut Agent 5 (Comparator) and the follow-up chat. The core adversarial loop (Agents 0–4) + streaming + LEXSCORE is the MVP that judges will evaluate.

---

## 10. DEMO DOCUMENTS (Test with these)

Prepare these exact contracts for your demo. They have known high-risk clauses that will produce a dramatic LEXSCORE.

**Employment Contract Red Flags to include**:
- "Employment is at-will and may be terminated for any reason without notice"
- "All inventions created outside working hours remain the property of the Company if they relate to the Company's business"
- "Employee agrees not to work for any competitor for 2 years post-employment within a 50-mile radius"
- "Company may modify compensation at its sole discretion"

**SaaS ToS Red Flags**:
- "We may share your data with third-party partners for marketing purposes"
- "We reserve the right to terminate your account without notice or refund"
- "By using this service, you grant us a perpetual, irrevocable license to your content"
- "This agreement shall be governed by the laws of [obscure jurisdiction]"

**Freelance Contract Red Flags**:
- "Payment terms are net-90"
- "Client may request unlimited revisions without additional charge"
- "Contractor warrants that all work is original and indemnifies client against all IP claims"

---

## 11. WHAT MAKES THIS STAND OUT (Judge Perspective)

### vs. 90% of other teams who will build:
- Single AI summarizer with "risk score" → Generic
- ChatGPT wrapper with document upload → No architecture
- A list of bullet points saying "risky clause found" → No actionability

### LEXGUARD differentiators:
1. **Adversarial architecture**: Agents arguing with each other is novel and explainable
2. **LEXSCORE**: A single number that tells the story immediately — extremely demo-able
3. **Negotiation scripts**: Not just "this is risky" but "here's what to SAY"
4. **Redline suggestions**: Not just flag but FIX
5. **Streaming with visible agents**: Watching AI agents "think" is compelling live demo
6. **Missing clause detection**: Flagging what's NOT there is advanced legal reasoning
7. **Devil's Advocate agent**: Shows intellectual honesty — not just FUD, actual analysis

### Code quality signals to demonstrate:
- Pydantic models for all API I/O (type safety)
- Proper error handling with structured error responses
- Async/await throughout backend (not blocking)
- Agents are independently testable (pure functions taking JSON in, JSON out)
- Environment variables via Secret Manager (not hardcoded)
- Structured Cloud Logging with request IDs
- Dockerfile with non-root user (security)
- CORS configured correctly (not `*` in production)

### Platform stability signals:
- Cloud Run min-instances: 1 (no cold start during demo)
- Health check endpoint `/api/health`
- Uptime monitoring configured
- Firestore retry logic on timeout
- File size limit enforced (10MB max upload)
- Rate limiting per IP (protect against abuse during demo)

---

## 12. FOLLOW-UP CHAT (Bonus Feature)

After analysis, users can ask:
- "What happens if I sign the non-compete as-is?"
- "How should I phrase my pushback on the IP clause?"
- "Is this indemnification clause normal for freelance work?"
- "Which clause is the single most important one to negotiate?"

The chat agent has the full document + analysis in context:
```python
system_prompt = f"""
You are LEXGUARD's legal assistant. You have analyzed the following document:
- Document type: {doc_type}
- LEXSCORE: {lexscore}/100
- Critical issues: {critical_issues}
- Full clause analysis: {json.dumps(clause_analysis)}

Answer the user's questions about this specific document. 
Be direct, practical, and speak as if you are their advocate.
Do not give formal legal advice — give the kind of honest guidance a smart friend who happens to be a lawyer would give.
"""
```

---

## 13. GCP ARCHITECTURE DIAGRAM

```
                    ┌──────────────────┐
                    │   Firebase       │
                    │   Hosting        │
                    │   (Next.js)      │
                    └────────┬─────────┘
                             │ HTTPS
                    ┌────────▼─────────┐
                    │   Cloud Armor    │  ← DDoS protection
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   Cloud Run      │  ← FastAPI backend
                    │   (Auto-scale)   │     min-instances: 1
                    └────┬────┬────────┘
                         │    │
           ┌─────────────┘    └──────────────────┐
           │                                      │
  ┌────────▼────────┐                   ┌─────────▼────────┐
  │   Firestore     │                   │  Cloud Storage    │
  │   (Results DB)  │                   │  (Temp docs)      │
  └─────────────────┘                   │  Auto-delete 24h  │
                                        └──────────────────┘
           │
  ┌────────▼────────┐
  │  Secret Manager │  ← Anthropic API key
  └─────────────────┘
           │
  ┌────────▼────────┐
  │  Cloud Logging  │  ← Structured logs from all agents
  └─────────────────┘
           │
  ┌────────▼────────┐
  │Cloud Monitoring │  ← Uptime checks, alerting
  └─────────────────┘
```

---

## 14. ENVIRONMENT VARIABLES

```bash
# Backend (.env / Secret Manager)
ANTHROPIC_API_KEY=sk-ant-...
GCP_PROJECT_ID=lexguard-hackathon
GCS_BUCKET_NAME=lexguard-docs-temp
FIRESTORE_COLLECTION=analyses
ENVIRONMENT=production

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=https://lexguard-backend-xxx-uc.a.run.app
NEXT_PUBLIC_GA_ID=...
```

---

## 15. DEPLOYMENT COMMANDS (5-minute deploy)

```bash
# 1. Enable required APIs
gcloud services enable run.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com

# 2. Store API key
echo -n "YOUR_ANTHROPIC_KEY" | gcloud secrets create anthropic-api-key \
  --data-file=- --replication-policy=automatic

# 3. Deploy backend
cd backend
gcloud run deploy lexguard-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 10 \
  --memory 2Gi \
  --set-secrets ANTHROPIC_API_KEY=anthropic-api-key:latest

# 4. Deploy frontend
cd ../frontend
firebase deploy --only hosting

# 5. Set up uptime check (via console or CLI)
gcloud monitoring uptime-check-configs create \
  --display-name="LEXGUARD Backend Health" \
  --http-check-path="/api/health" \
  --hostname="lexguard-backend-xxx-uc.a.run.app"
```

---

## 16. PITCH NARRATIVE (2-minute demo script)

> "Every year, millions of people sign contracts they don't understand. That's not a legal problem — it's an information asymmetry problem. LEXGUARD fixes that.
>
> Watch what happens when I upload this employment contract. Five AI agents immediately get to work — one extracts every clause, one aggressively flags every risk, one argues the other side, one synthesizes the debate, and one benchmarks everything against industry standards.
>
> In 30 seconds, LEXGUARD tells me this contract scores 34 out of 100 — PREDATORY. It found a non-compete clause that's broader than 91% of comparable contracts. Here's the specific language that's dangerous, here's why, and here's exactly what I should SAY in my reply email.
>
> LEXGUARD doesn't just identify danger. It gives you the words to fight back."

---

*Built in 5 hours. Powered by Claude, Google Cloud, and the belief that everyone deserves to understand what they're signing.*
