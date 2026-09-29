"""Zone crossings: rule-matched transitions between zone stays, plus the full transition matrix.

A "stay" is a continuous run of membership in one zone, within one continuity segment (§5.5's
analysed intervals — exclusions break the chain, nothing else does). Two rules make the floor
and gaps in visibility transparent before a stay is considered "over":

* **Not-visible gaps are transparent**: consecutive stays of the *same* zone separated only by
  not-visible frames (no other zone entered in between — trivially true, since a not-visible
  frame is in no zone) are merged into one stay. A crossing through the gap to a *different*
  zone still counts.
* **Unzoned floor is transparent for crossings, not for merging**: a visible-but-unzoned frame
  between two stays of the same zone prevents the merge (so re-entering the same zone after
  walking onto open floor is a genuine crossing, X→X), while a crossing to a *different* zone
  across unzoned floor is counted normally (no special-casing needed — see below).

A crossing fires at the moment a stay starts (zone Y entered). Its "from" is the stay — of any
zone, in the same continuity segment — that most recently *ended* at or before that moment; a
zone still occupied at entry time is never a "from" (only stays that have actually exited are
candidates). Ties (equal exit time) go to the stay that ended last, using the order in which
stays start (a stable, arbitrary but deterministic tie-break — see `_crossings_for_segment`).
The first stay to start in a continuity segment has no candidate and so isn't a crossing.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

from ..domain import CrossingEvent, CrossingResult, CrossingRule, MatrixCell, Zone
from .exclusions import Interval

_ROUND = 6


@dataclass(frozen=True)
class _Stay:
    zone_id: str
    enter_frame: int
    exit_frame: int
    enter_s: float
    exit_s: float
    order: int  # position among this segment's stays, sorted by (enter_s, exit_frame)


def _zone_runs(column: np.ndarray, segment_mask: np.ndarray) -> list[tuple[int, int]]:
    """Contiguous frame-index runs where `column` is `True`, restricted to `segment_mask`."""
    active = column & segment_mask
    idx = np.flatnonzero(active)
    if idx.size == 0:
        return []
    breaks = np.flatnonzero(np.diff(idx) > 1)
    starts = np.concatenate(([idx[0]], idx[breaks + 1]))
    ends = np.concatenate((idx[breaks], [idx[-1]]))
    return list(zip(starts.tolist(), ends.tolist(), strict=True))


def _merge_not_visible_gaps(
    runs: list[tuple[int, int]], visible: np.ndarray
) -> list[tuple[int, int]]:
    """Merges consecutive runs of one zone separated only by not-visible frames."""
    merged: list[tuple[int, int]] = []
    for start, end in runs:
        if merged and not visible[merged[-1][1] + 1 : start].any():
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))
    return merged


def _stays_for_segment(
    membership: np.ndarray,
    visible: np.ndarray,
    segment_mask: np.ndarray,
    zones: list[Zone],
    t: np.ndarray,
    frame_end_times: np.ndarray,
) -> list[_Stay]:
    raw: list[tuple[str, int, int]] = []
    for zi, zone in enumerate(zones):
        runs = _zone_runs(membership[:, zi], segment_mask)
        for start, end in _merge_not_visible_gaps(runs, visible):
            raw.append((zone.id, start, end))
    raw.sort(key=lambda s: (t[s[1]], s[2]))
    return [
        _Stay(
            zone_id=zone_id,
            enter_frame=start,
            exit_frame=end,
            enter_s=float(t[start]),
            exit_s=float(frame_end_times[end]),
            order=order,
        )
        for order, (zone_id, start, end) in enumerate(raw)
    ]


def _crossings_for_segment(stays: list[_Stay]) -> list[tuple[_Stay | None, _Stay]]:
    """`(from_stay, to_stay)` for each stay's entry: `from_stay` is `None` when nothing has
    ended yet at that moment (the segment's first entry, or ties among simultaneous starts)."""
    pairs: list[tuple[_Stay | None, _Stay]] = []
    for entry in stays:
        candidates = [s for s in stays if s is not entry and s.exit_s <= entry.enter_s]
        best = max(candidates, key=lambda s: (s.exit_s, s.order), default=None)
        pairs.append((best, entry))
    return pairs


def _frame_segment_index(t: np.ndarray, intervals: list[Interval]) -> np.ndarray:
    """Which analysed interval a frame's start time falls in, or -1 for none (outside the trial
    or inside an exclusion) — the continuity-segment boundary crossings must respect."""
    idx = np.full(t.shape, -1, dtype=np.int64)
    for i, (start, end) in enumerate(intervals):
        idx[(t >= start) & (t < end)] = i
    return idx


def _rule_matches(rule: CrossingRule, event: CrossingEvent) -> bool:
    from_ok = rule.from_zone_id is None or rule.from_zone_id == event.from_zone_id
    to_ok = rule.to_zone_id is None or rule.to_zone_id == event.to_zone_id
    return from_ok and to_ok


def compute_crossings(
    *,
    t: np.ndarray,
    frame_end_times: np.ndarray,
    membership: np.ndarray,
    visible: np.ndarray,
    zones: list[Zone],
    intervals: list[Interval],
    rules: list[CrossingRule],
    recorded_at: datetime | None,
) -> tuple[list[CrossingResult], list[MatrixCell]]:
    """Rule-matched crossing counts/events, and the full from×to matrix in `zones` order."""
    segment_index = _frame_segment_index(t, intervals)

    events: list[CrossingEvent] = []
    for seg in range(len(intervals)):
        stays = _stays_for_segment(
            membership, visible, segment_index == seg, zones, t, frame_end_times
        )
        for from_stay, entry in _crossings_for_segment(stays):
            if from_stay is None:
                continue
            events.append(
                CrossingEvent(
                    frame=entry.enter_frame,
                    time_s=round(entry.enter_s, _ROUND),
                    time_utc=(
                        recorded_at + timedelta(seconds=entry.enter_s)
                        if recorded_at is not None
                        else None
                    ),
                    from_zone_id=from_stay.zone_id,
                    to_zone_id=entry.zone_id,
                )
            )
    events.sort(key=lambda e: e.time_s)

    results = [
        CrossingResult(
            rule_id=rule.id,
            from_zone_id=rule.from_zone_id,
            to_zone_id=rule.to_zone_id,
            count=len(matched),
            events=matched,
        )
        for rule in rules
        for matched in ([e for e in events if _rule_matches(rule, e)],)
    ]

    matrix = [
        MatrixCell(
            from_zone_id=from_zone.id,
            to_zone_id=to_zone.id,
            count=sum(
                1 for e in events if e.from_zone_id == from_zone.id and e.to_zone_id == to_zone.id
            ),
        )
        for from_zone in zones
        for to_zone in zones
    ]

    return results, matrix
