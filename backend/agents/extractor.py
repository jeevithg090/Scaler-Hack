from services.gemini_client import generate_json

SYSTEM = """You are a legal document parser for LEXGUARD. Return ONLY valid JSON."""

PROMPT = """Extract every distinct clause or provision as a numbered list.

For each clause:
- clause_id: C001, C002, ...
- clause_type: compensation, termination, ip_assignment, non_compete, indemnification, etc.
- text: verbatim excerpt (max 500 chars per clause; truncate with ... if needed)
- affects_party: who is primarily affected

Limit to the 25 most material clauses if the document is very long.

Document:
---
{document}
---

Return ONLY JSON:
{{
  "clauses": [
    {{
      "clause_id": "C001",
      "clause_type": "...",
      "text": "...",
      "affects_party": "..."
    }}
  ]
}}"""


async def run(document_text: str) -> dict:
    snippet = document_text[:20000]
    return await generate_json(PROMPT.format(document=snippet), system=SYSTEM)
