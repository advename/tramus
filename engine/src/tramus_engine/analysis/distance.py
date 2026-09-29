"""Distance travelled by the body centre over the analysed time (§5.5), in mm.

Pure — takes the effective (corrected) track and the document's setup/calibration, returns a
number. Never reads or writes anything.
"""

from __future__ import annotations

import numpy as np

from ..domain import VISIBLE_STATUSES, AnalysisDocument, Track
from .exclusions import analysed_intervals

# Centred moving-average window (frames) applied to the body centre before measuring steps, within
# each continuous visible run. 5 frames removes single-frame centroid jitter from blob-detection
# noise (the contour's edge wobbles a pixel or two frame to frame even for a stationary mouse)
# without smearing genuine movement: at the sample videos' ~25 fps that's ~160-200 ms, short
# compared to a real locomotion bout.
SMOOTH_WINDOW_FRAMES = 5

# Steps shorter than this (after smoothing), in px, are residual detection jitter rather than
# movement and are dropped from the running total instead of being summed as distance.
NOISE_FLOOR_PX = 0.5


def compute_distance_mm(document: AnalysisDocument, effective: Track) -> float | None:
    """`None` without a calibration (`Setup.calibration`). `effective` must already reflect
    `document.corrections` (the caller applies them; this module never does).

    Walks the analysed intervals (trial minus exclusions, §5.5) independently — distance never
    bridges an exclusion or a trial edge. Within one interval, not-visible frames (missing/hidden)
    are bridged with a straight line between the nearest visible frames on each side; frames
    outside every visible frame of the interval (leading/trailing gaps) contribute nothing.
    """
    calibration = document.setup.calibration
    if calibration is None:
        return None

    setup, video = document.setup, document.video
    trial_start = setup.trial.start_s if setup.trial else 0.0
    trial_end = setup.trial.end_s if setup.trial else video.duration_s
    intervals = analysed_intervals(trial_start, trial_end, setup.exclusions)
    if not intervals or effective.frame_count == 0:
        return 0.0

    t = np.asarray(effective.t, dtype=np.float64)
    visible = np.array([status in VISIBLE_STATUSES for status in effective.status], dtype=bool)
    xs = np.array([x if x is not None else np.nan for x in effective.x], dtype=np.float64)
    ys = np.array([y if y is not None else np.nan for y in effective.y], dtype=np.float64)

    total_px = 0.0
    for start, end in intervals:
        idx = np.flatnonzero((t >= start) & (t < end))
        if idx.size == 0:
            continue
        total_px += _segment_distance_px(visible[idx], xs[idx], ys[idx])

    return total_px * calibration.mm_per_px


def _segment_distance_px(visible: np.ndarray, x: np.ndarray, y: np.ndarray) -> float:
    """Distance travelled within one continuity segment (already restricted to one analysed
    interval — never bridges beyond it)."""
    vis_idx = np.flatnonzero(visible)
    if vis_idx.size < 2:
        return 0.0

    # Bridge not-visible frames strictly between the first and last visible frame of the segment
    # with a straight line; never extrapolate past the segment's own visible range.
    positions = np.arange(vis_idx[0], vis_idx[-1] + 1)
    fx = np.interp(positions, vis_idx, x[vis_idx])
    fy = np.interp(positions, vis_idx, y[vis_idx])

    sx = _centered_moving_average(fx, SMOOTH_WINDOW_FRAMES)
    sy = _centered_moving_average(fy, SMOOTH_WINDOW_FRAMES)

    steps = np.hypot(np.diff(sx), np.diff(sy))
    steps = steps[steps >= NOISE_FLOOR_PX]
    return float(np.sum(steps)) if steps.size else 0.0


def _centered_moving_average(values: np.ndarray, window: int) -> np.ndarray:
    """A centred moving average with a window that shrinks near the edges instead of padding or
    wrapping (no bridging beyond the segment's own visible positions)."""
    n = values.shape[0]
    if n == 0 or window <= 1:
        return values
    half = window // 2
    out = np.empty_like(values)
    for i in range(n):
        lo = max(0, i - half)
        hi = min(n, i + half + 1)
        out[i] = np.mean(values[lo:hi])
    return out
