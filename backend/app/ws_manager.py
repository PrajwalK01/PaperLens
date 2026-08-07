"""
In-process WebSocket connection manager.
Maps job_id → list of active WebSocket connections.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


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
        Thread-safe bridge: schedule the coroutine on the running event loop.
        Called from background threads (the LangGraph worker).
        """
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(self.broadcast(job_id, message), loop)
        except Exception as exc:
            logger.warning("broadcast_sync failed: %s", exc)


manager = ConnectionManager()
