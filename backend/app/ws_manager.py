"""
In-process WebSocket connection manager.
Maps job_id → list of active WebSocket connections.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# The main event loop — stored at startup so background threads can schedule work on it
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_main_loop(loop: asyncio.AbstractEventLoop):
    """Call this at app startup to register the main event loop."""
    global _main_loop
    _main_loop = loop


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = defaultdict(list)

    async def connect(self, job_id: str, ws: WebSocket):
        await ws.accept()
        self._connections[job_id].append(ws)
        logger.debug("WS connected: job=%s total=%d", job_id, len(self._connections[job_id]))

    def disconnect(self, job_id: str, ws: WebSocket):
        try:
            self._connections[job_id].remove(ws)
        except ValueError:
            pass
        logger.debug("WS disconnected: job=%s remaining=%d", job_id, len(self._connections[job_id]))

    async def broadcast(self, job_id: str, message: dict):
        """Send a JSON message to all clients watching this job."""
        dead = []
        for ws in list(self._connections.get(job_id, [])):
            try:
                await ws.send_text(json.dumps(message))
            except Exception as exc:
                logger.warning("WS send failed: %s", exc)
                dead.append(ws)
        for ws in dead:
            self.disconnect(job_id, ws)

    def broadcast_sync(self, job_id: str, message: dict):
        """
        Thread-safe bridge: schedule the coroutine on the main event loop.
        Called from background threads (the LangGraph worker).
        Uses the stored main loop instead of asyncio.get_event_loop()
        which fails in non-async threads.
        """
        global _main_loop
        if _main_loop is None or not _main_loop.is_running():
            # Fallback: try to get any running loop
            try:
                loop = asyncio.get_running_loop()
                asyncio.run_coroutine_threadsafe(self.broadcast(job_id, message), loop)
            except RuntimeError:
                logger.debug("broadcast_sync: no running event loop, message dropped for job=%s", job_id)
            return
        try:
            asyncio.run_coroutine_threadsafe(self.broadcast(job_id, message), _main_loop)
        except Exception as exc:
            logger.warning("broadcast_sync failed: %s", exc)


manager = ConnectionManager()
