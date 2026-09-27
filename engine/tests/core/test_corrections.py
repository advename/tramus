"""analysis/corrections.py: apply_corrections and flag_statuses (§5.3)."""

from __future__ import annotations

from tests.core.conftest import make_track
from tramus_engine.analysis import apply_corrections, flag_statuses
from tramus_engine.domain import (
    AcceptFlag,
    Flag,
    FlagReason,
    FlagStatus,
    FrameStatus,
    Interpolate,
    MarkHidden,
    SetPosition,
    new_id,
    utc_now,
)


def test_set_position_moves_centre_and_copies_geometry_from_nearest_detected() -> None:
    track = make_track(n=5, semi_major=3.0, semi_minor=2.0)
    correction = SetPosition(id=new_id(), created_at=utc_now(), frame=2, x=42.0, y=43.0)
    effective = apply_corrections(track, [correction])

    assert effective.x[2] == 42.0
    assert effective.y[2] == 43.0
    assert effective.status[2] == FrameStatus.MANUAL
    # geometry copied from a still-detected neighbour
    assert effective.semi_major[2] == track.semi_major[0]
    # other frames untouched
    assert effective.x[0] == track.x[0]
    assert effective.status[0] == FrameStatus.DETECTED


def test_mark_hidden_clears_geometry_and_sets_status() -> None:
    track = make_track(n=5)
    correction = MarkHidden(id=new_id(), created_at=utc_now(), frame_start=1, frame_end=3)
    effective = apply_corrections(track, [correction])

    for i in (1, 2, 3):
        assert effective.status[i] == FrameStatus.HIDDEN
        assert effective.x[i] is None
        assert effective.semi_major[i] is None
    assert effective.status[0] == FrameStatus.DETECTED
    assert effective.status[4] == FrameStatus.DETECTED


def test_interpolate_uses_anchors_outside_the_range() -> None:
    x = [0.0, 10.0, 20.0, 30.0, 40.0]
    track = make_track(n=5, x=x)
    correction = Interpolate(id=new_id(), created_at=utc_now(), frame_start=1, frame_end=3)
    effective = apply_corrections(track, [correction])

    assert effective.status[1] == FrameStatus.INTERPOLATED
    assert effective.status[2] == FrameStatus.INTERPOLATED
    assert effective.status[3] == FrameStatus.INTERPOLATED
    # anchors are frame 0 (x=0) and frame 4 (x=40); frame 2 sits at the midpoint
    assert effective.x[2] == 20.0
    assert effective.status[0] == FrameStatus.DETECTED
    assert effective.status[4] == FrameStatus.DETECTED


def test_interpolate_copies_the_single_anchor_when_only_one_side_visible() -> None:
    status = [FrameStatus.MISSING] * 3 + [FrameStatus.DETECTED] * 2
    x = [None, None, None, 50.0, 60.0]
    track = make_track(n=5, x=[v or 0.0 for v in x], status=status)
    correction = Interpolate(id=new_id(), created_at=utc_now(), frame_start=0, frame_end=2)
    effective = apply_corrections(track, [correction])
    for i in range(3):
        assert effective.status[i] == FrameStatus.INTERPOLATED
        assert effective.x[i] == 50.0  # only anchor is frame 3


def test_corrections_apply_in_order() -> None:
    track = make_track(n=5)
    corrections = [
        SetPosition(id=new_id(), created_at=utc_now(), frame=2, x=1.0, y=1.0),
        MarkHidden(id=new_id(), created_at=utc_now(), frame_start=2, frame_end=2),
    ]
    effective = apply_corrections(track, corrections)
    # the mark_hidden correction runs after set_position, so it wins
    assert effective.status[2] == FrameStatus.HIDDEN
    assert effective.x[2] is None


def test_flag_statuses_accepted_fixed_and_unresolved() -> None:
    flags = [
        Flag(
            id="not_found-2",
            reason=FlagReason.NOT_FOUND,
            frame_start=2,
            frame_end=4,
            t_start_s=0.2,
            t_end_s=0.4,
            detail="Lost for 0.2 s",
            metric=0.2,
        ),
        Flag(
            id="sudden_jump-8",
            reason=FlagReason.SUDDEN_JUMP,
            frame_start=8,
            frame_end=8,
            t_start_s=0.8,
            t_end_s=0.8,
            detail="50 px in 1 frame",
            metric=50.0,
        ),
        Flag(
            id="unusual_size-12",
            reason=FlagReason.UNUSUAL_SIZE,
            frame_start=12,
            frame_end=12,
            t_start_s=1.2,
            t_end_s=1.2,
            detail="3.0× typical body size",
            metric=3.0,
        ),
    ]
    corrections = [
        AcceptFlag(id=new_id(), created_at=utc_now(), flag_id="not_found-2"),
        SetPosition(id=new_id(), created_at=utc_now(), frame=8, x=1.0, y=1.0),
    ]
    statuses = flag_statuses(flags, corrections)
    assert statuses["not_found-2"] == FlagStatus.ACCEPTED
    assert statuses["sudden_jump-8"] == FlagStatus.FIXED
    assert statuses["unusual_size-12"] == FlagStatus.UNRESOLVED
