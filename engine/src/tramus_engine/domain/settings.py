"""Application-wide user preferences (stored in the OS user config directory)."""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field

from .base import DomainModel, UtcDateTime

PLAYBACK_SPEEDS = (0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0)


class ProcessingDevice(StrEnum):
    AUTO = "auto"
    CPU = "cpu"
    GPU = "gpu"


class ThemePreference(StrEnum):
    DARK = "dark"
    LIGHT = "light"
    SYSTEM = "system"


class RecentFolder(DomainModel):
    path: str
    name: str
    video_count: int
    last_opened_at: UtcDateTime


class AppSettings(DomainModel):
    device: ProcessingDevice = ProcessingDevice.AUTO
    parallel_jobs: int = Field(2, ge=1, le=16)
    review_playback_speed: float = Field(4.0, ge=0.25, le=16)
    trail_length_s: float = Field(10.0, ge=5, le=30)
    default_in_zone_threshold: float = Field(0.5, ge=0.05, le=0.95)
    theme: ThemePreference = ThemePreference.DARK
    recent_folders: list[RecentFolder] = Field(default_factory=list, max_length=12)
