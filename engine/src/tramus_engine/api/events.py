"""WebSocket event hub: broadcasts job and session updates to every connected client.

`GET /api/events` (a WebSocket) sends `{"type": "job", "job": Job}` whenever a tracking job's
state or progress changes, and `{"type": "session", "video_id": str, "state": SessionState}`
whenever an open session is mutated (setup/corrections edited, saved, discarded, template
applied, or tracking on that session finishes).

Job updates originate on a background consumer thread (`services.jobs.JobManager`); the
`*_threadsafe` methods schedule the actual broadcast onto the event loop that's serving the API
(`asyncio.run_coroutine_threadsafe`, built on `loop.call_soon_threadsafe`).
"""

from __future__ import annotations

import asyncio

from fastapi import WebSocket

from ..domain import Job
from .schemas import JobEvent, SessionEvent, SessionState


class EventHub:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Called once, from the API's startup, so background threads can schedule broadcasts."""
        self._loop = loop

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def _broadcast(self, text: str) -> None:
        dead: list[WebSocket] = []
        for connection in list(self._connections):
            try:
                await connection.send_text(text)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self._connections.discard(connection)

    async def publish_job(self, job: Job) -> None:
        await self._broadcast(JobEvent(job=job).model_dump_json())

    async def publish_session(self, video_id: str, state: SessionState) -> None:
        await self._broadcast(SessionEvent(video_id=video_id, state=state).model_dump_json())

    def publish_job_threadsafe(self, job: Job) -> None:
        if self._loop is None:
            return
        asyncio.run_coroutine_threadsafe(self.publish_job(job), self._loop)

    def publish_session_threadsafe(self, video_id: str, state: SessionState) -> None:
        if self._loop is None:
            return
        asyncio.run_coroutine_threadsafe(self.publish_session(video_id, state), self._loop)
