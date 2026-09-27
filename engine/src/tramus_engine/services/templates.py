"""Turning a `Template` into a `Setup` for a specific video.

Pure geometry — no dependency on the engine core packages.
"""

from __future__ import annotations

from ..domain import Setup, Shape, Template, TemplateRef, TrialWindow
from ..domain.shapes import EllipseShape, PolygonShape, RectShape


def setup_from_template(
    template: Template,
    width: int,
    height: int,
    offset: tuple[float, float] = (0.0, 0.0),
    trial: tuple[float, float] | None = None,
) -> Setup:
    """Scales the template's shapes by the frame-size ratio (video / template reference), then
    offsets them by `offset` (e.g. from the user nudging the overlay in Batch › Check)."""
    scale_x = width / template.reference_width
    scale_y = height / template.reference_height
    dx, dy = offset

    arena = _scale_shape(template.arena, scale_x, scale_y, dx, dy) if template.arena else None
    zones = [
        zone.model_copy(update={"shape": _scale_shape(zone.shape, scale_x, scale_y, dx, dy)})
        for zone in template.zones
    ]
    trial_window = TrialWindow(start_s=trial[0], end_s=trial[1]) if trial else None

    return Setup(
        arena=arena,
        zones=zones,
        image=template.image,
        detection=template.detection,
        analysis=template.analysis,
        trial=trial_window,
        template=TemplateRef(id=template.id, name=template.name),
    )


def _scale_shape(shape: Shape, sx: float, sy: float, dx: float, dy: float) -> Shape:
    if isinstance(shape, RectShape):
        return RectShape(
            x=shape.x * sx + dx,
            y=shape.y * sy + dy,
            width=shape.width * sx,
            height=shape.height * sy,
        )
    if isinstance(shape, EllipseShape):
        return EllipseShape(
            cx=shape.cx * sx + dx, cy=shape.cy * sy + dy, rx=shape.rx * sx, ry=shape.ry * sy
        )
    if isinstance(shape, PolygonShape):
        return PolygonShape(points=[(px * sx + dx, py * sy + dy) for px, py in shape.points])
    raise TypeError(f"unknown shape kind: {type(shape)!r}")
