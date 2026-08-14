"""
CrossRef DOI lookup — free, no API key needed.
https://api.crossref.org/works/{doi}
"""
import httpx
import logging
from typing import Optional

logger = logging.getLogger(__name__)
CROSSREF_BASE = "https://api.crossref.org/works"
HEADERS = {"User-Agent": "ScientificPaperReviewer/1.0 (mailto:contact@spr.app)"}


def get_citation_count(doi: str) -> Optional[int]:
    """Get citation count for a paper by DOI."""
    try:
        clean = doi.replace("https://doi.org/", "").strip()
        r = httpx.get(f"{CROSSREF_BASE}/{clean}", headers=HEADERS, timeout=6)
        r.raise_for_status()
        data = r.json().get("message", {})
        return data.get("is-referenced-by-count")
    except Exception as e:
        logger.debug("CrossRef lookup failed for DOI %s: %s", doi, e)
        return None


def search_by_title(title: str, limit: int = 3) -> list:
    """Search CrossRef for papers matching a title."""
    try:
        r = httpx.get(
            f"{CROSSREF_BASE}",
            params={"query.title": title[:200], "rows": limit, "select": "DOI,title,author,published,is-referenced-by-count"},
            headers=HEADERS,
            timeout=8,
        )
        r.raise_for_status()
        items = r.json().get("message", {}).get("items", [])
        results = []
        for item in items:
            authors = [f"{a.get('family','')}, {a.get('given','')}" for a in item.get("author", [])[:2]]
            pub = item.get("published", {}).get("date-parts", [[None]])[0]
            results.append({
                "doi": item.get("DOI", ""),
                "title": (item.get("title") or [""])[0],
                "authors": "; ".join(a for a in authors if a.strip(", ")),
                "year": pub[0] if pub else None,
                "citations": item.get("is-referenced-by-count", 0),
            })
        return results
    except Exception as e:
        logger.debug("CrossRef title search failed: %s", e)
        return []
