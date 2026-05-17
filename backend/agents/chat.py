import json

from services.gemini_client import generate


SYSTEM = """You are LEXGUARD's legal assistant. You have analyzed a legal document and have the full analysis in context.

Answer the user's questions about this specific document.
Be direct, practical, and speak as if you are their advocate.
Do not give formal legal advice — give the kind of honest guidance a smart friend who happens to be a lawyer would give.
Keep answers concise (2-4 paragraphs max). Reference specific clause IDs when relevant."""


async def run(
    message: str,
    doc_type: str,
    weaker_party: str,
    lexscore: int,
    clause_analysis: list[dict],
    critical_issues: list[str],
    missing_protections: list[str],
) -> str:
    context = f"""Document type: {doc_type}
Weaker party: {weaker_party}
LEXSCORE: {lexscore}/100
Critical issues: {json.dumps(critical_issues)}
Missing protections: {json.dumps(missing_protections)}
Clause analysis (summary):
{json.dumps(clause_analysis[:15], indent=1)}"""

    prompt = f"""[CONTEXT]
{context}
[/CONTEXT]

User question: {message}"""

    return await generate(
        prompt,
        system=SYSTEM,
        json_mode=False,
        temperature=0.4,
    )
