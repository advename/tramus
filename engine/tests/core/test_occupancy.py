"""analysis/occupancy.py: zone_fractions and the hysteresis in zone_membership (§5.4)."""

from __future__ import annotations

import numpy as np

from tests.core.conftest import make_track
from tramus_engine.analysis import zone_fractions, zone_membership
from tramus_engine.domain import VISIBLE_STATUSES, FrameStatus, RectShape, Zone

# A 10 px unzoned gap between the two zones, like a doorway between chambers.
_LEFT = Zone(id="left", name="Left", color_index=0, shape=RectShape(x=0, y=0, width=45, height=100))
_RIGHT = Zone(
    id="right", name="Right", color_index=1, shape=RectShape(x=55, y=0, width=45, height=100)
)
_NESTED_OUTER = Zone(
    id="outer", name="Outer", color_index=2, shape=RectShape(x=0, y=0, width=100, height=100)
)
_NESTED_INNER = Zone(
    id="inner", name="Inner", color_index=3, shape=RectShape(x=10, y=10, width=20, height=20)
)


def _membership(
    x: list[float],
    zones: list[Zone],
    *,
    y: float = 50.0,
    semi_major: float = 5.0,
    semi_minor: float = 3.0,
    threshold: float = 0.5,
    excluded: np.ndarray | None = None,
) -> np.ndarray:
    track = make_track(n=len(x), x=x, y=[y] * len(x), semi_major=semi_major, semi_minor=semi_minor)
    fractions, outside = zone_fractions(track, zones, width=100, height=100)
    visible = np.array([status in VISIBLE_STATUSES for status in track.status])
    return zone_membership(fractions, outside, visible, threshold, excluded=excluded)


def test_first_frame_assigns_the_qualifying_zone() -> None:
    membership = _membership([25.0], [_LEFT, _RIGHT])
    assert membership[0, 0]  # inside Left
    assert not membership[0, 1]


def test_straddling_a_doorway_stays_in_the_previous_zone() -> None:
    # A body this size (comparable to the mouse's own body) centred at x=48, just past the
    # Left zone's edge (45) and short of Right's (55), splits roughly Left 0.39 / Right 0.30 /
    # none 0.31 - no zone reaches the 0.5 threshold, so hysteresis keeps the mouse in Left.
    x = [15.0, 48.0, 48.0, 48.0]
    membership = _membership(x, [_LEFT, _RIGHT], semi_major=20.0, semi_minor=12.0)
    assert membership[0, 0]
    for i in range(1, 4):
        assert membership[i, 0], f"frame {i} should still be in Left"
        assert not membership[i, 1]


def test_leaving_onto_unzoned_floor_exits_the_zone() -> None:
    # Move from well inside Left to well outside the frame entirely (unambiguously unzoned).
    x = [25.0] * 3 + [140.0] * 3
    membership = _membership(x, [_LEFT, _RIGHT])
    assert membership[2, 0]
    assert not membership[5, 0]
    assert not membership[5, 1]


def test_nested_zones_are_independent() -> None:
    # Body centred inside the small inner zone (x, y in [10, 30]) is also inside the big outer
    # zone that covers the whole frame; membership is tracked separately per zone.
    membership = _membership(
        [20.0], [_NESTED_OUTER, _NESTED_INNER], y=20.0, semi_major=1.0, semi_minor=1.0
    )
    assert membership[0, 0]  # Outer
    assert membership[0, 1]  # Inner


def test_missing_and_hidden_frames_are_in_no_zone() -> None:
    status = [FrameStatus.DETECTED, FrameStatus.MISSING, FrameStatus.HIDDEN, FrameStatus.DETECTED]
    track = make_track(n=4, x=[25.0] * 4, y=[50.0] * 4, status=status)
    fractions, outside = zone_fractions(track, [_LEFT, _RIGHT], width=100, height=100)
    visible = np.array([s in VISIBLE_STATUSES for s in track.status])
    membership = zone_membership(fractions, outside, visible, 0.5)
    assert not membership[1].any()
    assert not membership[2].any()
    assert membership[0, 0]
    assert membership[3, 0]


def test_excluded_frames_are_in_no_zone_even_though_visible() -> None:
    # Body stays firmly inside Left the whole time; frame 1 is excluded.
    excluded = np.array([False, True, False, False])
    membership = _membership([25.0] * 4, [_LEFT, _RIGHT], excluded=excluded)
    assert membership[0, 0]
    assert not membership[1].any()  # excluded, despite being visible and inside Left
    assert membership[2, 0]
    assert membership[3, 0]


def test_excluded_frame_forces_no_zone_and_resets_continuity() -> None:
    # Hand-crafted fractions isolate the hysteresis reset from geometry: frame 1's ambiguous
    # split (neither zone nor "none" reaches the threshold) is kept in A by continuity, but the
    # identical split at frame 3 — the first analysed frame after the excluded frame 2 — uses
    # the first-frame rule instead, and lands in B (the larger fraction).
    threshold = 0.5
    fractions = np.array(
        [
            [0.8, 0.1],  # frame 0: clearly in A (first frame of the track)
            [0.3, 0.1],  # frame 1: ambiguous; hysteresis keeps A
            [0.3, 0.4],  # frame 2: excluded — value is irrelevant
            [0.3, 0.4],  # frame 3: same split as frame 1, but first frame after the exclusion
        ]
    )
    outside = np.array([0.1, 0.4, 0.3, 0.3])
    visible = np.ones(4, dtype=bool)
    excluded = np.array([False, False, True, False])

    membership = zone_membership(fractions, outside, visible, threshold, excluded=excluded)

    assert membership[0].tolist() == [True, False]
    assert membership[1].tolist() == [True, False]
    assert not membership[2].any()
    assert membership[3].tolist() == [False, True]
