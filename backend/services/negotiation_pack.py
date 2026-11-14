"""Plain-text deliverables built from a completed analysis."""

from __future__ import annotations

from typing import Any

_VERDICT_ORDER = {"RED": 0, "AMBER": 1}


def _humanize(value: Any) -> str:
    return str(value or "").replace("_", " ")


def top_risky_clauses(data: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    risky = [c for c in data.get("clauses", []) if c.get("verdict") in _VERDICT_ORDER]
    risky.sort(key=lambda c: (_VERDICT_ORDER[c["verdict"]], c.get("clause_id", "")))
    return risky[:limit]


def build_negotiation_pack(data: dict[str, Any]) -> str:
    """Markdown pack: risky clauses, a ready-to-send email and redlines."""
    top_risky = top_risky_clauses(data)
    lines = [
        "# LEXGUARD Negotiation Pack",
        "",
        f"- Analysis ID: {data.get('analysis_id')}",
        f"- LEXSCORE: {data.get('lexscore')} ({_humanize(data.get('lexscore_label'))})",
        f"- Document Type: {_humanize(data.get('doc_type', 'other'))}",
        f"- Weaker Party: {data.get('weaker_party', 'unknown')}",
        "",
        "## Top Risky Clauses",
        "",
    ]
    if not top_risky:
        lines.append("No RED/AMBER clauses detected.")
    for idx, clause in enumerate(top_risky, start=1):
        lines += [
            f"### {idx}. {clause.get('clause_id')} — {_humanize(clause.get('clause_type'))}",
            f"- Verdict: {clause.get('verdict')} | Severity: {clause.get('severity')}",
            f"- Plain English: {clause.get('plain_english', '')}",
            f"- Worst Case: {clause.get('worst_case', '')}",
            f"- Ask For: {clause.get('negotiation_script', '')}",
            "",
        ]

    lines += [
        "## Ready-to-send Negotiation Email",
        "",
        "Subject: Request to revise a few contract terms",
        "",
        "Hi [Name],",
        "",
        "Thank you for sharing the agreement. I reviewed the terms and I am aligned on the overall "
        "intent. Before signing, I would like to request a few clause-level edits to make the terms "
        "balanced for both sides:",
        "",
    ]
    lines += [f"- {c.get('clause_id')}: {c.get('negotiation_script', '')}" for c in top_risky]
    lines += [
        "",
        "I can sign immediately after these updates are reflected in the next draft.",
        "",
        "Best regards,",
        "[Your Name]",
        "",
        "## Clause-by-clause Redlines",
        "",
    ]
    for clause in top_risky:
        lines += [
            f"### {clause.get('clause_id')}",
            "Current:",
            clause.get("original_text", ""),
            "",
            "Proposed:",
            clause.get("suggested_redline", ""),
            "",
        ]
    return "\n".join(lines).strip() + "\n"


def briefing_script(data: dict[str, Any]) -> str:
    """Short spoken summary used for audio briefings and phone calls."""
    critical = (data.get("summary") or {}).get("critical_issues") or []
    top_issue = critical[0] if critical else "no major issues"
    return (
        f"Here is your contract briefing. The LEXSCORE is {data.get('lexscore', 0)} out of 100. "
        f"The most critical issue is {top_issue}. Please review the red clauses carefully."
    )
