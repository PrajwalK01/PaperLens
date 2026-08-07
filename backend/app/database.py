"""
SQLAlchemy database engine and session management.

Supports:
  - SQLite   (local dev)  DATABASE_URL=sqlite:///./PaperLens.db
  - Supabase (cloud)      DATABASE_URL=postgresql://postgres:...@db.xxx.supabase.co:5432/postgres
  - Any PostgreSQL        DATABASE_URL=postgresql://user:pass@host:5432/dbname
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./PaperLens.db")

# ── Build engine kwargs based on driver ───────────────────────────────────────
_is_sqlite   = DATABASE_URL.startswith("sqlite")
_is_postgres = DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres")

connect_args: dict = {}
engine_kwargs: dict = {}

if _is_sqlite:
    # SQLite requires check_same_thread=False for FastAPI's threading model
    connect_args = {"check_same_thread": False}

if _is_postgres:
    # Add SSL for Supabase (and any other hosted Postgres) if not already specified
    if "sslmode" not in DATABASE_URL:
        connect_args = {"sslmode": "require"}
    # Use a connection pool sized for a small API server
    engine_kwargs = {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,   # reconnect if Supabase drops idle connections
    }

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def create_tables() -> None:
    """Create all tables on startup (idempotent — safe to call every time)."""
    from app import models  # noqa: F401 — registers models with Base metadata
    Base.metadata.create_all(bind=engine)

    # Run dynamic schema migrations for existing DB columns
    with engine.begin() as conn:
        try:
            # Check if columns exist in the users table
            if _is_sqlite:
                columns = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
            else:
                columns = [row[0] for row in conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
                )).fetchall()]
            
            if columns:  # table exists
                if "is_verified" not in columns:
                    # Use DEFAULT 0/FALSE compatible with both sqlite and postgres
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0 NOT NULL"))
                if "otp" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp VARCHAR(6)"))
                if "otp_expires_at" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP"))
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Database migration check skipped/failed: {e}")


def get_db():
    """FastAPI dependency — yields a DB session, always closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_connection() -> bool:
    """Quick health-check — returns True if the DB is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
