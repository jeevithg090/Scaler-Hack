from __future__ import annotations

import os

# Force the in-memory store and a deterministic configuration before app modules import.
os.environ["ENVIRONMENT"] = "test"
os.environ["GCP_PROJECT_ID"] = ""
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from typing import Any  # noqa: E402

import pytest  # noqa: E402

from services import analysis_store  # noqa: E402


@pytest.fixture(autouse=True)
def memory_store():
    store = analysis_store.MemoryStore()
    analysis_store.set_store(store)
    yield store
    analysis_store.set_store(None)


SAMPLE_CLAUSES = [
    {"clause_id": "C001", "clause_type": "termination", "text": "Employer may terminate at will."},
    {"clause_id": "C002", "clause_type": "ip_assignment", "text": "All IP belongs to employer."},
    {"clause_id": "C003", "clause_type": "compensation", "text": "Salary is paid monthly."},
]
SAMPLE_RISKS = [
    {
        "clause_id": "C001",
        "risk_type": "exploit",
        "severity": "CRITICAL",
        "legal_basis": "Asymmetric termination",
        "plain_english": "They can fire you anytime.",
        "worst_case_scenario": "Fired without notice.",
    },
    {"clause_id": "C002", "risk_type": "Liabilities", "severity": "MEDIUM"},
]
SAMPLE_DEFENSES = [
    {"clause_id": "C001", "defense_strength": "WEAK", "argument": "Common in startups."},
    {"clause_id": "C002", "defense_strength": "STRONG", "argument": "Standard IP clause."},
]
SAMPLE_SYNTHESIS: dict[str, Any] = {
    "lexscore": 62,
    "lexscore_label": "MODERATE",
    "missing_protections": ["No severance"],
    "critical_issues": ["At-will termination", "Broad IP grab", "No severance", "Extra"],
    "clause_results": [
        {
            "clause_id": "C003",
            "verdict": "GREEN",
            "severity": "LOW",
            "defense_strength": "STRONG",
        },
        {
            "clause_id": "C001",
            "verdict": "RED",
            "severity": "CRITICAL",
            "negotiation_script": "Ask for 30 days notice.",
            "suggested_redline": "Either party may terminate with 30 days notice.",
        },
        {
            "clause_id": "C002",
            "verdict": "AMBER",
            "severity": "MEDIUM",
            "risk_type": "liability",
            "negotiation_script": "Carve out prior inventions.",
        },
    ],
}
SAMPLE_BENCHMARK = {
    "document_benchmark": {"percentile": 80, "industry_comparison": "Riskier than most."},
    "clause_benchmarks": [{"clause_id": "C001", "industry_norm": "30 days notice is typical."}],
}
SAMPLE_META = {"doc_type": "employment_contract", "weaker_party": "employee"}


@pytest.fixture
def fake_agents(monkeypatch):
    """Replace every Gemini-backed agent with canned responses."""
    from agents import comparator, devils_advocate, extractor, orchestrator, risk_hunter, synthesis

    async def _const(value):
        return value

    monkeypatch.setattr(orchestrator, "run", lambda *_: _const(SAMPLE_META))
    monkeypatch.setattr(extractor, "run", lambda *_: _const({"clauses": SAMPLE_CLAUSES}))
    monkeypatch.setattr(risk_hunter, "run", lambda *_: _const({"risk_assessments": SAMPLE_RISKS}))
    monkeypatch.setattr(devils_advocate, "run", lambda *_: _const({"defenses": SAMPLE_DEFENSES}))
    monkeypatch.setattr(synthesis, "run", lambda *_: _const(SAMPLE_SYNTHESIS))
    monkeypatch.setattr(comparator, "run", lambda *_: _const(SAMPLE_BENCHMARK))
