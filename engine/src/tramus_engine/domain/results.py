"""Derived analysis results: time per zone, zone visits (enter/exit events) and zone crossings."""

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
    share_of_analysed: float = Field(
        0.0,
        description=(
            "0–1, share of the analysed duration. Renamed from `share_of_trial`; defaults for"
            " sidecars saved before the rename (re-derived on next save)."
        ),
    )


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


class CrossingEvent(DomainModel):
    """One rule-matching (or matrix-counted) zone-to-zone transition (§5.4)."""

    frame: int = Field(description="Frame the destination zone was entered on.")
    time_s: float
    time_utc: UtcDateTime | None = None
    from_zone_id: str
    to_zone_id: str


class CrossingResult(DomainModel):
    """The events matching one `CrossingRule`."""

    rule_id: str
    from_zone_id: str | None = Field(None, description="`None` means the rule matches any zone.")
    to_zone_id: str | None = Field(None, description="`None` means the rule matches any zone.")
    count: int = 0
    events: list[CrossingEvent] = Field(default_factory=list)


class MatrixCell(DomainModel):
    """One ordered zone pair's crossing count (including the diagonal, i.e. re-entries)."""

    from_zone_id: str
    to_zone_id: str
    count: int


class Results(DomainModel):
    computed_at: UtcDateTime
    trial_start_s: float
    trial_end_s: float
    trial_duration_s: float
    analysed_duration_s: float = Field(
        0.0,
        description=(
            "Trial duration minus excluded time. Additive; defaults to 0 for older snapshots"
            " (re-derived on next save)."
        ),
    )
    excluded_duration_s: float = Field(0.0, description="Excluded periods, clipped to the trial.")
    in_zone_threshold: float
    summary: list[SummaryRow]
    visits: list[ZoneVisit]
    crossings: list[CrossingResult] = Field(default_factory=list)
    crossing_matrix: list[MatrixCell] = Field(
        default_factory=list, description="Every ordered zone pair, in setup zone order."
    )
    distance_mm: float | None = Field(
        None,
        description=(
            "Distance travelled by the body centre over the analysed time (§5.5 analysed"
            " intervals), in mm. `None` without a calibration (`Setup.calibration`)."
        ),
    )
