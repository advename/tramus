"""analysis/history.py: build_history (§5.6)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tests.core.conftest import make_document, make_track
from tramus_engine.analysis import build_history
from tramus_engine.domain import (
    AcceptFlag,
    Flag,
    FlagReason,
    HistoryKind,
    Interpolate,
    MarkHidden,
    SetPosition,
    SetupChange,
    new_id,
)

_T0 = datetime(2026, 1, 1, tzinfo=UTC)


def test_history_is_newest_first_and_includes_tracking_finished() -> None:
    track = make_track(n=10)
    corrections = [
        SetPosition(id=new_id(), created_at=_T0 + timedelta(seconds=10), frame=1, x=1.0, y=1.0),
        MarkHidden(id=new_id(), created_at=_T0 + timedelta(seconds=20), frame_start=2, frame_end=3),
    ]
    doc = make_document(track=track, corrections=corrections)
    # track.tracked_at is "now" (after all correction timestamps), so it sorts first only if
    # its timestamp is actually the newest; force that ordering explicitly for the assertion.
    entries = build_history(doc)
    kinds = [e.kind for e in entries]
    assert HistoryKind.TRACKED in kinds
    assert HistoryKind.SET_POSITION in kinds
    assert HistoryKind.MARK_HIDDEN in kinds
    # newest first
    ats = [e.at for e in entries]
    assert ats == sorted(ats, reverse=True)


def test_set_position_detail_shows_previous_and_new_position() -> None:
    track = make_track(n=5, x=[10.0, 20.0, 30.0, 40.0, 50.0], y=[1.0] * 5)
    correction = SetPosition(id=new_id(), created_at=_T0, frame=2, x=796.0, y=944.0)
    doc = make_document(track=track, corrections=[correction])
    entries = build_history(doc)
    entry = next(e for e in entries if e.kind == HistoryKind.SET_POSITION)
    assert entry.title == "Set position"
    assert entry.detail == "(30, 1) → (796, 944) px"


def test_set_position_detail_with_no_previous_position() -> None:
    from tramus_engine.domain import FrameStatus

    status = [FrameStatus.MISSING] * 5
    track = make_track(n=5, status=status)
    correction = SetPosition(id=new_id(), created_at=_T0, frame=2, x=796.0, y=944.0)
    doc = make_document(track=track, corrections=[correction])
    entries = build_history(doc)
    entry = next(e for e in entries if e.kind == HistoryKind.SET_POSITION)
    assert entry.detail == "→ (796, 944) px"


def test_interpolate_and_mark_hidden_detail_counts() -> None:
    track = make_track(n=30)
    corrections = [
        Interpolate(id=new_id(), created_at=_T0, frame_start=0, frame_end=23),
        MarkHidden(id=new_id(), created_at=_T0 + timedelta(seconds=1), frame_start=0, frame_end=23),
    ]
    doc = make_document(track=track, corrections=corrections)
    entries = build_history(doc)
    fill = next(e for e in entries if e.kind == HistoryKind.INTERPOLATE)
    hidden = next(e for e in entries if e.kind == HistoryKind.MARK_HIDDEN)
    assert fill.title == "Fill in between"
    assert fill.detail == "24 frames interpolated"
    assert hidden.title == "Mouse not visible"
    assert hidden.detail == "24 frames excluded from zone times"


def test_accept_flag_detail_uses_reason_label() -> None:
    track = make_track(n=10)
    flag = Flag(
        id="not_found-2",
        reason=FlagReason.NOT_FOUND,
        frame_start=2,
        frame_end=4,
        t_start_s=0.2,
        t_end_s=0.4,
        detail="Lost for 0.2 s",
        metric=0.2,
    )
    correction = AcceptFlag(id=new_id(), created_at=_T0, flag_id="not_found-2")
    doc = make_document(track=track, corrections=[correction], flags=[flag])
    entries = build_history(doc)
    entry = next(e for e in entries if e.kind == HistoryKind.ACCEPT_FLAG)
    assert entry.title == "Accepted flag"
    assert entry.detail == "Mouse not found · tracking was fine"


def test_setup_change_entries_pass_through() -> None:
    track = make_track(n=5)
    change = SetupChange(id=new_id(), at=_T0, title="Edited zone “Center”", detail="Resized")
    doc = make_document(track=track, setup_changes=[change])
    entries = build_history(doc)
    entry = next(e for e in entries if e.kind == HistoryKind.SETUP_CHANGED)
    assert entry.title == "Edited zone “Center”"
    assert entry.detail == "Resized"


def test_tracking_finished_detail_uses_space_thousands_separator() -> None:
    track = make_track(n=9000)
    flags = [
        Flag(
            id=f"not_found-{i}",
            reason=FlagReason.NOT_FOUND,
            frame_start=i,
            frame_end=i,
            t_start_s=float(i),
            t_end_s=float(i),
            detail="Lost for 0.1 s",
            metric=0.1,
        )
        for i in range(7)
    ]
    doc = make_document(track=track, flags=flags)
    entries = build_history(doc)
    entry = next(e for e in entries if e.kind == HistoryKind.TRACKED)
    assert entry.detail == "9 000 frames · 7 flags"
