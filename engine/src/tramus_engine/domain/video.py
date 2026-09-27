"""Facts about a video file, read once when the file is probed."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from .base import DomainModel, UtcDateTime

VIDEO_EXTENSIONS = frozenset({".mp4", ".mov", ".avi", ".mkv", ".m4v", ".wmv", ".mpg", ".mpeg"})


class VideoInfo(DomainModel):
    file_name: str
    fingerprint: str
    size_bytes: int
    width: int
    height: int
    codec: str
    frame_count: int
    duration_s: float
    nominal_fps: float
    recorded_at: UtcDateTime | None = None
    recorded_at_source: Literal["container_metadata"] | None = None


class VideoStatus(StrEnum):
    NEW = "new"
    SET_UP = "set_up"
    TRACKED = "tracked"
    REVIEWED = "reviewed"
    EXPORTED = "exported"
