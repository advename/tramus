"""Zone membership with hysteresis: "most of the body" (§5.4).

The body is sampled at 96 fixed points inside the unit disk (a sunflower/Fibonacci pattern),
mapped into every frame's ellipse in one vectorised pass, and looked up in full-resolution
rasterised zone masks. The hysteresis state machine itself is small (a handful of zones) and
runs in plain Python, as the architecture allows.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np

from ..domain import VISIBLE_STATUSES, Track, Zone
from ..imaging.raster import rasterize_shape

_N_POINTS = 96
_GOLDEN_ANGLE = math.pi * (3.0 - math.sqrt(5.0))


def _unit_disk_points(n: int = _N_POINTS) -> np.ndarray:
    """`(n, 2)` sunflower pattern of points filling the unit disk."""
    indices = np.arange(n) + 0.5
    radius = np.sqrt(indices / n)
    theta = indices * _GOLDEN_ANGLE
    return np.stack([radius * np.cos(theta), radius * np.sin(theta)], axis=1)


def zone_fractions(
    track: Track, zones: Sequence[Zone], width: int, height: int
) -> tuple[np.ndarray, np.ndarray]:
    """`(fractions, f_none)`: `fractions` is `frames x zones`, share of the 96 body points
    inside each zone; `f_none` is `frames`, the share inside no zone (points that land outside
    the frame count as "no zone")."""
    n = track.frame_count
    n_zones = len(zones)
    fractions = np.zeros((n, n_zones), dtype=np.float64)
    outside = np.zeros(n, dtype=np.float64)

    visible_mask = np.array([status in VISIBLE_STATUSES for status in track.status])
    idx = np.where(visible_mask)[0]
    if idx.size == 0:
        return fractions, outside

    disk = _unit_disk_points()
    n_points = disk.shape[0]

    x = np.array([track.x[i] for i in idx], dtype=np.float64)
    y = np.array([track.y[i] for i in idx], dtype=np.float64)
    semi_major = np.array([track.semi_major[i] for i in idx], dtype=np.float64)
    semi_minor = np.array([track.semi_minor[i] for i in idx], dtype=np.float64)
    angle = np.radians(np.array([track.angle_deg[i] for i in idx], dtype=np.float64))

    cos_a = np.cos(angle)[:, None]
    sin_a = np.sin(angle)[:, None]
    dx = disk[None, :, 0] * semi_major[:, None]
    dy = disk[None, :, 1] * semi_minor[:, None]
    rx = dx * cos_a - dy * sin_a
    ry = dx * sin_a + dy * cos_a
    px = x[:, None] + rx
    py = y[:, None] + ry

    col = np.round(px).astype(np.int64)
    row = np.round(py).astype(np.int64)
    valid = (col >= 0) & (col < width) & (row >= 0) & (row < height)
    col_c = np.clip(col, 0, width - 1)
    row_c = np.clip(row, 0, height - 1)

    if n_zones > 0:
        masks = np.stack([rasterize_shape(zone.shape, width, height) for zone in zones], axis=0)
        inside = np.transpose(masks[:, row_c, col_c], (1, 2, 0))  # (m, points, zones)
        inside &= valid[:, :, None]
        fractions[idx] = inside.sum(axis=1) / n_points
        in_any_zone = inside.any(axis=2)
    else:
        in_any_zone = np.zeros((idx.size, n_points), dtype=bool)

    outside[idx] = np.count_nonzero(~in_any_zone, axis=1) / n_points
    return fractions, outside


def zone_membership(
    fractions: np.ndarray,
    outside: np.ndarray,
    visible: np.ndarray,
    threshold: float,
    excluded: np.ndarray | None = None,
) -> np.ndarray:
    """Bool `frames x zones` membership, applying the lab's hysteresis rule: the mouse stays in
    a zone until at least `threshold` of the body is in another zone (or clearly on unzoned
    floor), and re-enters a zone once at least `threshold` of the body is inside it.

    `excluded` (a frame whose start time falls in an exclusion, §4) is treated like a gap: the
    frame is in no zone, and the frame after it is treated as the first analysed frame (the
    "first-frame" rule below), which is how visits split across an exclusion.
    """
    n, n_zones = fractions.shape
    membership = np.zeros((n, n_zones), dtype=bool)
    exclude_mask = excluded if excluded is not None else np.zeros(n, dtype=bool)
    prev_analysed = False
    prev_in = np.zeros(n_zones, dtype=bool)

    for i in range(n):
        if not visible[i] or exclude_mask[i]:
            prev_analysed = False
            continue
        f = fractions[i]
        f_none = outside[i]

        if prev_analysed:
            leaving = prev_in & (f < threshold)
            entering = ~prev_in & (f >= threshold)
            cur = prev_in.copy()
            if leaving.any() and (bool(np.any(f >= threshold)) or f_none >= threshold):
                cur &= ~leaving
            cur |= entering
        else:
            cur = f >= threshold
            if n_zones and not cur.any() and f_none < threshold:
                cur = np.zeros(n_zones, dtype=bool)
                cur[int(np.argmax(f))] = True

        membership[i] = cur
        prev_in = cur
        prev_analysed = True

    return membership
