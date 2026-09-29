"""Excluded periods: time subtracted from the trial window before analysis (§4, §5.5).

Pure interval arithmetic — no dependency on tracks or zones — so it's reused by results,
crossings and the session's flag-visibility filter.
"""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np

from ..domain import Exclusion

Interval = tuple[float, float]


def _merge_intervals(intervals: Sequence[Interval]) -> list[Interval]:
    """Sorts and merges overlapping/touching intervals."""
    ordered = sorted((start, end) for start, end in intervals if end > start)
    merged: list[Interval] = []
    for start, end in ordered:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def clipped_exclusions(
    exclusions: Sequence[Exclusion], trial_start: float, trial_end: float
) -> list[Interval]:
    """`exclusions` clipped to `[trial_start, trial_end)`, merged and sorted; exclusions entirely
    outside the trial are dropped."""
    clipped = [(max(excl.start_s, trial_start), min(excl.end_s, trial_end)) for excl in exclusions]
    return _merge_intervals(clipped)


def analysed_intervals(
    trial_start: float, trial_end: float, exclusions: Sequence[Exclusion]
) -> list[Interval]:
    """`[trial_start, trial_end)` minus the union of `exclusions`, as sorted, non-overlapping
    sub-intervals (the "analysed time", §5.5)."""
    excluded = clipped_exclusions(exclusions, trial_start, trial_end)
    intervals: list[Interval] = []
    cursor = trial_start
    for start, end in excluded:
        if start > cursor:
            intervals.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < trial_end:
        intervals.append((cursor, trial_end))
    return intervals


def excluded_duration_s(
    trial_start: float, trial_end: float, exclusions: Sequence[Exclusion]
) -> float:
    """Total excluded time, clipped to the trial (exclusions may overlap each other)."""
    return sum(end - start for start, end in clipped_exclusions(exclusions, trial_start, trial_end))


def frame_is_excluded(frame_start_times: np.ndarray, exclusions: Sequence[Exclusion]) -> np.ndarray:
    """Bool per frame: the frame's start time falls inside an exclusion (§5.4 membership rule).
    Independent of the trial — frames outside the trial simply don't matter downstream."""
    excluded = np.zeros(frame_start_times.shape, dtype=bool)
    for excl in exclusions:
        excluded |= (frame_start_times >= excl.start_s) & (frame_start_times < excl.end_s)
    return excluded


def frame_interval_overlap(
    frame_starts: np.ndarray, frame_ends: np.ndarray, intervals: Sequence[Interval]
) -> np.ndarray:
    """Seconds of `[frame_starts[i], frame_ends[i])` inside the union of `intervals`, per frame
    (the same partial-frame clipping used for the trial)."""
    overlap = np.zeros(frame_starts.shape, dtype=np.float64)
    for start, end in intervals:
        segment = np.minimum(frame_ends, end) - np.maximum(frame_starts, start)
        overlap += np.clip(segment, 0.0, None)
    return overlap


def is_interval_fully_excluded(start: float, end: float, exclusions: Sequence[Exclusion]) -> bool:
    """True if `[start, end)` is entirely covered by the union of `exclusions` (used to hide
    flags lying entirely inside excluded time)."""
    remaining: list[Interval] = [(start, end)]
    for excl in exclusions:
        next_remaining: list[Interval] = []
        for seg_start, seg_end in remaining:
            if excl.end_s <= seg_start or excl.start_s >= seg_end:
                next_remaining.append((seg_start, seg_end))
                continue
            if excl.start_s > seg_start:
                next_remaining.append((seg_start, excl.start_s))
            if excl.end_s < seg_end:
                next_remaining.append((excl.end_s, seg_end))
        remaining = next_remaining
        if not remaining:
            return True
    return not remaining
