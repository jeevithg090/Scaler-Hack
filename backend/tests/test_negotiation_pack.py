from __future__ import annotations

from services.negotiation_pack import briefing_script, build_negotiation_pack, top_risky_clauses


def _clause(cid, verdict, **extra):
    return {"clause_id": cid, "verdict": verdict, "clause_type": "non_compete", **extra}


def test_top_risky_orders_red_before_amber_and_limits():
    data = {
        "clauses": [
            _clause("C3", "AMBER"),
            _clause("C2", "GREEN"),
            _clause("C9", "RED"),
            _clause("C1", "RED"),
        ]
    }
    assert [c["clause_id"] for c in top_risky_clauses(data)] == ["C1", "C9", "C3"]
    assert len(top_risky_clauses(data, limit=1)) == 1


def test_pack_without_risky_clauses():
    pack = build_negotiation_pack({"analysis_id": "a1", "lexscore": 95, "clauses": []})
    assert "No RED/AMBER clauses detected." in pack
    assert pack.endswith("\n")


def test_pack_contains_redlines_and_email():
    data = {
        "analysis_id": "a1",
        "lexscore": 40,
        "lexscore_label": "HIGH_RISK",
        "doc_type": "employment_contract",
        "clauses": [
            _clause(
                "C1",
                "RED",
                negotiation_script="Limit to 6 months.",
                original_text="2 year non-compete",
                suggested_redline="6 month non-compete",
            )
        ],
    }
    pack = build_negotiation_pack(data)
    assert "LEXSCORE: 40 (HIGH RISK)" in pack
    assert "Document Type: employment contract" in pack
    assert "### 1. C1 — non compete" in pack
    assert "- C1: Limit to 6 months." in pack
    assert "Current:\n2 year non-compete" in pack
    assert "Proposed:\n6 month non-compete" in pack


def test_briefing_script():
    assert "no major issues" in briefing_script({"lexscore": 90})
    script = briefing_script({"lexscore": 30, "summary": {"critical_issues": ["IP grab"]}})
    assert "30 out of 100" in script and "IP grab" in script
