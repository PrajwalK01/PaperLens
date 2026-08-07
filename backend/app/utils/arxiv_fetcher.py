"""
Fetch paper metadata and PDF from arXiv.
Uses the arXiv API (no authentication required).
"""

from __future__ import annotations

import logging
import re
import xml.etree.ElementTree as ET
from typing import Optional, Tuple

import httpx

from app.utils.pdf_parser import extract_text, extract_abstract, infer_research_field

logger = logging.getLogger(__name__)

ARXIV_API = "https://export.arxiv.org/api/query"
ARXIV_NS = "{http://www.w3.org/2005/Atom}"
TIMEOUT = 60  # seconds


def _clean_arxiv_id(raw: str) -> str:
    """Normalise arXiv IDs like '2301.00001v2' → '2301.00001'."""
    raw = raw.strip()
    # strip version suffix
    raw = re.sub(r"v\d+$", "", raw)
    # strip url prefix if user pasted a link
    raw = re.sub(r".*arxiv\.org/(abs|pdf)/", "", raw)
    return raw


async def fetch_arxiv_paper(arxiv_id: str) -> dict:
    """
    Returns a dict with keys: title, authors, abstract, pdf_url,
    arxiv_id, content (extracted text), research_field.
    Raises httpx.HTTPError or ValueError on failure.
    """
    arxiv_id = _clean_arxiv_id(arxiv_id)
    logger.info("Fetching arXiv paper: %s", arxiv_id)

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(
            ARXIV_API, params={"id_list": arxiv_id, "max_results": 1}
        )
        resp.raise_for_status()

    root = ET.fromstring(resp.text)
    entry = root.find(f"{ARXIV_NS}entry")
    if entry is None:
        raise ValueError(f"No paper found for arXiv ID: {arxiv_id}")

    title_el = entry.find(f"{ARXIV_NS}title")
    title = title_el.text.strip().replace("\n", " ") if title_el is not None else "Unknown"

    summary_el = entry.find(f"{ARXIV_NS}summary")
    abstract = summary_el.text.strip() if summary_el is not None else ""

    authors = [
        a.find(f"{ARXIV_NS}name").text
        for a in entry.findall(f"{ARXIV_NS}author")
        if a.find(f"{ARXIV_NS}name") is not None
    ]

    # Find PDF link
    pdf_url = None
    for link in entry.findall(f"{ARXIV_NS}link"):
        if link.attrib.get("title") == "pdf":
            pdf_url = link.attrib.get("href", "").replace("http://", "https://")
            if not pdf_url.endswith(".pdf"):
                pdf_url += ".pdf"
            break

    if not pdf_url:
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

    # Download and parse PDF
    logger.info("Downloading PDF from %s", pdf_url)
    async with httpx.AsyncClient(
        timeout=120,
        follow_redirects=True,
        headers={"User-Agent": "PaperLens/1.0 (research tool)"},
    ) as client:
        pdf_resp = await client.get(pdf_url)
        pdf_resp.raise_for_status()

    pdf_bytes = pdf_resp.content
    content = extract_text(pdf_bytes)
    research_field = infer_research_field(content)

    return {
        "arxiv_id": arxiv_id,
        "title": title,
        "authors": ", ".join(authors),
        "abstract": abstract,
        "pdf_url": pdf_url,
        "content": content,
        "research_field": research_field,
    }
