from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from agents import comparator, devils_advocate, extractor, orchestrator, risk_hunter, synthesis
from models.schemas import (
    ActionPlan,
    AdversarialMetrics,
    AnalysisSummary,
    ClauseAnalysis,
    DocumentBenchmark,
    LexGuardAnalysis,
    RiskTaxonomyCounts,
)
from services import analysis_store

EventCallback = Callable[[dict[str, Any]], Awaitable[None]]
RISK_TYPES = {"EXPLOIT", "LIABILITY", "AMBIGUITY", "PRACTICAL_RISK", "MISSING"}
VERDICT_RANK = {"RED": 3, "AMBER": 2, "GREEN": 1}


def _index_by_id(items: list[dict], key: str = "clause_id") -> dict[str, dict]:
    return {item.get(key, ""): item for item in items if item.get(key)}


def _safe_text_snippet(text: str, limit: int = 240) -> str:
    compact = " ".join((text or "").split())
    if len(compact) <= limit:
        return compact
    return f"{compact[: limit - 1]}…"


def _normalize_risk_type(value: str | None) -> str:
    if not value:
        return "PRACTICAL_RISK"
    up = value.strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        "PRACTICAL": "PRACTICAL_RISK",
        "PRACTICALRISKS": "PRACTICAL_RISK",
        "AMBIGUOUS": "AMBIGUITY",
        "LIABILITIES": "LIABILITY",
        "EXPLOITATIVE": "EXPLOIT",
    }
    normalized = aliases.get(up, up)
    return normalized if normalized in RISK_TYPES else "PRACTICAL_RISK"


def _confidence_for_clause(severity: str, defense_strength: str, verdict: str) -> str:
    sev = (severity or "").upper()
    defense = (defense_strength or "").upper()
    if verdict == "GREEN":
        return "MEDIUM"
    if sev in {"CRITICAL", "HIGH"} and defense in {"WEAK", "INDEFENSIBLE", ""}:
        return "HIGH"
    if sev in {"MEDIUM", "LOW"} and defense == "STRONG":
        return "LOW"
    return "MEDIUM"


def _derive_action_plan(
    lexscore: int, red: int, amber: int, critical_issues: list[str]
) -> ActionPlan:
    if lexscore < 40 or red >= 3:
        return ActionPlan(
            recommendation="WALK_AWAY",
            urgency="IMMEDIATE",
            rationale="Multiple severe clauses create disproportionate downside for the weaker party.",
            downside_if_ignored="You may accept legal and financial obligations that are difficult to reverse later.",
            next_steps=[
                "Do not sign as-is.",
                "Request a revised draft with the proposed redlines.",
                "Escalate to a legal professional before proceeding.",
            ],
        )
    if lexscore < 80 or red > 0 or amber >= 2:
        return ActionPlan(
            recommendation="NEGOTIATE_FIRST",
            urgency="HIGH" if red > 0 else "MEDIUM",
            rationale="The agreement has negotiable risk hotspots that should be improved before signing.",
            downside_if_ignored="You may lock in unfavorable terms that reduce leverage after signature.",
            next_steps=[
                "Start with the top 3 risky clauses.",
                "Use the negotiation scripts and proposed redlines.",
                "Re-run analysis on the revised version before accepting.",
            ],
        )
    return ActionPlan(
        recommendation="SIGN",
        urgency="LOW",
        rationale="No major adversarial risks were detected in the reviewed clauses.",
        downside_if_ignored="Low immediate risk, but keep a signed copy and monitor obligations.",
        next_steps=[
            "Confirm final document version and signatory details.",
            "Retain the signed agreement and reminders for key dates.",
            "Track renewal/termination windows proactively.",
        ],
    )


def build_final_result(
    analysis_id: str,
    doc_meta: dict,
    clauses: list[dict],
    risks: list[dict],
    defenses: list[dict],
    synthesis_result: dict,
    benchmark_result: dict,
) -> LexGuardAnalysis:
    clause_map = _index_by_id(clauses)
    risk_map = _index_by_id(risks)
    defense_map = _index_by_id(defenses)
    bench_map = _index_by_id(benchmark_result.get("clause_benchmarks", []))

    clause_results = synthesis_result.get("clause_results", [])
    analyses: list[ClauseAnalysis] = []
    taxonomy_counts = {k: 0 for k in RISK_TYPES}

    red = amber = green = 0
    for cr in clause_results:
        verdict = cr.get("verdict", "GREEN")
        if verdict == "RED":
            red += 1
        elif verdict == "AMBER":
            amber += 1
        else:
            green += 1

        clause_id = cr.get("clause_id", "")
        orig = clause_map.get(clause_id, {})
        bench = bench_map.get(clause_id, {})
        risk = risk_map.get(clause_id, {})
        defense = defense_map.get(clause_id, {})
        normalized_risk_type = _normalize_risk_type(cr.get("risk_type") or risk.get("risk_type"))
        taxonomy_counts[normalized_risk_type] += 1
        severity = cr.get("severity", "LOW")
        defense_strength = cr.get("defense_strength", defense.get("defense_strength", ""))
        confidence = _confidence_for_clause(severity, defense_strength, verdict)
        analyses.append(
            ClauseAnalysis(
                clause_id=clause_id,
                clause_type=orig.get("clause_type", ""),
                original_text=orig.get("text", ""),
                verdict=verdict,
                severity=severity,
                risk_type=normalized_risk_type,
                plain_english=cr.get("plain_english", risk.get("plain_english", "")),
                worst_case=cr.get("worst_case", risk.get("worst_case_scenario", "")),
                defense_argument=cr.get("defense_argument", defense.get("argument", "")),
                defense_strength=defense_strength,
                negotiation_script=cr.get("negotiation_script", ""),
                suggested_redline=cr.get("suggested_redline", ""),
                industry_norm=bench.get("industry_norm", bench.get("typical_alternative", "")),
                confidence=confidence,
                evidence_snippet=_safe_text_snippet(orig.get("text", "")),
                risk_hunter_argument=risk.get("legal_basis", ""),
                defense_counterpoint=defense.get("counterpoint_weakness", ""),
            )
        )

    doc_bench = benchmark_result.get("document_benchmark", {})
    lexscore = int(synthesis_result.get("lexscore", 100))
    label = synthesis_result.get("lexscore_label", "FAIR")
    critical_issues = synthesis_result.get("critical_issues", [])[:3]
    action_plan = _derive_action_plan(lexscore, red, amber, critical_issues)

    disagreements = 0
    defenses_overturned = 0
    defensible = 0
    for clause in analyses:
        strength = (clause.defense_strength or "").upper()
        if clause.verdict in {"RED", "AMBER"} and strength in {"STRONG", "MODERATE"}:
            disagreements += 1
        if clause.verdict == "RED" and strength in {"STRONG", "MODERATE"}:
            defenses_overturned += 1
        if clause.verdict == "GREEN" and strength in {"STRONG", "MODERATE"}:
            defensible += 1

    # Keep the most important clauses first in all downstream UIs and exports.
    analyses.sort(key=lambda c: (-VERDICT_RANK.get(c.verdict, 0), c.clause_id))

    return LexGuardAnalysis(
        analysis_id=analysis_id,
        doc_type=doc_meta.get("doc_type", "other"),
        weaker_party=doc_meta.get("weaker_party", "unknown"),
        lexscore=max(0, min(100, lexscore)),
        lexscore_label=label,
        created_at=datetime.now(UTC).isoformat(),
        status="complete",
        summary=AnalysisSummary(
            total_clauses=len(clauses),
            red_clauses=red,
            amber_clauses=amber,
            green_clauses=green,
            critical_issues=critical_issues,
        ),
        clauses=analyses,
        missing_protections=synthesis_result.get("missing_protections", []),
        risk_taxonomy_counts=RiskTaxonomyCounts(**taxonomy_counts),
        action_plan=action_plan,
        adversarial_metrics=AdversarialMetrics(
            disagreements_count=disagreements,
            defenses_overturned=defenses_overturned,
            defensible_clauses=defensible,
        ),
        document_benchmark=DocumentBenchmark(
            percentile=int(doc_bench.get("percentile", 50)),
            industry_comparison=doc_bench.get("industry_comparison", ""),
        ),
        raw_meta={"orchestrator": doc_meta},
    )


async def run_analysis(
    analysis_id: str,
    document_text: str,
    emit: EventCallback | None = None,
) -> LexGuardAnalysis:
    async def _emit(event: dict[str, Any]) -> None:
        analysis_store.append_event(analysis_id, event)
        if emit:
            await emit(event)

    analysis_store.update_status(analysis_id, "running")

    # ── Agent 0: Orchestrator ──
    await _emit({"agent": "orchestrator", "status": "running"})
    doc_meta = await orchestrator.run(document_text)
    await _emit({"agent": "orchestrator", "status": "complete", "result": doc_meta})

    # ── Agent 1: Extractor ──
    await _emit({"agent": "extractor", "status": "running"})
    extracted = await extractor.run(document_text)
    clauses = extracted.get("clauses", [])
    await _emit(
        {
            "agent": "extractor",
            "status": "complete",
            "clause_count": len(clauses),
        }
    )

    # ── Agents 2 & 3: Risk Hunter, then Devil's Advocate rebutting its findings ──
    await _emit({"agent": "risk_hunter", "status": "running"})
    risks_result = await risk_hunter.run(clauses, doc_meta)
    risks = risks_result.get("risk_assessments", [])
    await _emit(
        {
            "agent": "risk_hunter",
            "status": "complete",
            "flagged": len(risks),
        }
    )

    await _emit({"agent": "devils_advocate", "status": "running"})
    defenses_result = await devils_advocate.run(risks, doc_meta)
    defenses = defenses_result.get("defenses", [])
    await _emit({"agent": "devils_advocate", "status": "complete"})

    # ── Agent 4: Synthesis ──
    await _emit({"agent": "synthesis", "status": "running"})
    synthesis_result = await synthesis.run(clauses, risks, defenses, doc_meta)
    await _emit({"agent": "synthesis", "status": "complete"})

    # ── Agent 5: Comparator ──
    await _emit({"agent": "comparator", "status": "running"})
    benchmark_result = await comparator.run(synthesis_result, doc_meta)
    await _emit({"agent": "comparator", "status": "complete"})

    final = build_final_result(
        analysis_id, doc_meta, clauses, risks, defenses, synthesis_result, benchmark_result
    )
    analysis_store.save_result(analysis_id, final)
    # The full result lives on the record; the stream endpoint attaches it to this marker.
    await _emit({"type": "complete"})
    return final
