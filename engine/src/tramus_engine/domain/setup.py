"""The per-video setup: arena, zones, image adjustments, detection and analysis settings, trial."""

from __future__ import annotations

from enum import StrEnum

from pydantic import Field, model_validator

from .base import DomainModel
from .shapes import Shape

ZONE_PALETTE_SIZE = 8


class Zone(DomainModel):
    id: str
    name: str = Field(min_length=1, max_length=80)
    color_index: int = Field(ge=0, lt=ZONE_PALETTE_SIZE)
    shape: Shape
    visible: bool = True
    locked: bool = False


class ImageAdjustments(DomainModel):
    """Linear brightness/contrast applied to every frame before display *and* detection."""

    brightness: int = Field(0, ge=-100, le=100)
    contrast: int = Field(0, ge=-100, le=100)


class Polarity(StrEnum):
    DARKER = "darker"
    LIGHTER = "lighter"


class DetectionSettings(DomainModel):
    tracker: str = "background_subtraction"
    sensitivity: int = Field(60, ge=0, le=100)
    polarity: Polarity = Polarity.DARKER
    min_mouse_area_px: int = Field(300, ge=1, description="Minimum body area in video px².")


class AnalysisSettings(DomainModel):
    in_zone_threshold: float = Field(
        0.5, ge=0.05, le=0.95, description="Share of the body that must be inside a zone."
    )


class TrialWindow(DomainModel):
    """The analysed part of the video, in video time (seconds since the first frame)."""

    start_s: float = Field(ge=0)
    end_s: float
    locked_duration: bool = False

    @model_validator(mode="after")
    def _end_after_start(self) -> TrialWindow:
        if self.end_s <= self.start_s:
            raise ValueError("trial end must be after trial start")
        return self


class TemplateRef(DomainModel):
    id: str
    name: str


class Setup(DomainModel):
    arena: Shape | None = None
    zones: list[Zone] = Field(default_factory=list)
    image: ImageAdjustments = Field(default_factory=ImageAdjustments)
    detection: DetectionSettings = Field(default_factory=DetectionSettings)
    analysis: AnalysisSettings = Field(default_factory=AnalysisSettings)
    trial: TrialWindow | None = Field(None, description="None means the whole video.")
    template: TemplateRef | None = Field(None, description="Template this setup came from.")

    @property
    def is_empty(self) -> bool:
        return self.arena is None and not self.zones
