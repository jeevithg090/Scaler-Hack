from services.gemini_client import generate_json

SYSTEM = """You are the Orchestrator of LEXGUARD, a legal document analysis system.
Return ONLY valid JSON matching the requested schema. No markdown."""

PROMPT = """You receive a raw legal/business document.

Tasks:
1. Identify document type: employment_contract, service_agreement, nda, offer_letter, quotation, terms_of_service, privacy_policy, lease, other
2. Identify the weaker party: employee, contractor, consumer, tenant, buyer, user, unknown
3. Jurisdiction hints (country/state references if any)
4. Complexity: simple, moderate, complex

Document (first 12000 chars):
---
{document}
---

Return ONLY JSON:
{{
  "doc_type": "...",
  "weaker_party": "...",
  "jurisdiction_hints": ["..."],
  "complexity": "...",
  "proceed": true
}}"""


async def run(document_text: str) -> dict:
    snippet = document_text[:12000]
    return await generate_json(
        PROMPT.format(document=snippet),
        system=SYSTEM,
    )
