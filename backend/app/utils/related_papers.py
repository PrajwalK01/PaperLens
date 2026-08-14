"""
Related papers lookup via OpenAlex (free, no API key needed).
https://openalex.org/
"""
import httpx
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

OPENALEX_BASE = "https://api.openalex.org"
HEADERS = {"User-Agent": "ScientificPaperReviewer/1.0 (mailto:contact@spr.app)"}


def search_related_papers(title: str, abstract: str = "", limit: int = 5) -> List[dict]:
    """
    Search OpenAlex for papers related to the given title/abstract.
    Returns a list of related paper dicts with title, authors, year, url, citations.
    """
    query = title[:200]  # OpenAlex search query
    try:
        r = httpx.get(
            f"{OPENALEX_BASE}/works",
            params={
                "search": query,
                "per_page": limit + 1,  # fetch one extra to exclude self
                "select": "id,title,authorships,publication_year,cited_by_count,open_access,doi,primary_location",
                "sort": "cited_by_count:desc",
            },
            headers=HEADERS,
            timeout=10,
        )
        r.raise_for_status()
        results = r.json().get("results", [])

        papers = []
        for w in results[:limit]:
            authors = [
                a.get("author", {}).get("display_name", "")
                for a in (w.get("authorships") or [])[:3]
            ]
            doi = w.get("doi", "")
            url = doi if doi else f"https://openalex.org/{w.get('id','').split('/')[-1]}"
            papers.append({
                "title": w.get("title", "Untitled"),
                "authors": ", ".join(filter(None, authors)) or "Unknown Authors",
                "year": w.get("publication_year"),
                "citations": w.get("cited_by_count", 0),
                "url": url,
                "open_access": w.get("open_access", {}).get("is_oa", False),
            })
        return papers
    except Exception as e:
        logger.warning("OpenAlex search failed: %s", e)
        return []


def get_paper_by_doi(doi: str) -> Optional[dict]:
    """Look up a specific paper by DOI on OpenAlex."""
    try:
        clean = doi.replace("https://doi.org/", "").strip()
        r = httpx.get(
            f"{OPENALEX_BASE}/works/doi:{clean}",
            headers=HEADERS,
            timeout=8,
        )
        r.raise_for_status()
        w = r.json()
        return {
            "title": w.get("title"),
            "year": w.get("publication_year"),
            "citations": w.get("cited_by_count", 0),
            "abstract": (w.get("abstract_inverted_index") or {}) and "Available on OpenAlex",
        }
    except Exception as e:
        logger.debug("OpenAlex DOI lookup failed for %s: %s", doi, e)
        return None
