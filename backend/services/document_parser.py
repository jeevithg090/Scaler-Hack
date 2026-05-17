from __future__ import annotations

import io
import re
from html import unescape

import fitz
import httpx
from docx import Document
from fastapi import HTTPException


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text("text")
        doc.close()
        return text.strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"PDF parse error: {e}") from e


def extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DOCX parse error: {e}") from e


def _extract_text_from_html(html: str) -> str:
    # Remove scripts/styles first to avoid noisy content.
    html = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?>.*?</style>", " ", html)
    # Keep block-level boundaries as new lines for readability.
    html = re.sub(r"(?i)</(p|div|section|article|li|h1|h2|h3|h4|h5|h6|br|tr)>", "\n", html)
    text = re.sub(r"(?is)<[^>]+>", " ", html)
    text = unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


async def extract_text_from_url(url: str) -> str:
    if not re.match(r"^https?://", url.strip(), re.IGNORECASE):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(url.strip())
            response.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch URL: {e}") from e

    content_type = response.headers.get("content-type", "").lower()
    body = response.text
    if "html" in content_type or "<html" in body.lower():
        parsed = _extract_text_from_html(body)
    else:
        parsed = body.strip()

    if len(parsed) < 50:
        raise HTTPException(
            status_code=400,
            detail="Fetched page is too short to analyze. Try pasting the full text.",
        )
    return parsed


def extract_text(filename: str | None, file_bytes: bytes | None, plain_text: str | None) -> str:
    if plain_text and plain_text.strip():
        return plain_text.strip()

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Provide a file or text field")

    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    if name.endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    if name.endswith(".txt") or not name:
        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="Unsupported file type")

    raise HTTPException(status_code=400, detail="Supported: PDF, DOCX, TXT")
