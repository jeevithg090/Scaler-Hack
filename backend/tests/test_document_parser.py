from __future__ import annotations

import io

import httpx
import pytest
import respx
from fastapi import HTTPException

from services import document_parser

LONG_TEXT = "This agreement is entered into by the parties. " * 5


def test_plain_text_wins_and_is_trimmed():
    assert document_parser.extract_text(None, b"ignored", "  hello  ") == "hello"


def test_txt_upload_decodes_utf8():
    assert document_parser.extract_text("a.txt", "héllo".encode(), None) == "héllo"


def test_non_utf8_txt_is_rejected():
    with pytest.raises(HTTPException) as exc:
        document_parser.extract_text("a.txt", b"\xff\xfe\x00bad", None)
    assert exc.value.status_code == 400


def test_unsupported_extension_is_rejected():
    with pytest.raises(HTTPException) as exc:
        document_parser.extract_text("a.exe", b"MZ", None)
    assert "PDF, DOCX, TXT" in exc.value.detail


def test_missing_input_is_rejected():
    with pytest.raises(HTTPException):
        document_parser.extract_text(None, None, "   ")


def test_pdf_extraction():
    import fitz

    doc = fitz.open()
    doc.new_page().insert_text((72, 72), "Termination clause applies.")
    pdf_bytes = doc.tobytes()
    doc.close()
    assert "Termination clause" in document_parser.extract_text("c.PDF", pdf_bytes, None)


def test_corrupt_pdf_is_a_client_error():
    with pytest.raises(HTTPException) as exc:
        document_parser.extract_text("c.pdf", b"not a pdf", None)
    assert exc.value.status_code == 400


def test_docx_extraction():
    from docx import Document

    buf = io.BytesIO()
    doc = Document()
    doc.add_paragraph("First clause.")
    doc.add_paragraph("   ")
    doc.add_paragraph("Second clause.")
    doc.save(buf)
    assert document_parser.extract_text("c.docx", buf.getvalue(), None) == (
        "First clause.\nSecond clause."
    )


def test_html_extraction_strips_scripts_and_tags():
    html = (
        "<html><head><style>p{}</style><script>alert(1)</script></head>"
        "<body><h1>Terms</h1><p>You agree &amp; accept.</p><br/>Done</body></html>"
    )
    text = document_parser.extract_text_from_html(html)
    assert "alert" not in text and "p{}" not in text
    assert [line for line in text.splitlines() if line] == ["Terms", "You agree & accept.", "Done"]


def _fake_dns(monkeypatch, mapping: dict[str, str]):
    async def fake_resolve(host, port):
        return [mapping[host]]

    monkeypatch.setattr(document_parser, "_resolve_host", fake_resolve)


@pytest.mark.parametrize(
    "url",
    ["ftp://example.com/x", "file:///etc/passwd", "http://"],
)
async def test_url_scheme_validation(url):
    with pytest.raises(HTTPException) as exc:
        await document_parser.extract_text_from_url(url)
    assert exc.value.status_code == 400


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.0.0.5", "169.254.169.254", "192.168.1.1"])
async def test_private_hosts_are_blocked(monkeypatch, ip):
    _fake_dns(monkeypatch, {"internal.test": ip})
    with pytest.raises(HTTPException) as exc:
        await document_parser.extract_text_from_url("http://internal.test/")
    assert "public" in exc.value.detail


@respx.mock
async def test_redirect_to_private_host_is_blocked(monkeypatch):
    _fake_dns(monkeypatch, {"public.test": "93.184.216.34", "metadata.test": "169.254.169.254"})
    respx.get("http://public.test/").mock(
        return_value=httpx.Response(302, headers={"location": "http://metadata.test/"})
    )
    with pytest.raises(HTTPException) as exc:
        await document_parser.extract_text_from_url("http://public.test/")
    assert "public" in exc.value.detail


@respx.mock
async def test_public_html_page_is_fetched(monkeypatch):
    _fake_dns(monkeypatch, {"public.test": "93.184.216.34"})
    respx.get("https://public.test/tos").mock(
        return_value=httpx.Response(
            200,
            headers={"content-type": "text/html; charset=utf-8"},
            text=f"<html><body><p>{LONG_TEXT}</p></body></html>",
        )
    )
    text = await document_parser.extract_text_from_url("https://public.test/tos")
    assert text == LONG_TEXT.strip()


@respx.mock
async def test_http_errors_are_reported(monkeypatch):
    _fake_dns(monkeypatch, {"public.test": "93.184.216.34"})
    respx.get("https://public.test/missing").mock(return_value=httpx.Response(404))
    with pytest.raises(HTTPException) as exc:
        await document_parser.extract_text_from_url("https://public.test/missing")
    assert "404" in exc.value.detail
