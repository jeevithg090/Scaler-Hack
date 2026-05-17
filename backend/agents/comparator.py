import json

from services.gemini_client import generate_json

SYSTEM = """You are a contract benchmarking expert. Return ONLY valid JSON."""

PROMPT = """Document type: {doc_type}
Industry context from jurisdiction: {jurisdiction}

For RED and AMBER clauses in the synthesis below, benchmark against industry norms.

Synthesis clause results (RED/AMBER only):
{clause_results}

Return ONLY JSON:
{{
  "document_benchmark": {{
    "percentile": 87,
    "industry_comparison": "Riskier than most standard contracts in this sector because..."
  }},
  "clause_benchmarks": [
    {{
      "clause_id": "C001",
      "prevalence_percent": 94,
      "aggressiveness": "more aggressive than typical",
      "typical_alternative": "...",
      "industry_norm": "..."
    }}
  ]
}}"""


async def run(synthesis: dict, doc_meta: dict) -> dict:
    red_amber = [
        c
        for c in synthesis.get("clause_results", [])
        if c.get("verdict") in ("RED", "AMBER")
    ]
    if not red_amber:
        return {
            "document_benchmark": {
                "percentile": 30,
                "industry_comparison": "No major red flags compared to typical agreements in this category.",
            },
            "clause_benchmarks": [],
        }
    return await generate_json(
        PROMPT.format(
            doc_type=doc_meta.get("doc_type", "other"),
            jurisdiction=", ".join(doc_meta.get("jurisdiction_hints", [])) or "unknown",
            clause_results=json.dumps(red_amber[:15], indent=2),
        ),
        system=SYSTEM,
    )
