"""
Review endpoints.

POST /api/review              — create a new review job
GET  /api/review/{job_id}     — poll job status + results
WS   /ws/review/{job_id}      — real-time progress stream
GET  /api/history             — list past review jobs
"""

import json
import logging
import threading
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from app.rate_limiter import limiter
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AgentResponse, IntegrityCheck, Paper, ReviewJob, RetrievalTrace
from app.schemas import ModelConfig, ReviewJobOut, ReviewJobSummary, ReviewRequest
from app.ws_manager import manager
from app.utils import plagiarism
from app.utils import observability

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Background task ────────────────────────────────────────────────────────────

def _run_review_task(job_id: str, db_url: str, model_config_dict: dict):
    """
    Runs the LangGraph pipeline in a background thread.
    Creates its own DB session since SQLite connections aren't thread-safe across sessions.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import re

    connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
    engine = create_engine(db_url, connect_args=connect_args)
    ThreadSession = sessionmaker(bind=engine)
    db: Session = ThreadSession()

    job: Optional[ReviewJob] = None
    try:
        job = db.query(ReviewJob).filter(ReviewJob.id == job_id).first()
        if not job:
            logger.error("Job not found: %s", job_id)
            return

        paper = db.query(Paper).filter(Paper.id == job.paper_id).first()
        if not paper:
            logger.error("Paper not found for job %s", job_id)
            job.status = "failed"
            job.error_message = "Paper record not found."
            db.commit()
            return

        job.status = "processing"
        db.commit()
        manager.broadcast_sync(job_id, {"event": "status", "job_id": job_id, "data": {"status": "processing"}})

        # ── Integrity checks (plagiarism / AI-text / figures) — run once up front ─
        integrity_report_str = None
        try:
            from app.agents.llm_clients import get_model_for_role
            judge_llm, _ = get_model_for_role("synthesizer", model_config_dict.get("synthesizer"))
            report = plagiarism.run_integrity_checks(paper.id, paper.content, llm=judge_llm)

            ic = IntegrityCheck(
                paper_id=paper.id,
                max_similarity=report["max_similarity"],
                similarity_matches=report["similarity_matches"],
                ai_text_heuristic_score=report["ai_text_heuristic_score"],
                ai_text_llm_judgment=report["ai_text_llm_judgment"],
                flags=report["flags"],
            )
            db.add(ic)
            db.commit()

            integrity_report_str = plagiarism.report_to_prompt_string(report)
            if report["flags"]:
                manager.broadcast_sync(
                    job_id,
                    {"event": "integrity_flags", "job_id": job_id, "data": {"flags": report["flags"]}},
                )
        except Exception as exc:
            logger.warning("Integrity checks failed for job %s (continuing without them): %s", job_id, exc)

        # ── DB callback invoked by each agent node right after completion ────
        def db_callback(
            job_id: str,
            group: str,
            agent_role: str,
            model_name: str,
            response: Optional[dict],
            error_message: Optional[str],
        ):
            ar = AgentResponse(
                job_id=job_id,
                group=group,
                agent_role=agent_role,
                model_name=model_name,
                response=response,
                status="failed" if error_message else "completed",
                error_message=error_message,
            )
            db.add(ar)
            db.commit()
            db.refresh(ar)

            # Broadcast to WebSocket clients
            payload = {
                "event": "agent_complete",
                "job_id": job_id,
                "data": {
                    "id": ar.id,
                    "group": group,
                    "agent_role": agent_role,
                    "model_name": model_name,
                    "status": ar.status,
                    "response": response,
                    "error_message": error_message,
                    "created_at": ar.created_at.isoformat(),
                },
            }
            manager.broadcast_sync(job_id, payload)
            logger.info("Agent complete: job=%s group=%s role=%s", job_id, group, agent_role)

        # ── Run LangGraph ─────────────────────────────────────────────────────
        from app.agents.orchestrator import run_review

        final_state = run_review(
            job_id=job_id,
            paper_id=paper.id,
            paper_title=paper.title or "Untitled",
            authors=paper.authors or "Unknown",
            paper_full_text=paper.content,
            research_field=paper.research_field or "computer science / general",
            model_config=model_config_dict,
            db_callback=db_callback,
            integrity_report=integrity_report_str,
        )

        # Persist retrieval traces (agentic RAG tool calls) for later fine-tuning export
        for agent_role, steps in (final_state.get("retrieval_traces") or {}).items():
            for i, step in enumerate(steps):
                db.add(
                    RetrievalTrace(
                        job_id=job_id,
                        agent_role=agent_role,
                        step_index=i,
                        query=step.get("query", ""),
                        section_filter=step.get("section_filter"),
                        retrieved_chunk_ids=step.get("retrieved_chunk_ids"),
                        retrieved_sections=step.get("retrieved_sections"),
                    )
                )
        db.commit()

        # Update job record
        job.final_review = final_state.get("final_review")
        job.status = "completed" if final_state.get("final_review") else "failed"
        if final_state.get("errors"):
            job.error_message = "; ".join(final_state["errors"])
        job.completed_at = datetime.utcnow()
        db.commit()

        manager.broadcast_sync(
            job_id,
            {
                "event": "job_complete" if job.status == "completed" else "job_failed",
                "job_id": job_id,
                "data": {
                    "status": job.status,
                    "final_review": job.final_review,
                    "error_message": job.error_message,
                },
            },
        )

    except Exception as exc:
        logger.exception("Unhandled error in review task for job %s: %s", job_id, exc)
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            job.completed_at = datetime.utcnow()
            db.commit()
            manager.broadcast_sync(
                job_id,
                {"event": "job_failed", "job_id": job_id, "data": {"error_message": str(exc)}},
            )
    finally:
        db.close()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/review", response_model=ReviewJobOut)
@limiter.limit("5/minute")
async def create_review(
    request: Request,
    body: ReviewRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a review job and kick it off as a background task."""
    paper = db.query(Paper).filter(Paper.id == body.paper_id).first()
    if not paper:
        raise HTTPException(404, "Paper not found.")

    mc = body.ai_model_config or ModelConfig()
    mc_dict = {
        "group_a_primary": mc.group_a_primary,
        "group_a_critic":  mc.group_a_critic,
        "group_b_primary": mc.group_b_primary,
        "group_b_critic":  mc.group_b_critic,
        "synthesizer":     mc.synthesizer,
    }

    job = ReviewJob(paper_id=paper.id, status="queued", model_config=mc_dict)
    db.add(job)
    db.commit()
    db.refresh(job)

    import os
    db_url = os.getenv("DATABASE_URL", "sqlite:///./PaperLens.db")

    # Use a real thread so LangGraph's synchronous parallel execution works
    t = threading.Thread(
        target=_run_review_task,
        args=(job.id, db_url, mc_dict),
        daemon=True,
    )
    t.start()

    db.refresh(job)
    return job


@router.get("/review/{job_id}", response_model=ReviewJobOut)
async def get_review(job_id: str, db: Session = Depends(get_db)):
    """Poll current job status and any completed agent responses."""
    job = (
        db.query(ReviewJob)
        .filter(ReviewJob.id == job_id)
        .first()
    )
    if not job:
        raise HTTPException(404, "Review job not found.")
    return job


@router.get("/review/{job_id}/trace")
async def get_review_trace(job_id: str) -> dict:
    """
    Return the full structured event trace for a review job — every node's
    start/end time, which code path it took (tool_loop/simple_rag/plain_text),
    which model handled it, and any error. This is what makes "why did this
    agent flag this paper" answerable without re-running the review.
    """
    events = observability.get_trace_for_job(job_id)
    if not events:
        raise HTTPException(status_code=404, detail=f"No trace found for job_id={job_id}")
    summary = observability.summarize_job(job_id)
    return {"job_id": job_id, "summary": summary, "events": events}


@router.get("/history", response_model=List[ReviewJobSummary])
async def list_history(db: Session = Depends(get_db)):
    """Return all past review jobs (most recent first)."""
    jobs = (
        db.query(ReviewJob)
        .order_by(ReviewJob.created_at.desc())
        .limit(100)
        .all()
    )
    summaries = []
    for job in jobs:
        paper = db.query(Paper).filter(Paper.id == job.paper_id).first()
        final_rec = None
        overall = None
        if job.final_review:
            final_rec = job.final_review.get("final_recommendation")
            scores = job.final_review.get("final_scores", {})
            overall = scores.get("overall")
        summaries.append(
            ReviewJobSummary(
                id=job.id,
                paper_id=job.paper_id,
                status=job.status,
                paper_title=paper.title if paper else None,
                final_recommendation=final_rec,
                overall_score=overall,
                created_at=job.created_at,
                completed_at=job.completed_at,
            )
        )
    return summaries


# ── WebSocket ──────────────────────────────────────────────────────────────────

@router.websocket("/ws/review/{job_id}")
async def ws_review(job_id: str, websocket: WebSocket, db: Session = Depends(get_db)):
    await manager.connect(job_id, websocket)
    try:
        # Send any already-completed agent responses immediately on connect
        job = db.query(ReviewJob).filter(ReviewJob.id == job_id).first()
        if job:
            for ar in job.agent_responses:
                await websocket.send_text(
                    json.dumps(
                        {
                            "event": "agent_complete",
                            "job_id": job_id,
                            "data": {
                                "id": ar.id,
                                "group": ar.group,
                                "agent_role": ar.agent_role,
                                "model_name": ar.model_name,
                                "status": ar.status,
                                "response": ar.response,
                                "error_message": ar.error_message,
                                "created_at": ar.created_at.isoformat(),
                            },
                        }
                    )
                )
            if job.status in ("completed", "failed"):
                await websocket.send_text(
                    json.dumps(
                        {
                            "event": "job_complete" if job.status == "completed" else "job_failed",
                            "job_id": job_id,
                            "data": {
                                "status": job.status,
                                "final_review": job.final_review,
                                "error_message": job.error_message,
                            },
                        }
                    )
                )

        # Keep alive — wait for client disconnect
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(job_id, websocket)