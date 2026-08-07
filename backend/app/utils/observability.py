"""
Lightweight structured observability for PaperLens — no external service
(LangSmith, etc.) required. Every agent call, retrieval, and node timing
gets logged as a structured JSON event to a local file, so you can answer
"why did this agent flag this paper" with an actual trace instead of
re-running it and guessing.

Usage: call `event()` at key points; view a job's full trace with
`get_trace_for_job(job_id)`, or tail the raw file directly.

This is intentionally simple (one JSONL file, no queue, no external
dependency) — good enough for a capstone demo and for debugging locally.
If you outgrow it, the event schema below maps cleanly onto LangSmith
runs or any real tracing backend later.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

TRACE_LOG_PATH = os.getenv("TRACE_LOG_PATH", "./observability_traces.jsonl")
_lock = threading.Lock()


def event(
    job_id: str,
    event_type: str,
    agent_role: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
    duration_ms: Optional[float] = None,
) -> None:
    """
    Log one structured event. event_type examples:
      "node_start", "node_end", "retrieval_call", "llm_call",
      "integrity_check", "job_start", "job_end"
    """
    record = {
        "timestamp": time.time(),
        "job_id": job_id,
        "event_type": event_type,
        "agent_role": agent_role,
        "duration_ms": duration_ms,
        "data": data or {},
    }
    try:
        with _lock:
            with open(TRACE_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
    except Exception as exc:
        logger.warning("Failed to write observability event: %s", exc)


class timed_event:
    """
    Context manager that logs a node_start/node_end pair automatically with
    duration. Usage:

        with timed_event(job_id, "group_a_primary") as t:
            ... do work ...
            t.data["model"] = model_name   # attach extra info before exit
    """

    def __init__(self, job_id: str, agent_role: str):
        self.job_id = job_id
        self.agent_role = agent_role
        self.data: Dict[str, Any] = {}
        self._start: float = 0.0

    def __enter__(self):
        self._start = time.time()
        event(self.job_id, "node_start", self.agent_role)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self._start) * 1000
        if exc_type is not None:
            self.data["error"] = str(exc_val)
            event(self.job_id, "node_error", self.agent_role, self.data, duration_ms)
        else:
            event(self.job_id, "node_end", self.agent_role, self.data, duration_ms)
        return False  # never suppress exceptions


def get_trace_for_job(job_id: str) -> List[Dict[str, Any]]:
    """Read back every event logged for a given job, in order."""
    events = []
    if not os.path.exists(TRACE_LOG_PATH):
        return events
    with open(TRACE_LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
                if record.get("job_id") == job_id:
                    events.append(record)
            except json.JSONDecodeError:
                continue
    return events


def summarize_job(job_id: str) -> Dict[str, Any]:
    """Quick summary: per-agent duration and any errors, for a dashboard or CLI."""
    events = get_trace_for_job(job_id)
    per_agent: Dict[str, Dict[str, Any]] = {}
    for e in events:
        role = e.get("agent_role") or "unknown"
        if e["event_type"] in ("node_end", "node_error"):
            per_agent[role] = {
                "duration_ms": e.get("duration_ms"),
                "status": "error" if e["event_type"] == "node_error" else "ok",
                "error": e.get("data", {}).get("error"),
                "model": e.get("data", {}).get("model"),
            }
    return {"job_id": job_id, "agents": per_agent, "total_events": len(events)}
