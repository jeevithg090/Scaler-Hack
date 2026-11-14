import json

from services.gemini_client import generate_json

SYSTEM = """You are the final arbiter of LEXGUARD. Return ONLY valid JSON."""

PROMPT = """Synthesize Risk Hunter vs Devil's Advocate.

Clauses: {clauses}
Risks: {risks}
Defenses: {defenses}

For each clause with any risk or defense, produce:
- clause_id, verdict (RED|AMBER|GREEN), severity, risk_type, plain_english, worst_case
- defense_argument, defense_strength, negotiation_script, suggested_redline
- lexscore_impact: integer -15 to +2 per clause

Also compute:
- lexscore: 0-100 using these rules: start at 100; CRITICAL clause -15; HIGH -8; MEDIUM -4;
  LOW -1; each missing protection -5; each INDEFENSIBLE defense an extra -3; each STRONG
  defense +2; floor 0
- lexscore_label: HOSTILE|PREDATORY|HIGH_RISK|MODERATE|FAIR|GOOD|EXCELLENT
- missing_protections: string[]
- critical_issues: top 3 plain-English warnings

Return ONLY JSON:
{{
  "lexscore": 72,
  "lexscore_label": "MODERATE",
  "missing_protections": ["..."],
  "critical_issues": ["..."],
  "clause_results": [
    {{
      "clause_id": "C001",
      "verdict": "RED",
      "severity": "HIGH",
      "risk_type": "EXPLOIT",
      "plain_english": "...",
      "worst_case": "...",
      "defense_argument": "...",
      "defense_strength": "WEAK",
      "negotiation_script": "...",
      "suggested_redline": "...",
      "lexscore_impact": -8
    }}
  ]
}}"""


async def run(
    clauses: list[dict],
    risks: list[dict],
    defenses: list[dict],
    doc_meta: dict,
) -> dict:
    return await generate_json(
        PROMPT.format(
            clauses=json.dumps(clauses[:25], indent=2),
            risks=json.dumps(risks[:25], indent=2),
            defenses=json.dumps(defenses[:25], indent=2),
        ),
        system=SYSTEM,
    )
