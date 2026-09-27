"""imaging/adjust.py, raster.py, encode.py."""

from __future__ import annotations

import numpy as np

from tramus_engine.domain import EllipseShape, ImageAdjustments, PolygonShape, RectShape
from tramus_engine.imaging import (
    apply_adjustments,
    encode_jpeg,
    encode_png,
    rasterize_shape,
    resize_max_side,
)


def test_apply_adjustments_identity_when_zero() -> None:
    image = np.random.default_rng(0).integers(0, 255, (10, 10), dtype=np.uint8)
    out = apply_adjustments(image, ImageAdjustments(brightness=0, contrast=0))
    assert np.array_equal(out, image)


def test_apply_adjustments_matches_formula() -> None:
    image = np.array([[0, 128, 255]], dtype=np.uint8)
    adjustments = ImageAdjustments(brightness=10, contrast=20)
    out = apply_adjustments(image, adjustments)
    expected = np.clip((image.astype(np.float32) - 128) * 1.2 + 128 + 10 * 1.28, 0, 255).astype(
        np.uint8
    )
    assert np.array_equal(out, expected)


def test_rasterize_rect_matches_dimensions() -> None:
    mask = rasterize_shape(RectShape(x=10, y=10, width=20, height=30), width=100, height=100)
    assert mask.dtype == np.bool_
    assert mask.sum() == 20 * 30
    assert mask[10, 10]
    assert not mask[9, 10]
    assert not mask[10, 30]  # one past the right edge (x=10..29 inclusive)


def test_adjacent_rects_do_not_overlap() -> None:
    left = rasterize_shape(RectShape(x=0, y=0, width=50, height=100), width=100, height=100)
    right = rasterize_shape(RectShape(x=50, y=0, width=50, height=100), width=100, height=100)
    assert not np.any(left & right)
    assert np.all(left | right)  # together they cover the whole frame


def test_rasterize_ellipse_and_polygon_produce_nonempty_masks() -> None:
    ellipse_mask = rasterize_shape(EllipseShape(cx=50, cy=50, rx=20, ry=10), width=100, height=100)
    assert ellipse_mask[50, 50]
    assert ellipse_mask.sum() > 0

    polygon = PolygonShape(points=[(10, 10), (90, 10), (90, 90), (10, 90)])
    polygon_mask = rasterize_shape(polygon, width=100, height=100)
    assert polygon_mask[50, 50]


def test_resize_max_side_never_upscales_and_preserves_aspect() -> None:
    image = np.zeros((100, 200, 3), dtype=np.uint8)
    resized = resize_max_side(image, 50)
    assert max(resized.shape[:2]) == 50
    assert resized.shape[0] / resized.shape[1] == 100 / 200
    assert resize_max_side(image, 500) is image
    assert resize_max_side(image, None) is image


def test_encode_jpeg_and_png_roundtrip() -> None:
    image = np.random.default_rng(1).integers(0, 255, (20, 20), dtype=np.uint8)
    jpeg_bytes = encode_jpeg(image, quality=90)
    png_bytes = encode_png(image)
    assert jpeg_bytes[:2] == b"\xff\xd8"  # JPEG magic
    assert png_bytes[:8] == b"\x89PNG\r\n\x1a\n"
