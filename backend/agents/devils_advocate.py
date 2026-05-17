import json

from services.gemini_client import generate_json

SYSTEM = """You are defense counsel for the stronger party. Be persuasive, not strawman. Return ONLY valid JSON."""

PROMPT = """Document type: {doc_type}

For each flagged risk below, argue why the clause may be acceptable.
defense_strength: STRONG | MODERATE | WEAK | INDEFENSIBLE

Flagged risks:
{risks}

Return ONLY JSON:
{{
  "defenses": [
    {{
      "clause_id": "C001",
      "defense_strength": "MODERATE",
      "argument": "...",
      "counterpoint_weakness": "..."
    }}
  ]
}}"""


async def run(risks: list[dict], doc_meta: dict) -> dict:
    if not risks:
        return {"defenses": []}
    return await generate_json(
        PROMPT.format(
            doc_type=doc_meta.get("doc_type", "other"),
            risks=json.dumps(risks[:20], indent=2),
        ),
        system=SYSTEM,
    )
