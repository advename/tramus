"""analysis/distance.py: compute_distance_mm."""

from __future__ import annotations

import pytest

from tests.core.conftest import make_document, make_track
from tramus_engine.analysis import compute_distance_mm
from tramus_engine.domain import Calibration, Exclusion, FrameStatus, Setup

_MM_PER_PX_1 = Calibration(x1=0, y1=0, x2=1, y2=0, length_mm=1)  # mm_per_px == 1, so mm == px


def test_no_calibration_gives_none() -> None:
    track = make_track(n=20, x=[float(i) for i in range(20)], y=[0.0] * 20)
    doc = make_document(track=track, setup=Setup(), duration_s=2.0)
    assert compute_distance_mm(doc, track) is None


def test_straight_line_motion_gives_the_known_distance() -> None:
    n = 100
    track = make_track(n=n, x=[float(i) for i in range(n)], y=[0.0] * n)
    doc = make_document(track=track, setup=Setup(calibration=_MM_PER_PX_1), duration_s=n * 0.1)

    distance = compute_distance_mm(doc, track)
    assert distance is not None
    # True path length is 99 px; the centred moving average trims a couple of px at each end of
    # the run (its window shrinks there), so the result is close to but a little under that.
    assert distance == pytest.approx(99.0, rel=0.05)


def test_jittery_stationary_mouse_gives_approximately_zero() -> None:
    n = 60
    # Small alternating jitter around a fixed point — well under the noise floor once smoothed.
    xs = [10.0 + (0.3 if i % 2 == 0 else -0.3) for i in range(n)]
    ys = [10.0 + (0.2 if i % 3 == 0 else -0.1) for i in range(n)]
    track = make_track(n=n, x=xs, y=ys)
    doc = make_document(track=track, setup=Setup(calibration=_MM_PER_PX_1), duration_s=n * 0.1)

    distance = compute_distance_mm(doc, track)
    assert distance is not None
    assert distance == pytest.approx(0.0, abs=1.0)


def test_not_visible_gap_is_bridged_with_a_straight_line() -> None:
    n = 100
    xs = [float(i) for i in range(n)]
    status = [FrameStatus.DETECTED] * n
    for i in range(40, 50):  # a 1s gap in the middle of an otherwise straight walk
        status[i] = FrameStatus.MISSING
    gapped = make_track(n=n, x=xs, status=status)
    continuous = make_track(n=n, x=xs)

    doc_gapped = make_document(
        track=gapped, setup=Setup(calibration=_MM_PER_PX_1), duration_s=n * 0.1
    )
    doc_continuous = make_document(
        track=continuous, setup=Setup(calibration=_MM_PER_PX_1), duration_s=n * 0.1
    )

    gapped_distance = compute_distance_mm(doc_gapped, gapped)
    continuous_distance = compute_distance_mm(doc_continuous, continuous)
    assert gapped_distance is not None and continuous_distance is not None
    # A straight-line bridge across the gap reproduces (approximately) the same path length as
    # if the mouse had never been lost, because the true motion is itself a straight line.
    assert gapped_distance == pytest.approx(continuous_distance, rel=0.1)


def test_exclusion_breaks_the_path_instead_of_bridging_it() -> None:
    n = 60
    xs = [float(i) for i in range(n)]
    track = make_track(n=n, x=xs)
    doc_no_excl = make_document(
        track=track, setup=Setup(calibration=_MM_PER_PX_1), duration_s=n * 0.1
    )

    # Give the excluded stretch (t in [2.5, 3.5), i.e. frames 25..34) wild positions. If the
    # excluded gap were bridged like a not-visible gap, or if those frames leaked into either
    # neighbouring segment, the result would balloon; since they're outside both analysed
    # intervals, they must be ignored entirely and the excluded segment must not be replaced by
    # a straight line across it either.
    xs_wild = list(xs)
    for i in range(25, 35):
        xs_wild[i] = 10_000.0
    track_wild = make_track(n=n, x=xs_wild)
    setup_excl = Setup(
        calibration=_MM_PER_PX_1, exclusions=[Exclusion(id="e1", start_s=2.5, end_s=3.5)]
    )
    doc_excl = make_document(track=track_wild, setup=setup_excl, duration_s=n * 0.1)

    no_excl_distance = compute_distance_mm(doc_no_excl, track)
    excl_distance = compute_distance_mm(doc_excl, track_wild)
    assert no_excl_distance is not None and excl_distance is not None
    # Excluding ~10 px of the straight walk (and never bridging across it) leaves a total not far
    # below the unexcluded distance, and nowhere near the ~20 000 px a bridge across the wild
    # excluded values would produce.
    assert excl_distance < no_excl_distance
    assert excl_distance == pytest.approx(no_excl_distance, abs=15.0)


def test_empty_track_gives_zero() -> None:
    track = make_track(n=0, x=[], y=[])
    doc = make_document(track=track, setup=Setup(calibration=_MM_PER_PX_1), duration_s=1.0)
    assert compute_distance_mm(doc, track) == 0.0
