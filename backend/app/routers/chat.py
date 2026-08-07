"""
AI Research Assistant chat endpoint.

POST /api/chat/stream  — SSE streaming chat with optional paper context.
POST /api/chat         — non-streaming fallback (single JSON response).

The assistant is aware of:
  - The paper's title, authors, abstract and full text (if paper_id provided)
  - The final review verdict (if a completed review job exists for that paper)
  - Conversation history sent by the client (last N messages)
"""
import json
import logging
import os
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Paper, ReviewJob

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chat", tags=["chat"])


# ── Request / response schemas ─────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    paper_id: Optional[str] = None
    job_id: Optional[str] = None
    history: List[ChatMessage] = []


# ── System prompt builder ──────────────────────────────────────────────────────

def _build_system(paper: Optional[Paper], job: Optional[ReviewJob]) -> str:
    parts = [
        "You are PaperLens Research Assistant — a knowledgeable AI helping researchers "
        "understand and analyse scientific papers. You are concise, precise, and always "
        "ground your answers in the paper's actual content. Never fabricate data, "
        "citations, or results not present in the paper.",
    ]

    if paper:
        parts.append(f"\n## Current Paper\nTitle: {paper.title or 'Unknown'}")
        if paper.authors:
            parts.append(f"Authors: {paper.authors}")
        if paper.research_field:
            parts.append(f"Field: {paper.research_field}")
        if paper.abstract:
            parts.append(f"\nAbstract:\n{paper.abstract}")
        if paper.content:
            # Limit to 12 000 chars to leave room for the conversation
            excerpt = paper.content[:12_000]
            if len(paper.content) > 12_000:
                excerpt += "\n\n[...paper truncated for context window...]"
            parts.append(f"\nFull Paper Text (excerpt):\n{excerpt}")

    if job and job.final_review:
        fr = job.final_review
        parts.append(
            f"\n## AI Review Verdict (already completed)\n"
            f"Recommendation: {fr.get('final_recommendation', 'N/A')}\n"
            f"Overall Score: {fr.get('final_scores', {}).get('overall', 'N/A')}/10\n"
            f"Confidence: {fr.get('confidence', 'N/A')}\n"
            f"Summary: {fr.get('consolidated_summary', '')}"
        )

    parts.append(
        "\nAnswer the user's question about this paper clearly and helpfully. "
        "If asked to summarise, explain equations, suggest related work, or critique methodology, do so. "
        "If a question cannot be answered from the paper content, say so honestly."
    )
    return "\n".join(parts)


# ── LLM caller — picks the cheapest/fastest available provider ─────────────────

def _get_chat_llm():
    """
    Return a LangChain chat model for the assistant.
    Priority: Anthropic Claude > Google Gemini > Mistral > OpenAI GPT-4o-mini
    (OpenAI is last because quota errors are common with free-tier keys)
    """
    # Try Anthropic claude-3-haiku (fast + reliable)
    if os.environ.get("ANTHROPIC_API_KEY", "") not in ("", "your_anthropic_api_key_here"):
        try:
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model="claude-3-haiku-20240307",
                api_key=os.environ["ANTHROPIC_API_KEY"],
                max_tokens=1024,
                timeout=60,
            )
        except Exception as e:
            logger.warning("Anthropic init failed: %s", e)

    # Try Google gemini-1.5-flash
    if os.environ.get("GOOGLE_API_KEY", "") not in ("", "your_google_api_key_here"):
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model="gemini-1.5-flash-latest",
                google_api_key=os.environ["GOOGLE_API_KEY"],
                max_output_tokens=1024,
                timeout=60,
            )
        except Exception as e:
            logger.warning("Google init failed: %s", e)

    # Try Mistral
    if os.environ.get("MISTRAL_API_KEY", "") not in ("", "your_mistral_api_key_here"):
        try:
            from langchain_mistralai import ChatMistralAI
            return ChatMistralAI(
                model="mistral-small-latest",
                api_key=os.environ["MISTRAL_API_KEY"],
                max_tokens=1024,
                timeout=60,
            )
        except Exception as e:
            logger.warning("Mistral init failed: %s", e)

    # Try local Ollama if configured
    ollama_model = os.environ.get("OLLAMA_MODEL") or os.environ.get("AGENT_MODEL_GROUP_A_PRIMARY")
    if ollama_model and (ollama_model.startswith("ollama:") or "llama3" in ollama_model):
        try:
            import ollama
            from langchain_core.messages import SystemMessage, HumanMessage
            class OllamaChatClient:
                def __init__(self, model, base_url):
                    self.model = model
                    self.base_url = base_url

                async def astream(self, messages):
                    client = ollama.Client(host=self.base_url)
                    ollama_messages = []
                    for m in messages:
                        role = "system" if m.__class__.__name__ == "SystemMessage" else "user"
                        ollama_messages.append({"role": role, "content": m.content})
                    response = client.chat(model=self.model.replace("ollama:", ""), messages=ollama_messages)
                    text = response["message"]["content"]
                    yield type("x", (), {"content": text})

            return OllamaChatClient(model=ollama_model.replace("ollama:", ""), base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"))
        except Exception as e:
            logger.warning("Ollama init failed: %s", e)

    raise HTTPException(
        status_code=503,
        detail="No working LLM API key found. Add ANTHROPIC_API_KEY, GOOGLE_API_KEY, MISTRAL_API_KEY, OPENAI_API_KEY, or configure OLLAMA_MODEL and OLLAMA_BASE_URL"
    )


# ── SSE streaming endpoint ─────────────────────────────────────────────────────

@router.post("/stream")
async def chat_stream(body: ChatRequest, db: Session = Depends(get_db)):
    """
    Stream AI assistant response as Server-Sent Events.
    Frontend receives: data: <chunk>\n\n   and   data: [DONE]\n\n
    """
    # Resolve paper and job from DB
    paper: Optional[Paper] = None
    job: Optional[ReviewJob] = None

    if body.paper_id:
        paper = db.query(Paper).filter(Paper.id == body.paper_id).first()

    if body.job_id:
        job = db.query(ReviewJob).filter(ReviewJob.id == body.job_id).first()
    elif paper:
        # Auto-pick the latest completed review job for this paper
        job = (
            db.query(ReviewJob)
            .filter(ReviewJob.paper_id == paper.id, ReviewJob.status == "completed")
            .order_by(ReviewJob.created_at.desc())
            .first()
        )

    system_text = _build_system(paper, job)

    try:
        llm = _get_chat_llm()
    except HTTPException as exc:
        # Return error as SSE so frontend can display it
        async def error_gen():
            yield f"data: {json.dumps({'error': exc.detail})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

    messages = [SystemMessage(content=system_text)]
    # Add history (cap at last 10 turns to stay within context)
    for msg in body.history[-10:]:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))
    messages.append(HumanMessage(content=body.message))

    async def generate():
        try:
            async for chunk in llm.astream(messages):
                text = chunk.content if hasattr(chunk, "content") else str(chunk)
                if text:
                    yield f"data: {json.dumps({'token': text})}\n\n"
        except Exception as exc:
            logger.error("Chat stream error: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disable nginx buffering
        },
    )


# ── Non-streaming fallback ─────────────────────────────────────────────────────

@router.post("")
async def chat_sync(body: ChatRequest, db: Session = Depends(get_db)):
    """Non-streaming fallback — returns full response as JSON."""
    paper: Optional[Paper] = None
    job: Optional[ReviewJob] = None

    if body.paper_id:
        paper = db.query(Paper).filter(Paper.id == body.paper_id).first()
    if body.job_id:
        job = db.query(ReviewJob).filter(ReviewJob.id == body.job_id).first()
    elif paper:
        job = (
            db.query(ReviewJob)
            .filter(ReviewJob.paper_id == paper.id, ReviewJob.status == "completed")
            .order_by(ReviewJob.created_at.desc())
            .first()
        )

    system_text = _build_system(paper, job)
    llm = _get_chat_llm()

    from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
    messages = [SystemMessage(content=system_text)]
    for msg in body.history[-10:]:
        if msg.role == "user":
            messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            messages.append(AIMessage(content=msg.content))
    messages.append(HumanMessage(content=body.message))

    try:
        resp = llm.invoke(messages)
        return {"response": resp.content}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))