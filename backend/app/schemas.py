"""Pydantic request / response schemas for PaperLens."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


# ─── Auth / Users ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=255, description="Valid email address")
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern="^[a-zA-Z0-9_-]+$", description="Alphanumeric username")
    password: str = Field(..., min_length=8, max_length=128, description="Password (min 8 chars)")

    @validator("email")
    def validate_email(cls, v):
        if "@" not in v or "." not in v.split("@")[1]:
            raise ValueError("Invalid email format")
        return v.lower()

    @validator("password")
    def validate_password(cls, v):
        if not any(c.isupper() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain uppercase and digit")
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    is_admin: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResendOTPRequest(BaseModel):
    email: str


# ─── Paper ────────────────────────────────────────────────────────────────────

class PaperOut(BaseModel):
    id: str
    user_id: Optional[str] = None
    title: Optional[str]
    authors: Optional[str]
    arxiv_id: Optional[str]
    abstract: Optional[str]
    research_field: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Review Job ───────────────────────────────────────────────────────────────

class ModelConfig(BaseModel):
    """Per-agent model overrides.  Any key not provided falls back to env vars."""
    group_a_primary: Optional[str] = None
    group_a_critic: Optional[str] = None
    group_b_primary: Optional[str] = None
    group_b_critic: Optional[str] = None
    synthesizer: Optional[str] = None


class ReviewRequest(BaseModel):
    paper_id: str
    ai_model_config: Optional[ModelConfig] = None

    class Config:
        populate_by_name = True


class AgentResponseOut(BaseModel):
    id: str
    group: str
    agent_role: str
    model_name: Optional[str]
    round_num: int
    response: Optional[Dict[str, Any]]
    status: str
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewJobOut(BaseModel):
    id: str
    paper_id: str
    user_id: Optional[str] = None
    status: str
    score: Optional[float] = None
    final_review: Optional[Dict[str, Any]]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    agent_responses: List[AgentResponseOut] = []
    paper: Optional[PaperOut] = None

    class Config:
        from_attributes = True


class ReviewJobSummary(BaseModel):
    id: str
    paper_id: str
    status: str
    paper_title: Optional[str]
    final_recommendation: Optional[str]
    overall_score: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── arXiv request ────────────────────────────────────────────────────────────

class ArxivRequest(BaseModel):
    arxiv_id: str


# ─── WebSocket message ────────────────────────────────────────────────────────

class WSMessage(BaseModel):
    event: str                          # "agent_complete" | "job_complete" | "job_failed"
    job_id: str
    data: Optional[Dict[str, Any]] = None