from __future__ import annotations

import pytest

from services import analysis_store, pipeline
from tests.conftest import (
    SAMPLE_BENCHMARK,
    SAMPLE_CLAUSES,
    SAMPLE_DEFENSES,
    SAMPLE_META,
    SAMPLE_RISKS,
    SAMPLE_SYNTHESIS,
)


def _build():
    return pipeline.build_final_result(
        "a1",
        SAMPLE_META,
        SAMPLE_CLAUSES,
        SAMPLE_RISKS,
        SAMPLE_DEFENSES,
        SAMPLE_SYNTHESIS,
        SAMPLE_BENCHMARK,
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, "PRACTICAL_RISK"),
        ("exploit", "EXPLOIT"),
        ("Liabilities", "LIABILITY"),
        ("practical-risk", "PRACTICAL_RISK"),
        ("ambiguous", "AMBIGUITY"),
        ("nonsense", "PRACTICAL_RISK"),
    ],
)
def test_normalize_risk_type(raw, expected):
    assert pipeline._normalize_risk_type(raw) == expected


@pytest.mark.parametrize(
    ("severity", "defense", "verdict", "expected"),
    [
        ("CRITICAL", "WEAK", "RED", "HIGH"),
        ("HIGH", "", "AMBER", "HIGH"),
        ("LOW", "STRONG", "AMBER", "LOW"),
        ("HIGH", "STRONG", "RED", "MEDIUM"),
        ("CRITICAL", "WEAK", "GREEN", "MEDIUM"),
    ],
)
def test_confidence_for_clause(severity, defense, verdict, expected):
    assert pipeline._confidence_for_clause(severity, defense, verdict) == expected


@pytest.mark.parametrize(
    ("score", "red", "amber", "recommendation"),
    [
        (30, 0, 0, "WALK_AWAY"),
        (90, 3, 0, "WALK_AWAY"),
        (70, 0, 0, "NEGOTIATE_FIRST"),
        (90, 1, 0, "NEGOTIATE_FIRST"),
        (90, 0, 2, "NEGOTIATE_FIRST"),
        (90, 0, 1, "SIGN"),
    ],
)
def test_action_plan_thresholds(score, red, amber, recommendation):
    assert pipeline._derive_action_plan(score, red, amber, []).recommendation == recommendation


def test_safe_text_snippet_truncates():
    assert pipeline._safe_text_snippet("a  b\n c") == "a b c"
    snippet = pipeline._safe_text_snippet("x" * 300, limit=10)
    assert len(snippet) == 10 and snippet.endswith("…")


def test_build_final_result_merges_agent_outputs():
    result = _build()

    assert result.summary.total_clauses == 3
    assert (result.summary.red_clauses, result.summary.amber_clauses) == (1, 1)
    assert result.summary.green_clauses == 1
    assert result.summary.critical_issues == SAMPLE_SYNTHESIS["critical_issues"][:3]
    # RED first, then AMBER, then GREEN
    assert [c.clause_id for c in result.clauses] == ["C001", "C002", "C003"]

    red = result.clauses[0]
    assert red.original_text == "Employer may terminate at will."
    assert red.plain_english == "They can fire you anytime."  # falls back to risk hunter
    assert red.defense_strength == "WEAK"  # falls back to devil's advocate
    assert red.industry_norm == "30 days notice is typical."
    assert red.confidence == "HIGH"
    assert red.risk_type == "EXPLOIT"

    assert result.risk_taxonomy_counts.LIABILITY == 1
    assert result.adversarial_metrics.disagreements_count == 1  # C002 AMBER vs STRONG defense
    assert result.adversarial_metrics.defensible_clauses == 1  # C003 GREEN + STRONG
    assert result.action_plan.recommendation == "NEGOTIATE_FIRST"
    assert result.document_benchmark.percentile == 80


def test_build_final_result_clamps_score():
    synthesis = {**SAMPLE_SYNTHESIS, "lexscore": 140}
    result = pipeline.build_final_result("a1", {}, [], [], [], synthesis, {})
    assert result.lexscore == 100
    assert result.doc_type == "other"


async def test_run_analysis_emits_events_and_saves(fake_agents):
    analysis_id = analysis_store.create_analysis("doc")
    received = []

    async def on_event(event):
        received.append(event)

    final = await pipeline.run_analysis(analysis_id, "doc", emit=on_event)

    record = analysis_store.get_analysis(analysis_id)
    assert record["status"] == "complete"
    assert record["lexscore"] == final.lexscore == 62
    events = record["events"]
    assert events[-1] == {"type": "complete"}
    assert received == events
    agents_done = [e["agent"] for e in events if e.get("status") == "complete"]
    assert agents_done == [
        "orchestrator",
        "extractor",
        "risk_hunter",
        "devils_advocate",
        "synthesis",
        "comparator",
    ]
