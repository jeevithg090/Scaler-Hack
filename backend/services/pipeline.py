from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Callable

from agents import comparator, devils_advocate, extractor, orchestrator, risk_hunter, synthesis
from models.schemas import (
    AnalysisSummary,
    ClauseAnalysis,
    DocumentBenchmark,
    LexGuardAnalysis,
)
from services import analysis_store

AwaitsEvent = Callable[[dict[str, Any]], Any]


def _index_by_id(items: list[dict], key: str = "clause_id") -> dict[str, dict]:
    return {item.get(key, ""): item for item in items if item.get(key)}


def build_final_result(
    analysis_id: str,
    doc_meta: dict,
    clauses: list[dict],
    synthesis_result: dict,
    benchmark_result: dict,
) -> LexGuardAnalysis:
    clause_map = _index_by_id(clauses)
    bench_map = _index_by_id(benchmark_result.get("clause_benchmarks", []))
    defenses_map: dict[str, dict] = {}

    clause_results = synthesis_result.get("clause_results", [])
    analyses: list[ClauseAnalysis] = []

    red = amber = green = 0
    for cr in clause_results:
        verdict = cr.get("verdict", "GREEN")
        if verdict == "RED":
            red += 1
        elif verdict == "AMBER":
            amber += 1
        else:
            green += 1

        orig = clause_map.get(cr.get("clause_id", ""), {})
        bench = bench_map.get(cr.get("clause_id", ""), {})
        analyses.append(
            ClauseAnalysis(
                clause_id=cr.get("clause_id", ""),
                clause_type=orig.get("clause_type", ""),
                original_text=orig.get("text", ""),
                verdict=verdict,
                severity=cr.get("severity", "LOW"),
                risk_type=cr.get("risk_type", ""),
                plain_english=cr.get("plain_english", ""),
                worst_case=cr.get("worst_case", ""),
                defense_argument=cr.get("defense_argument", ""),
                defense_strength=cr.get("defense_strength", ""),
                negotiation_script=cr.get("negotiation_script", ""),
                suggested_redline=cr.get("suggested_redline", ""),
                industry_norm=bench.get("industry_norm", bench.get("typical_alternative", "")),
            )
        )

    doc_bench = benchmark_result.get("document_benchmark", {})
    lexscore = int(synthesis_result.get("lexscore", 100))
    label = synthesis_result.get("lexscore_label", "FAIR")

    return LexGuardAnalysis(
        analysis_id=analysis_id,
        doc_type=doc_meta.get("doc_type", "other"),
        weaker_party=doc_meta.get("weaker_party", "unknown"),
        lexscore=max(0, min(100, lexscore)),
        lexscore_label=label,
        created_at=datetime.now(timezone.utc).isoformat(),
        status="complete",
        summary=AnalysisSummary(
            total_clauses=len(clauses),
            red_clauses=red,
            amber_clauses=amber,
            green_clauses=green,
            critical_issues=synthesis_result.get("critical_issues", [])[:3],
        ),
        clauses=analyses,
        missing_protections=synthesis_result.get("missing_protections", []),
        document_benchmark=DocumentBenchmark(
            percentile=int(doc_bench.get("percentile", 50)),
            industry_comparison=doc_bench.get("industry_comparison", ""),
        ),
        raw_meta={"orchestrator": doc_meta},
    )


async def run_analysis(
    analysis_id: str,
    document_text: str,
    emit: AwaitsEvent | None = None,
) -> LexGuardAnalysis:
    async def _emit(event: dict[str, Any]) -> None:
        analysis_store.append_event(analysis_id, event)
        if emit:
            await emit(event)

    analysis_store.update_status(analysis_id, "running")

    await _emit({"agent": "orchestrator", "status": "running"})
    doc_meta = await orchestrator.run(document_text)
    await _emit({"agent": "orchestrator", "status": "complete", "result": doc_meta})

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

    await _emit({"agent": "risk_hunter", "status": "running"})
    risks_result = await risk_hunter.run(clauses, doc_meta)
    risks = risks_result.get("risk_assessments", [])

    await _emit({"agent": "devils_advocate", "status": "running"})
    defenses_result = await devils_advocate.run(risks, doc_meta)
    defenses = defenses_result.get("defenses", [])

    await _emit(
        {
            "agent": "risk_hunter",
            "status": "complete",
            "flagged": len(risks),
        }
    )
    await _emit({"agent": "devils_advocate", "status": "complete"})

    await _emit({"agent": "synthesis", "status": "running"})
    synthesis_result = await synthesis.run(clauses, risks, defenses, doc_meta)
    await _emit({"agent": "synthesis", "status": "complete"})

    await _emit({"agent": "comparator", "status": "running"})
    benchmark_result = await comparator.run(synthesis_result, doc_meta)
    await _emit({"agent": "comparator", "status": "complete"})

    final = build_final_result(
        analysis_id, doc_meta, clauses, synthesis_result, benchmark_result
    )
    analysis_store.save_result(analysis_id, final)
    await _emit({"type": "complete", "data": final.model_dump()})
    return final


async def stream_existing_events(analysis_id: str) -> AsyncGenerator[str, None]:
    for event in analysis_store.get_events(analysis_id):
        yield f"data: {json.dumps(event)}\n\n"
