import json

from services.gemini_client import generate_json

SYSTEM = """You are an aggressive legal risk analyst protecting the weaker party. Return ONLY valid JSON."""

PROMPT = """Document type: {doc_type}
Weaker party: {weaker_party}

Assess each clause for:
- EXPLOIT, LIABILITY, AMBIGUITY, PRACTICAL_RISK, MISSING (if protection absent)

Severity: CRITICAL, HIGH, MEDIUM, LOW, CLEAN

Clauses:
{clauses}

Return ONLY JSON:
{{
  "risk_assessments": [
    {{
      "clause_id": "C001",
      "risk_type": "EXPLOIT",
      "severity": "CRITICAL",
      "legal_basis": "...",
      "plain_english": "...",
      "worst_case_scenario": "..."
    }}
  ]
}}

Only include clauses with severity other than CLEAN, or the top 15 highest risks."""


async def run(clauses: list[dict], doc_meta: dict) -> dict:
    return await generate_json(
        PROMPT.format(
            doc_type=doc_meta.get("doc_type", "other"),
            weaker_party=doc_meta.get("weaker_party", "unknown"),
            clauses=json.dumps(clauses[:25], indent=2),
        ),
        system=SYSTEM,
    )
