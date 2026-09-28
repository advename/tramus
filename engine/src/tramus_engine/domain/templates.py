"""Reusable setups for videos recorded with the same camera."""

from __future__ import annotations

from pydantic import Field

from .base import DomainModel, UtcDateTime
from .setup import AnalysisSettings, Calibration, DetectionSettings, ImageAdjustments, Zone
from .shapes import Shape


class Template(DomainModel):
    id: str
    name: str = Field(min_length=1, max_length=120)
    created_at: UtcDateTime
    updated_at: UtcDateTime
    created_by: str = Field(description="OS user name of whoever saved it.")
    reference_width: int = Field(gt=0, description="Frame size the shapes were drawn on.")
    reference_height: int = Field(gt=0)
    arena: Shape | None = None
    zones: list[Zone] = Field(default_factory=list)
    image: ImageAdjustments = Field(default_factory=ImageAdjustments)
    detection: DetectionSettings = Field(default_factory=DetectionSettings)
    analysis: AnalysisSettings = Field(default_factory=AnalysisSettings)
    trial_duration_s: float | None = Field(None, gt=0)
    calibration: Calibration | None = None
