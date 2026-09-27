"""Rasterising the arena outline and zone shapes into pixel masks."""

from __future__ import annotations

import cv2
import numpy as np

from ..domain import EllipseShape, PolygonShape, RectShape, Shape


def rasterize_shape(shape: Shape, width: int, height: int, scale: float = 1.0) -> np.ndarray:
    """Fill `shape` (in full-resolution video pixels, scaled by `scale`) into a boolean mask."""
    canvas = np.zeros((height, width), dtype=np.uint8)
    if isinstance(shape, RectShape):
        # cv2.rectangle fills *inclusive* of both corners, so the bottom-right corner is backed
        # off by one pixel to match `width`/`height` exactly and avoid double-counting a shared
        # pixel column/row when two zones are drawn edge to edge (e.g. either side of a doorway).
        x0, y0 = round(shape.x * scale), round(shape.y * scale)
        x1 = max(x0, round((shape.x + shape.width) * scale) - 1)
        y1 = max(y0, round((shape.y + shape.height) * scale) - 1)
        cv2.rectangle(canvas, (x0, y0), (x1, y1), 255, thickness=-1)
    elif isinstance(shape, EllipseShape):
        center = (round(shape.cx * scale), round(shape.cy * scale))
        axes = (round(shape.rx * scale), round(shape.ry * scale))
        cv2.ellipse(canvas, center, axes, 0, 0, 360, 255, thickness=-1)
    elif isinstance(shape, PolygonShape):
        points = np.array([(x * scale, y * scale) for x, y in shape.points], dtype=np.float32)
        cv2.fillPoly(canvas, [np.round(points).astype(np.int32)], 255)
    else:  # pragma: no cover - Shape is a closed discriminated union
        raise TypeError(f"unsupported shape kind: {shape!r}")
    return canvas.astype(bool)
