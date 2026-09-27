"""Derived analysis results: time per zone and zone visits (enter/exit events)."""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field

from .base import DomainModel, UtcDateTime


class SummaryRowKind(StrEnum):
    ZONE = "zone"
    NO_ZONE = "no_zone"  # mouse visible but in no zone
    NOT_VISIBLE = "not_visible"  # frames with status MISSING or HIDDEN


class SummaryRow(DomainModel):
    kind: SummaryRowKind
    zone_id: str | None = None
    name: str
    color_index: int | None = None
    time_s: float
    share_of_trial: float = Field(description="0–1.")


class ZoneVisit(DomainModel):
    """One continuous stay in a zone (an 'event' in the UI)."""

    index: int = Field(description="1-based, chronological across all zones.")
    zone_id: str
    zone_name: str
    frame_enter: int
    frame_exit: int = Field(description="Last frame inside the zone (inclusive).")
    enter_s: float
    exit_s: float
    duration_s: float
    enter_utc: UtcDateTime | None = None
    exit_utc: UtcDateTime | None = None


class Results(DomainModel):
    computed_at: UtcDateTime
    trial_start_s: float
    trial_end_s: float
    trial_duration_s: float
    in_zone_threshold: float
    summary: list[SummaryRow]
    visits: list[ZoneVisit]
