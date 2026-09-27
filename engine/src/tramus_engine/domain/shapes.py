"""Geometric shapes used for the arena outline and zones.

All coordinates are in *video pixels* of the full-resolution frame, origin top-left, y down.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from .base import DomainModel


class RectShape(DomainModel):
    kind: Literal["rect"] = "rect"
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)


class EllipseShape(DomainModel):
    kind: Literal["ellipse"] = "ellipse"
    cx: float
    cy: float
    rx: float = Field(gt=0)
    ry: float = Field(gt=0)


class PolygonShape(DomainModel):
    kind: Literal["polygon"] = "polygon"
    points: list[tuple[float, float]] = Field(min_length=3)


Shape = Annotated[RectShape | EllipseShape | PolygonShape, Field(discriminator="kind")]
