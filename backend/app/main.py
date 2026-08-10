"""PaperLens FastAPI application entry point."""

# Load .env FIRST — before any other import reads os.environ
from dotenv import load_dotenv
load_dotenv()

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.database import create_tables
from app.rate_limiter import limiter
from app.routers import review, papers, auth, stats, profile, finetune, chat

app = FastAPI(
    title="PaperLens",
    description="Multi-agent AI system for scientific paper peer review",
    version="1.0.0",
)

# ── Rate limiting ────────────────────────────────────────────────────────────
# Defaults are conservative for a free/demo deployment — each LLM-backed
# review costs real money/quota, so unauthenticated abuse needs a low
# ceiling. Adjust via env vars if you have paid capacity to spare.
# Endpoint-specific stricter limits (upload, review) live in their routers.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Production frontend URL is read from an env var so a deployed instance
# doesn't need code changes — just set FRONTEND_URL when you deploy.
_allowed_origins = [
    "http://localhost:5173",      # Vite dev server
    "http://localhost:3000",      # Alternative frontend port
    "http://frontend:5173",       # Docker service name
    "http://127.0.0.1:5173",      # Localhost alternative
    "https://paper-lens-liart.vercel.app",  # Vercel production
]
# Additional origins from env (FRONTEND_URL can be space-separated list)
_frontend_url = os.getenv("FRONTEND_URL", "")
for _url in _frontend_url.split():
    if _url and _url not in _allowed_origins:
        _allowed_origins.append(_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # all Vercel preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers ─────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # HSTS only makes sense behind HTTPS — most deployment platforms
    # (Render/Railway/Fly) terminate TLS in front of the app, so this is
    # safe to always set; browsers ignore it over plain HTTP anyway.
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.on_event("startup")
async def startup_event():
    create_tables()


@app.get("/health")
async def health():
    from app.database import check_connection, DATABASE_URL
    db_ok = check_connection()
    db_type = "supabase/postgres" if DATABASE_URL.startswith("postgresql") else "sqlite"
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "PaperLens",
        "database": db_type,
        "database_connected": db_ok,
    }


app.include_router(papers.router, prefix="/api/papers", tags=["papers"])
app.include_router(review.router, prefix="/api", tags=["review"])
app.include_router(auth.router)
app.include_router(stats.router)
app.include_router(profile.router)
app.include_router(finetune.router)
app.include_router(chat.router)
