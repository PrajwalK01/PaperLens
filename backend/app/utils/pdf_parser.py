"""
PDF text extraction utility.

Primary:  PyMuPDF (fitz)
Fallback: pdfplumber (better for tables)
"""

from __future__ import annotations

import io
import logging
import re
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ── Section heading patterns ──────────────────────────────────────────────────
_SECTION_RE = re.compile(
    r"^\s*(\d+\.?\s+|[IVXLC]+\.\s+)?([A-Z][A-Z\s\-]{3,})\s*$", re.MULTILINE
)


def _clean_text(text: str) -> str:
    """Remove excessive whitespace while preserving paragraph structure."""
    # collapse runs of spaces / tabs
    text = re.sub(r"[ \t]{2,}", " ", text)
    # collapse 3+ newlines into 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text_pymupdf(pdf_bytes: bytes) -> str:
    """Extract text using PyMuPDF."""
    import fitz  # PyMuPDF

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text("text"))
    doc.close()
    return _clean_text("\n".join(pages))


def extract_text_pdfplumber(pdf_bytes: bytes) -> str:
    """Fallback extractor using pdfplumber (handles tables better)."""
    import pdfplumber

    pages = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                pages.append(t)
    return _clean_text("\n".join(pages))


def extract_text(pdf_bytes: bytes) -> str:
    """
    Try PyMuPDF first; fall back to pdfplumber if the result is suspiciously short.
    Raises ValueError if neither extractor produces usable text.
    """
    text = ""
    try:
        text = extract_text_pymupdf(pdf_bytes)
        logger.debug("PyMuPDF extracted %d chars", len(text))
    except Exception as exc:
        logger.warning("PyMuPDF failed (%s), trying pdfplumber…", exc)

    if len(text) < 500:
        try:
            text = extract_text_pdfplumber(pdf_bytes)
            logger.debug("pdfplumber extracted %d chars", len(text))
        except Exception as exc:
            logger.error("pdfplumber also failed: %s", exc)

    if len(text) < 100:
        raise ValueError("Could not extract meaningful text from the PDF.")

    return text


def extract_abstract(text: str) -> Optional[str]:
    """Heuristically pull out the abstract paragraph."""
    match = re.search(
        r"(?:abstract|summary)\s*[\.\-—:–]?\s*\n(.*?)(?:\n\n|\n[A-Z])",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if match:
        return _clean_text(match.group(1))
    return None


def infer_research_field(text: str) -> str:
    """
    Very lightweight keyword-based field inference.
    Returns a short label for the system prompt.
    """
    lower = text[:3000].lower()
    field_map = {
        "machine learning": ["neural network", "deep learning", "transformer", "gradient descent", "backprop"],
        "computer vision": ["image classification", "object detection", "segmentation", "convolutional"],
        "nlp": ["natural language", "language model", "text classification", "tokenization", "bert", "gpt"],
        "bioinformatics": ["genomic", "protein", "dna", "rna", "sequencing", "bioinformatics"],
        "physics": ["quantum", "particle", "thermodynamic", "hamiltonian", "lagrangian"],
        "chemistry": ["molecular", "synthesis", "catalysis", "reaction", "compound"],
        "mathematics": ["theorem", "proof", "lemma", "corollary", "manifold"],
        "systems": ["operating system", "distributed", "fault tolerance", "consensus", "latency"],
        "security": ["cryptography", "vulnerability", "attack", "malware", "encryption"],
    }
    for field, keywords in field_map.items():
        if any(kw in lower for kw in keywords):
            return field
    return "computer science / general"


def extract_images(pdf_bytes: bytes, min_size_px: int = 100) -> list[dict]:
    """
    Extract embedded images (figures, charts, diagrams) from a PDF using PyMuPDF.

    Returns a list of dicts: {"page": int, "index": int, "bytes": bytes, "ext": str,
    "width": int, "height": int}. Filters out tiny images (icons/bullets) below
    min_size_px on both dimensions.
    """
    import fitz  # PyMuPDF

    images: list[dict] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page_index in range(len(doc)):
            page = doc[page_index]
            for img_index, img in enumerate(page.get_images(full=True)):
                xref = img[0]
                try:
                    base = doc.extract_image(xref)
                except Exception as exc:
                    logger.warning("Could not extract image xref=%s on page %d: %s", xref, page_index, exc)
                    continue

                width, height = base.get("width", 0), base.get("height", 0)
                if width < min_size_px or height < min_size_px:
                    continue  # skip icons/bullets/logos

                images.append(
                    {
                        "page": page_index + 1,
                        "index": img_index,
                        "bytes": base["image"],
                        "ext": base.get("ext", "png"),
                        "width": width,
                        "height": height,
                    }
                )
    finally:
        doc.close()

    logger.info("Extracted %d figure-sized images from PDF", len(images))
    return images


def truncate_for_llm(text: str, max_chars: int = 80_000) -> str:
    """
    Truncate paper text to fit comfortably within LLM context windows.
    Prefers cutting from the middle (references section) rather than the end.
    """
    if len(text) <= max_chars:
        return text

    # Try to cut at the references section
    ref_match = re.search(r"\nreferences\s*\n", text, re.IGNORECASE)
    if ref_match and ref_match.start() > max_chars // 2:
        truncated = text[: ref_match.start()]
        if len(truncated) <= max_chars:
            return truncated + "\n\n[References section omitted for brevity]"

    half = max_chars // 2
    return (
        text[:half]
        + "\n\n[... middle section truncated for length ...]\n\n"
        + text[-half:]
    )
