"""Tracking output (per-frame body observations), flags and user corrections."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import Field, model_validator

from .base import DomainModel, UtcDateTime


class FrameStatus(StrEnum):
    DETECTED = "detected"  # found by the tracker
    INTERPOLATED = "interpolated"  # short gap filled by the tracker, or "Fill in between"
    MISSING = "missing"  # tracker found nothing; excluded from zone times
    MANUAL = "manual"  # position set by the user
    HIDDEN = "hidden"  # user marked "Mouse not visible"; excluded from zone times


VISIBLE_STATUSES = frozenset({FrameStatus.DETECTED, FrameStatus.INTERPOLATED, FrameStatus.MANUAL})


class Track(DomainModel):
    """Per-frame body observations stored column-wise; list index == frame index.

    The body is modelled as an ellipse (tail excluded) with the same second moments as the
    detected blob. Values are `None` for frames whose status is MISSING or HIDDEN.
    """

    tracker: str
    tracker_version: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    tracked_at: UtcDateTime
    t: list[float] = Field(description="Frame time in seconds since the first frame (from PTS).")
    x: list[float | None]
    y: list[float | None]
    semi_major: list[float | None]
    semi_minor: list[float | None]
    angle_deg: list[float | None] = Field(
        description="Major-axis angle in degrees, clockwise from +x (image coordinates)."
    )
    area_px: list[float | None]
    status: list[FrameStatus]

    @model_validator(mode="after")
    def _columns_have_equal_length(self) -> Track:
        n = len(self.t)
        columns = (self.x, self.y, self.semi_major, self.semi_minor, self.angle_deg, self.area_px)
        if any(len(c) != n for c in columns) or len(self.status) != n:
            raise ValueError("all track columns must have one value per frame")
        return self

    @property
    def frame_count(self) -> int:
        return len(self.t)


class FlagReason(StrEnum):
    NOT_FOUND = "not_found"  # "Mouse not found" · detail "Lost for 0.8 s"
    SUDDEN_JUMP = "sudden_jump"  # "Sudden jump" · detail "41 px in 1 frame"
    UNUSUAL_SIZE = "unusual_size"  # "Unusual size" · detail "2.4× typical body size"


class FlagStatus(StrEnum):
    UNRESOLVED = "unresolved"
    FIXED = "fixed"
    ACCEPTED = "accepted"


class Flag(DomainModel):
    id: str = Field(description="Deterministic: '<reason>-<frame_start>'.")
    reason: FlagReason
    frame_start: int = Field(ge=0)
    frame_end: int = Field(ge=0, description="Inclusive.")
    t_start_s: float
    t_end_s: float
    detail: str
    metric: float = Field(description="Seconds lost, pixels jumped, or size ratio.")


class _CorrectionBase(DomainModel):
    id: str
    created_at: UtcDateTime


class SetPosition(_CorrectionBase):
    kind: Literal["set_position"] = "set_position"
    frame: int = Field(ge=0)
    x: float
    y: float


class MarkHidden(_CorrectionBase):
    kind: Literal["mark_hidden"] = "mark_hidden"
    frame_start: int = Field(ge=0)
    frame_end: int = Field(ge=0, description="Inclusive.")


class Interpolate(_CorrectionBase):
    kind: Literal["interpolate"] = "interpolate"
    frame_start: int = Field(ge=0)
    frame_end: int = Field(ge=0, description="Inclusive.")


class AcceptFlag(_CorrectionBase):
    kind: Literal["accept_flag"] = "accept_flag"
    flag_id: str


Correction = Annotated[
    SetPosition | MarkHidden | Interpolate | AcceptFlag, Field(discriminator="kind")
]
