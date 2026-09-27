"""The analysis document: everything Tramus knows about one video.

Persisted as `<video file name>.tramus.json` next to the video (the "sidecar").
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import Field

from .base import DomainModel, UtcDateTime
from .results import Results
from .setup import Setup
from .track import Correction, Flag, Track
from .video import VideoInfo

SCHEMA_VERSION = 1


class SetupChange(DomainModel):
    """A setup edit made after tracking (e.g. a zone was resized). Kept for the edit history."""

    id: str
    at: UtcDateTime
    title: str  # e.g. 'Edited zone “Center”'
    detail: str  # e.g. 'Resized · results recalculated'


class AnalysisDocument(DomainModel):
    schema_version: Literal[1] = SCHEMA_VERSION
    app_version: str
    created_at: UtcDateTime
    updated_at: UtcDateTime
    video: VideoInfo
    setup: Setup = Field(default_factory=Setup)
    track: Track | None = Field(None, description="Raw tracker output, before corrections.")
    flags: list[Flag] = Field(default_factory=list)
    corrections: list[Correction] = Field(default_factory=list)
    setup_changes: list[SetupChange] = Field(default_factory=list)
    exported_at: UtcDateTime | None = None
    results: Results | None = Field(
        None, description="Snapshot written on save for external tools; always re-derivable."
    )


class HistoryKind(StrEnum):
    TRACKED = "tracked"
    SET_POSITION = "set_position"
    MARK_HIDDEN = "mark_hidden"
    INTERPOLATE = "interpolate"
    ACCEPT_FLAG = "accept_flag"
    SETUP_CHANGED = "setup_changed"


class HistoryEntry(DomainModel):
    """One row in the Review › History list (newest first)."""

    id: str
    kind: HistoryKind
    title: str
    detail: str
    at: UtcDateTime
    frame_start: int | None = None
    frame_end: int | None = None
    t_start_s: float | None = None
    t_end_s: float | None = None
