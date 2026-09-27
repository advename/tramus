"""Background work (tracking runs), reported to the UI over the event stream."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import Field

from .base import DomainModel, UtcDateTime


class JobState(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Job(DomainModel):
    id: str
    kind: Literal["track"] = "track"
    video_id: str
    video_name: str
    batch_id: str | None = None
    state: JobState = JobState.QUEUED
    progress: float = Field(0.0, ge=0, le=1)
    frames_done: int = 0
    frames_total: int = 0
    fps: float | None = None
    elapsed_s: float = 0.0
    remaining_s: float | None = None
    error: str | None = None
    flag_count: int | None = None
    created_at: UtcDateTime
    started_at: UtcDateTime | None = None
    finished_at: UtcDateTime | None = None
