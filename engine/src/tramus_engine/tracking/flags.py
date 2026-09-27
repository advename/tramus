"""Suspicious-frame detection, run on the post-processed raw track (§5.2).

Consecutive flagged frames of the same reason within `_MERGE_GAP` frames of each other are
merged into a single flag, so a wobbly detection doesn't produce a flood of one-frame flags.
"""

from __future__ import annotations

import math

import numpy as np

from ..domain import VISIBLE_STATUSES, Flag, FlagReason, FrameStatus, Track

_MERGE_GAP = 3


def detect_flags(track: Track) -> list[Flag]:
    flags = [
        *_not_found_flags(track),
        *_sudden_jump_flags(track),
        *_unusual_size_flags(track),
    ]
    flags.sort(key=lambda flag: flag.frame_start)
    return flags


def _merge_runs(indices: list[int]) -> list[tuple[int, int]]:
    """Merge sorted, deduplicated frame indices into inclusive `(start, end)` runs."""
    if not indices:
        return []
    runs = [[indices[0], indices[0]]]
    for index in indices[1:]:
        if index - runs[-1][1] <= _MERGE_GAP:
            runs[-1][1] = index
        else:
            runs.append([index, index])
    return [(start, end) for start, end in runs]


def _not_found_flags(track: Track) -> list[Flag]:
    n = track.frame_count
    t = track.t
    median_dt = float(np.median(np.diff(t))) if n > 1 else 0.0
    missing = [i for i, status in enumerate(track.status) if status == FrameStatus.MISSING]

    flags = []
    for start, end in _merge_runs(missing):
        end_time = t[end + 1] if end + 1 < n else t[end] + median_dt
        duration = end_time - t[start]
        flags.append(
            Flag(
                id=f"{FlagReason.NOT_FOUND}-{start}",
                reason=FlagReason.NOT_FOUND,
                frame_start=start,
                frame_end=end,
                t_start_s=t[start],
                t_end_s=t[end],
                detail=f"Lost for {duration:.1f} s",
                metric=duration,
            )
        )
    return flags


def _sudden_jump_flags(track: Track) -> list[Flag]:
    n = track.frame_count
    t, x, y, semi_major, status = track.t, track.x, track.y, track.semi_major, track.status
    median_dt = float(np.median(np.diff(t))) if n > 1 else 0.0
    majors = [value for value in semi_major if value is not None]
    median_length = 2.0 * float(np.median(majors)) if majors else 0.0

    distances: dict[int, float] = {}
    for i in range(n - 1):
        if status[i] not in VISIBLE_STATUSES or status[i + 1] not in VISIBLE_STATUSES:
            continue
        distance = math.hypot(x[i + 1] - x[i], y[i + 1] - y[i])
        d = t[i + 1] - t[i]
        scale = d / median_dt if median_dt > 0 else 1.0
        if distance > 1.5 * median_length * scale:
            distances[i + 1] = distance

    flags = []
    for start, end in _merge_runs(sorted(distances)):
        metric = max(distances[i] for i in range(start, end + 1) if i in distances)
        frame_span = end - start + 1
        unit = "frame" if frame_span == 1 else "frames"
        flags.append(
            Flag(
                id=f"{FlagReason.SUDDEN_JUMP}-{start}",
                reason=FlagReason.SUDDEN_JUMP,
                frame_start=start,
                frame_end=end,
                t_start_s=t[start],
                t_end_s=t[end],
                detail=f"{round(metric)} px in {frame_span} {unit}",
                metric=metric,
            )
        )
    return flags


def _unusual_size_flags(track: Track) -> list[Flag]:
    n = track.frame_count
    t, area, status = track.t, track.area_px, track.status
    areas = [value for value in area if value is not None]
    if not areas:
        return []
    median_area = float(np.median(areas))
    if median_area <= 0:
        return []

    ratios: dict[int, float] = {}
    for i in range(n):
        if status[i] == FrameStatus.MISSING or area[i] is None:
            continue
        ratio = area[i] / median_area
        if ratio < 0.4 or ratio > 2.5:
            ratios[i] = ratio

    flags = []
    for start, end in _merge_runs(sorted(ratios)):
        run = {i: ratios[i] for i in range(start, end + 1) if i in ratios}
        extreme = max(run, key=lambda i: abs(math.log(run[i])))
        ratio = run[extreme]
        flags.append(
            Flag(
                id=f"{FlagReason.UNUSUAL_SIZE}-{start}",
                reason=FlagReason.UNUSUAL_SIZE,
                frame_start=start,
                frame_end=end,
                t_start_s=t[start],
                t_end_s=t[end],
                detail=f"{ratio:.1f}× typical body size",
                metric=ratio,
            )
        )
    return flags
