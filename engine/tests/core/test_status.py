"""analysis/status.py: unresolved_flag_count and video_status."""

from __future__ import annotations

from datetime import timedelta

from tests.core.conftest import make_document, make_track
from tramus_engine.analysis import unresolved_flag_count, video_status
from tramus_engine.domain import (
    AcceptFlag,
    Exclusion,
    Flag,
    FlagReason,
    RectShape,
    Setup,
    TrialWindow,
    VideoStatus,
    Zone,
    new_id,
    utc_now,
)


def _flag(frame: int, t: float) -> Flag:
    return Flag(
        id=f"not_found-{frame}",
        reason=FlagReason.NOT_FOUND,
        frame_start=frame,
        frame_end=frame,
        t_start_s=t,
        t_end_s=t,
        detail="Lost for 0.1 s",
        metric=0.1,
    )


def test_video_status_new_without_document() -> None:
    assert video_status(None) == VideoStatus.NEW


def test_video_status_new_with_empty_setup() -> None:
    doc = make_document(track=None, setup=Setup())
    assert video_status(doc) == VideoStatus.NEW


def test_video_status_set_up_without_track() -> None:
    zone = Zone(id="z", name="Z", color_index=0, shape=RectShape(x=0, y=0, width=10, height=10))
    doc = make_document(track=None, setup=Setup(zones=[zone]))
    assert video_status(doc) == VideoStatus.SET_UP


def test_video_status_tracked_with_unresolved_flags() -> None:
    zone = Zone(id="z", name="Z", color_index=0, shape=RectShape(x=0, y=0, width=10, height=10))
    track = make_track(n=10)
    flag = _flag(2, 0.2)
    doc = make_document(track=track, setup=Setup(zones=[zone]), flags=[flag])
    assert unresolved_flag_count(doc) == 1
    assert video_status(doc) == VideoStatus.TRACKED


def test_video_status_reviewed_once_flags_resolved() -> None:
    zone = Zone(id="z", name="Z", color_index=0, shape=RectShape(x=0, y=0, width=10, height=10))
    track = make_track(n=10)
    flag = _flag(2, 0.2)
    correction = AcceptFlag(id=new_id(), created_at=utc_now(), flag_id=flag.id)
    doc = make_document(
        track=track, setup=Setup(zones=[zone]), flags=[flag], corrections=[correction]
    )
    assert unresolved_flag_count(doc) == 0
    assert video_status(doc) == VideoStatus.REVIEWED


def test_video_status_exported() -> None:
    zone = Zone(id="z", name="Z", color_index=0, shape=RectShape(x=0, y=0, width=10, height=10))
    track = make_track(n=10)
    now = utc_now()
    doc = make_document(track=track, setup=Setup(zones=[zone]))
    doc = doc.model_copy(update={"updated_at": now, "exported_at": now + timedelta(seconds=1)})
    assert video_status(doc) == VideoStatus.EXPORTED


def _range_flag(frame_start: int, frame_end: int, t_start: float, t_end: float) -> Flag:
    return Flag(
        id=f"not_found-{frame_start}",
        reason=FlagReason.NOT_FOUND,
        frame_start=frame_start,
        frame_end=frame_end,
        t_start_s=t_start,
        t_end_s=t_end,
        detail="Lost for 0.3 s",
        metric=0.3,
    )


def test_unresolved_flag_count_hides_flags_entirely_inside_an_exclusion() -> None:
    zone = Zone(id="z", name="Z", color_index=0, shape=RectShape(x=0, y=0, width=10, height=10))
    track = make_track(n=100, dt=0.1)
    hidden = _range_flag(11, 13, 1.1, 1.3)  # entirely inside the exclusion below
    setup = Setup(
        zones=[zone],
        trial=TrialWindow(start_s=1.0, end_s=2.0),
        exclusions=[Exclusion(id="e1", start_s=1.0, end_s=1.5)],
    )
    doc = make_document(track=track, setup=setup, flags=[hidden])
    assert unresolved_flag_count(doc) == 0


def test_unresolved_flag_count_keeps_flags_only_partially_excluded() -> None:
    zone = Zone(id="z", name="Z", color_index=0, shape=RectShape(x=0, y=0, width=10, height=10))
    track = make_track(n=100, dt=0.1)
    straddling = _range_flag(14, 16, 1.4, 1.6)  # half in, half out of the exclusion
    setup = Setup(
        zones=[zone],
        trial=TrialWindow(start_s=1.0, end_s=2.0),
        exclusions=[Exclusion(id="e1", start_s=1.0, end_s=1.5)],
    )
    doc = make_document(track=track, setup=setup, flags=[straddling])
    assert unresolved_flag_count(doc) == 1


def test_unresolved_flag_count_only_counts_flags_overlapping_the_trial() -> None:
    zone = Zone(id="z", name="Z", color_index=0, shape=RectShape(x=0, y=0, width=10, height=10))
    track = make_track(n=100, dt=0.1)
    inside = _flag(5, 0.5)  # within [1.0, 2.0)? no - t=0.5, outside the trial below
    outside_flag = _flag(60, 6.0)  # well outside the trial window
    trial_flag = _flag(15, 1.5)  # inside the trial window [1.0, 2.0)
    setup = Setup(zones=[zone], trial=TrialWindow(start_s=1.0, end_s=2.0))
    doc = make_document(track=track, setup=setup, flags=[inside, outside_flag, trial_flag])
    assert unresolved_flag_count(doc) == 1
