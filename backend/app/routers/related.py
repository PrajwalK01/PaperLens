"""
Related papers endpoint — powered by OpenAlex (free, no API key).
GET /api/papers/{paper_id}/related
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Paper
from app.utils.related_papers import search_related_papers

router = APIRouter(prefix="/api/papers", tags=["related"])


@router.get("/{paper_id}/related")
async def get_related_papers(paper_id: str, limit: int = 5, db: Session = Depends(get_db)):
    paper = db.query(Paper).filter(Paper.id == paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found")
    title = paper.title or ""
    abstract = paper.abstract or ""
    if not title:
        return {"related": [], "source": "openalex"}
    results = search_related_papers(title, abstract, limit=limit)
    return {"related": results, "source": "openalex", "query": title[:80]}
