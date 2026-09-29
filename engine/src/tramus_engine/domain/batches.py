"""A saved batch run: the template + videos + per-video settings a batch tracked, persisted so
the Batch screen survives an app restart. Job state itself is not part of this — it's in-memory
only (`services.jobs.JobManager`); after a restart, each item's status is derived from its
sidecar instead (see `services/batch.py`'s `summarize_batch`)."""

from __future__ import annotations

from pydantic import Field

from .base import DomainModel, UtcDateTime


class BatchItemRecord(DomainModel):
    video_id: str
    video_path: str
    file_name: str
    trial: tuple[float, float] | None = None
    offset_x: float = 0.0
    offset_y: float = 0.0


class BatchRecord(DomainModel):
    id: str
    created_at: UtcDateTime
    template_id: str
    template_name: str
    folder: str
    items: list[BatchItemRecord] = Field(default_factory=list)
