"""analysis/exclusions.py: interval arithmetic for excluded periods (§4, §5.5)."""

from __future__ import annotations

import numpy as np
import pytest

from tramus_engine.analysis.exclusions import (
    analysed_intervals,
    clipped_exclusions,
    excluded_duration_s,
    frame_interval_overlap,
    frame_is_excluded,
    is_interval_fully_excluded,
)
from tramus_engine.domain import Exclusion


def _excl(start: float, end: float, note: str | None = None) -> Exclusion:
    return Exclusion(id=f"e-{start}", start_s=start, end_s=end, note=note)


def test_analysed_intervals_with_no_exclusions_is_the_whole_trial() -> None:
    assert analysed_intervals(0.0, 10.0, []) == [(0.0, 10.0)]


def test_analysed_intervals_subtracts_a_middle_exclusion() -> None:
    intervals = analysed_intervals(0.0, 10.0, [_excl(3.0, 5.0)])
    assert intervals == [(0.0, 3.0), (5.0, 10.0)]


def test_analysed_intervals_merges_overlapping_exclusions() -> None:
    intervals = analysed_intervals(0.0, 10.0, [_excl(3.0, 6.0), _excl(5.0, 8.0)])
    assert intervals == [(0.0, 3.0), (8.0, 10.0)]


def test_analysed_intervals_clips_exclusions_to_the_trial() -> None:
    intervals = analysed_intervals(2.0, 8.0, [_excl(0.0, 4.0), _excl(7.0, 12.0)])
    assert intervals == [(4.0, 7.0)]


def test_analysed_intervals_exclusion_covering_the_whole_trial_leaves_nothing() -> None:
    assert analysed_intervals(0.0, 10.0, [_excl(0.0, 10.0)]) == []


def test_excluded_duration_s_sums_clipped_exclusions() -> None:
    assert excluded_duration_s(0.0, 10.0, [_excl(3.0, 5.0), _excl(8.0, 20.0)]) == pytest.approx(4.0)


def test_excluded_duration_s_ignores_exclusions_outside_the_trial() -> None:
    assert excluded_duration_s(0.0, 10.0, [_excl(20.0, 30.0)]) == 0.0


def test_clipped_exclusions_merges_and_sorts() -> None:
    result = clipped_exclusions([_excl(5.0, 6.0), _excl(1.0, 2.0)], 0.0, 10.0)
    assert result == [(1.0, 2.0), (5.0, 6.0)]


def test_frame_is_excluded_uses_frame_start_time() -> None:
    t = np.array([0.0, 1.0, 2.0, 3.0, 4.0])
    excluded = frame_is_excluded(t, [_excl(1.0, 3.0)])
    assert excluded.tolist() == [False, True, True, False, False]


def test_frame_is_excluded_with_no_exclusions_is_all_false() -> None:
    t = np.array([0.0, 1.0, 2.0])
    assert not frame_is_excluded(t, []).any()


def test_frame_interval_overlap_clips_partial_frames() -> None:
    # Two 1s frames straddling an analysed interval boundary at t=1.5.
    starts = np.array([0.0, 1.0])
    ends = np.array([1.0, 2.0])
    overlap = frame_interval_overlap(starts, ends, [(0.0, 1.5)])
    assert overlap.tolist() == pytest.approx([1.0, 0.5])


def test_frame_interval_overlap_sums_across_multiple_intervals() -> None:
    starts = np.array([0.0])
    ends = np.array([10.0])
    overlap = frame_interval_overlap(starts, ends, [(1.0, 3.0), (5.0, 6.0)])
    assert overlap[0] == pytest.approx(3.0)


def test_is_interval_fully_excluded_true_when_covered_by_one_exclusion() -> None:
    assert is_interval_fully_excluded(2.0, 4.0, [_excl(0.0, 5.0)])


def test_is_interval_fully_excluded_false_when_partially_outside() -> None:
    assert not is_interval_fully_excluded(2.0, 6.0, [_excl(0.0, 5.0)])


def test_is_interval_fully_excluded_true_when_covered_by_union_of_exclusions() -> None:
    assert is_interval_fully_excluded(2.0, 6.0, [_excl(1.0, 4.0), _excl(4.0, 7.0)])


def test_is_interval_fully_excluded_false_with_no_exclusions() -> None:
    assert not is_interval_fully_excluded(2.0, 4.0, [])
