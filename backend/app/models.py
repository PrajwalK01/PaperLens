"""SQLAlchemy ORM models for PaperLens."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    JSON,
    Boolean,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship

from app.database import Base  # DeclarativeBase defined in database.py


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    otp = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    papers = relationship("Paper", back_populates="user")
    review_jobs = relationship("ReviewJob", back_populates="user")


class Paper(Base):
    __tablename__ = "papers"

    id = Column(String(36), primary_key=True, default=_uuid)
    title = Column(String(512), nullable=True)
    authors = Column(Text, nullable=True)
    arxiv_id = Column(String(64), unique=True, nullable=True)
    content = Column(Text, nullable=False)          # extracted full text
    abstract = Column(Text, nullable=True)
    research_field = Column(String(128), nullable=True)
    pdf_url = Column(String(1024), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="papers")

    review_jobs = relationship("ReviewJob", back_populates="paper")


class ReviewJob(Base):
    __tablename__ = "review_jobs"

    id = Column(String(36), primary_key=True, default=_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False)
    status = Column(
        SAEnum("queued", "processing", "completed", "failed", name="job_status"),
        default="queued",
        nullable=False,
    )
    model_config = Column(JSON, nullable=True)      # stores per-agent model choices
    final_review = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    score = Column(Float, nullable=True)  # extracted from final_review for quick query
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="review_jobs")

    paper = relationship("Paper", back_populates="review_jobs")
    agent_responses = relationship(
        "AgentResponse", back_populates="job", order_by="AgentResponse.created_at"
    )


class AgentResponse(Base):
    __tablename__ = "agent_responses"

    id = Column(String(36), primary_key=True, default=_uuid)
    job_id = Column(String(36), ForeignKey("review_jobs.id"), nullable=False)
    group = Column(
        SAEnum("A", "B", "FINAL", name="review_group"), nullable=False
    )
    agent_role = Column(
        SAEnum("primary", "critic", "synthesizer", name="agent_role"), nullable=False
    )
    model_name = Column(String(128), nullable=True)
    round_num = Column(Integer, default=1)
    response = Column(JSON, nullable=True)          # parsed JSON from the LLM
    raw_response = Column(Text, nullable=True)      # original LLM text (for debugging)
    status = Column(
        SAEnum("completed", "failed", name="agent_status"), default="completed"
    )
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("ReviewJob", back_populates="agent_responses")


class RetrievalTrace(Base):
    """
    One row per agentic RAG tool call. Captures what a reviewer node looked
    up, in what order, feeding the /api/finetune export so a fine-tuning
    dataset can reflect how the agents actually reasoned through a paper —
    not just their final verdict.
    """
    __tablename__ = "retrieval_traces"

    id = Column(String(36), primary_key=True, default=_uuid)
    job_id = Column(String(36), ForeignKey("review_jobs.id"), nullable=False)
    agent_role = Column(String(64), nullable=False)   # e.g. "group_a_primary"
    step_index = Column(Integer, nullable=False)       # order within that agent's loop
    query = Column(Text, nullable=False)
    section_filter = Column(String(64), nullable=True)
    retrieved_chunk_ids = Column(JSON, nullable=True)
    retrieved_sections = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class IntegrityCheck(Base):
    """Plagiarism / AI-generated-text / figure-analysis results for a paper."""
    __tablename__ = "integrity_checks"

    id = Column(String(36), primary_key=True, default=_uuid)
    paper_id = Column(String(36), ForeignKey("papers.id"), nullable=False)
    max_similarity = Column(Float, nullable=True)
    similarity_matches = Column(JSON, nullable=True)
    ai_text_heuristic_score = Column(Float, nullable=True)
    ai_text_llm_judgment = Column(JSON, nullable=True)
    flags = Column(JSON, nullable=True)
    figure_summary = Column(JSON, nullable=True)   # from cnn_figures.figures_to_prompt_string (parsed)
    created_at = Column(DateTime, default=datetime.utcnow)
