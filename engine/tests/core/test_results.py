"""analysis/results.py: compute_results (§5.5)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from tests.core.conftest import make_document, make_track
from tramus_engine.analysis import compute_results
from tramus_engine.domain import (
    AnalysisSettings,
    Exclusion,
    FrameStatus,
    RectShape,
    Setup,
    TrialWindow,
    Zone,
)

_LEFT = Zone(id="left", name="Left", color_index=0, shape=RectShape(x=0, y=0, width=45, height=100))
_RIGHT = Zone(
    id="right", name="Right", color_index=1, shape=RectShape(x=55, y=0, width=45, height=100)
)


def _moving_track(n: int = 50) -> list[float]:
    # Body walks steadily from x=10 (in Left) to x=90 (in Right) across the track.
    return [10.0 + i * (80.0 / (n - 1)) for i in range(n)]


def test_summary_sums_equal_trial_duration_for_non_overlapping_zones() -> None:
    n = 50
    xs = _moving_track(n)
    track = make_track(n=n, dt=0.1, x=xs, y=[50.0] * n, semi_major=5.0, semi_minor=3.0)
    setup = Setup(zones=[_LEFT, _RIGHT])
    doc = make_document(
        track=track, setup=setup, width=100, height=100, duration_s=track.t[-1] + 0.1
    )

    results = compute_results(doc)
    assert results is not None
    total = sum(row.time_s for row in results.summary)
    assert total == pytest.approx(results.trial_duration_s, abs=1e-6)
    assert sum(row.share_of_analysed for row in results.summary) == pytest.approx(1.0, abs=1e-4)


def test_trial_window_clips_results() -> None:
    n = 50
    xs = _moving_track(n)
    track = make_track(n=n, dt=0.1, x=xs, y=[50.0] * n, semi_major=5.0, semi_minor=3.0)
    setup = Setup(zones=[_LEFT, _RIGHT], trial=TrialWindow(start_s=1.0, end_s=3.0))
    doc = make_document(
        track=track, setup=setup, width=100, height=100, duration_s=track.t[-1] + 0.1
    )

    results = compute_results(doc)
    assert results is not None
    assert results.trial_start_s == 1.0
    assert results.trial_end_s == 3.0
    assert results.trial_duration_s == pytest.approx(2.0)
    total = sum(row.time_s for row in results.summary)
    assert total == pytest.approx(2.0, abs=1e-6)
    for visit in results.visits:
        assert visit.enter_s >= 1.0 - 1e-9
        assert visit.exit_s <= 3.0 + 1e-9


def test_visits_are_numbered_chronologically_across_zones() -> None:
    n = 50
    xs = _moving_track(n)
    track = make_track(n=n, dt=0.1, x=xs, y=[50.0] * n, semi_major=5.0, semi_minor=3.0)
    setup = Setup(zones=[_LEFT, _RIGHT])
    doc = make_document(
        track=track, setup=setup, width=100, height=100, duration_s=track.t[-1] + 0.1
    )

    results = compute_results(doc)
    assert results is not None
    assert [v.index for v in results.visits] == list(range(1, len(results.visits) + 1))
    enter_times = [v.enter_s for v in results.visits]
    assert enter_times == sorted(enter_times)
    # the body starts in Left and ends in Right
    assert results.visits[0].zone_name == "Left"
    assert results.visits[-1].zone_name == "Right"


def test_visit_utc_times_from_recorded_at() -> None:
    n = 10
    track = make_track(n=n, dt=0.1, x=[20.0] * n, y=[50.0] * n, semi_major=5.0, semi_minor=3.0)
    setup = Setup(zones=[_LEFT])
    recorded_at = datetime(2026, 1, 1, 12, 0, 0, tzinfo=UTC)
    doc = make_document(
        track=track, setup=setup, width=100, height=100, duration_s=1.0, recorded_at=recorded_at
    )

    results = compute_results(doc)
    assert results is not None
    assert len(results.visits) == 1
    visit = results.visits[0]
    assert visit.enter_utc == recorded_at
    assert visit.exit_utc is not None
    assert visit.exit_utc > visit.enter_utc


def test_no_zone_and_not_visible_rows() -> None:
    status = [FrameStatus.DETECTED] * 5 + [FrameStatus.MISSING] * 5
    # x=200 is off frame -> "No zone" for the visible-but-unzoned frames.
    track = make_track(n=10, dt=0.1, x=[200.0] * 10, y=[50.0] * 10, status=status)
    setup = Setup(zones=[_LEFT], analysis=AnalysisSettings(in_zone_threshold=0.5))
    doc = make_document(track=track, setup=setup, width=100, height=100, duration_s=1.0)

    results = compute_results(doc)
    assert results is not None
    by_kind = {row.kind.value: row for row in results.summary}
    assert by_kind["zone"].time_s == 0.0
    assert by_kind["no_zone"].time_s == pytest.approx(0.5, abs=1e-6)
    assert by_kind["not_visible"].time_s == pytest.approx(0.5, abs=1e-6)


def test_compute_results_is_none_without_a_track() -> None:
    doc = make_document(track=None)
    assert compute_results(doc) is None


def test_exclusion_reduces_analysed_duration_and_time_sums() -> None:
    n = 50
    track = make_track(n=n, dt=0.1, x=[10.0] * n, y=[50.0] * n, semi_major=5.0, semi_minor=3.0)
    setup = Setup(zones=[_LEFT], exclusions=[Exclusion(id="e1", start_s=2.0, end_s=2.5)])
    doc = make_document(
        track=track, setup=setup, width=100, height=100, duration_s=track.t[-1] + 0.1
    )

    results = compute_results(doc)
    assert results is not None
    assert results.excluded_duration_s == pytest.approx(0.5, abs=1e-6)
    assert results.analysed_duration_s == pytest.approx(results.trial_duration_s - 0.5, abs=1e-6)
    total = sum(row.time_s for row in results.summary)
    assert total == pytest.approx(results.analysed_duration_s, abs=1e-6)
    assert sum(row.share_of_analysed for row in results.summary) == pytest.approx(1.0, abs=1e-4)


def test_exclusion_outside_the_trial_does_not_reduce_analysed_duration() -> None:
    n = 50
    track = make_track(n=n, dt=0.1, x=[10.0] * n, y=[50.0] * n, semi_major=5.0, semi_minor=3.0)
    setup = Setup(
        zones=[_LEFT],
        trial=TrialWindow(start_s=0.0, end_s=1.0),
        exclusions=[Exclusion(id="e1", start_s=3.0, end_s=3.5)],
    )
    doc = make_document(
        track=track, setup=setup, width=100, height=100, duration_s=track.t[-1] + 0.1
    )

    results = compute_results(doc)
    assert results is not None
    assert results.excluded_duration_s == 0.0
    assert results.analysed_duration_s == pytest.approx(results.trial_duration_s)


def test_visit_splits_across_an_exclusion() -> None:
    n = 50
    track = make_track(n=n, dt=0.1, x=[10.0] * n, y=[50.0] * n, semi_major=5.0, semi_minor=3.0)
    setup = Setup(zones=[_LEFT], exclusions=[Exclusion(id="e1", start_s=2.0, end_s=2.5)])
    doc = make_document(
        track=track, setup=setup, width=100, height=100, duration_s=track.t[-1] + 0.1
    )

    results = compute_results(doc)
    assert results is not None
    assert len(results.visits) == 2
    first, second = results.visits
    assert first.zone_name == "Left"
    assert second.zone_name == "Left"
    assert first.exit_s == pytest.approx(2.0, abs=1e-6)
    assert second.enter_s == pytest.approx(2.5, abs=1e-6)
    # No membership — and so no time counted — during the excluded gap.
    assert first.index == 1
    assert second.index == 2
