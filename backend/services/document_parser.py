from __future__ import annotations

import io

import fitz
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
