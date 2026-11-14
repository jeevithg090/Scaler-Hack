"""Turn uploads, pasted text and public URLs into plain document text."""

from __future__ import annotations

import asyncio
import io
import ipaddress
import re
import socket
from html import unescape
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import HTTPException

from config import MAX_DOCUMENT_CHARS, MAX_URL_FETCH_BYTES, MIN_DOCUMENT_CHARS

_MAX_REDIRECTS = 5
_FETCH_TIMEOUT_SECONDS = 15.0


def extract_text_from_pdf(file_bytes: bytes) -> str:
    import fitz  # PyMuPDF

    try:
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            return "".join(page.get_text("text") for page in doc).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail="Could not read the PDF file") from e


def extract_text_from_docx(file_bytes: bytes) -> str:
    from docx import Document

    try:
        doc = Document(io.BytesIO(file_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Could not read the DOCX file") from e
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()


def extract_text_from_html(html: str) -> str:
    """Strip markup from an HTML page while keeping block boundaries as newlines."""
    html = re.sub(r"(?is)<(script|style|noscript)\b.*?>.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>", "\n", html)
    html = re.sub(r"(?i)</(p|div|section|article|li|h[1-6]|tr)>", "\n", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _is_public_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


async def _resolve_host(host: str, port: int) -> list[str]:
    infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return [str(info[4][0]) for info in infos]


async def _assert_public_url(url: str) -> None:
    """Reject URLs that point at loopback, private or link-local hosts (SSRF guard)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = await _resolve_host(parsed.hostname, port)
    except socket.gaierror as e:
        raise HTTPException(status_code=400, detail="Could not resolve the URL host") from e
    if not addresses or not all(_is_public_ip(addr) for addr in addresses):
        raise HTTPException(status_code=400, detail="URL must point to a public internet host")


async def _fetch(url: str) -> tuple[str, str]:
    """Fetch ``url`` following redirects manually so every hop is validated."""
    async with httpx.AsyncClient(follow_redirects=False, timeout=_FETCH_TIMEOUT_SECONDS) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            await _assert_public_url(url)
            async with client.stream("GET", url) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        break
                    url = urljoin(url, location)
                    continue
                if response.status_code >= 400:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Could not fetch URL (HTTP {response.status_code})",
                    )
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_URL_FETCH_BYTES:
                        raise HTTPException(status_code=413, detail="Fetched page is too large")
                content_type = response.headers.get("content-type", "").lower()
                encoding = response.encoding or "utf-8"
                return body.decode(encoding, errors="replace"), content_type
    raise HTTPException(status_code=400, detail="Too many redirects")


async def extract_text_from_url(url: str) -> str:
    try:
        body, content_type = await _fetch(url.strip())
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail="Could not fetch URL") from e

    if "html" in content_type or "<html" in body[:2000].lower():
        parsed = extract_text_from_html(body)
    else:
        parsed = body.strip()

    if len(parsed) < MIN_DOCUMENT_CHARS:
        raise HTTPException(
            status_code=400,
            detail="Fetched page is too short to analyze. Try pasting the full text.",
        )
    return parsed[:MAX_DOCUMENT_CHARS]


def extract_text(filename: str | None, file_bytes: bytes | None, plain_text: str | None) -> str:
    if plain_text and plain_text.strip():
        return plain_text.strip()[:MAX_DOCUMENT_CHARS]

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Provide a file, text or URL")

    name = (filename or "").lower()
    if name.endswith(".pdf"):
        text = extract_text_from_pdf(file_bytes)
    elif name.endswith(".docx"):
        text = extract_text_from_docx(file_bytes)
    elif name.endswith(".txt") or not name:
        try:
            text = file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError as e:
            raise HTTPException(status_code=400, detail="TXT files must be UTF-8 encoded") from e
    else:
        raise HTTPException(status_code=400, detail="Supported file types: PDF, DOCX, TXT")
    return text[:MAX_DOCUMENT_CHARS]
