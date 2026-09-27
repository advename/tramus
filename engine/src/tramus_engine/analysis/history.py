"""Builds the Review > History list (§5.6): newest first."""

from __future__ import annotations

from ..domain import (
    AcceptFlag,
    AnalysisDocument,
    Correction,
    Flag,
    FlagReason,
    HistoryEntry,
    HistoryKind,
    Interpolate,
    MarkHidden,
    SetPosition,
    Track,
)

_REASON_LABELS: dict[FlagReason, str] = {
    FlagReason.NOT_FOUND: "Mouse not found",
    FlagReason.SUDDEN_JUMP: "Sudden jump",
    FlagReason.UNUSUAL_SIZE: "Unusual size",
}


def _format_count(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def build_history(document: AnalysisDocument) -> list[HistoryEntry]:
    entries: list[HistoryEntry] = []
    track = document.track

    if track is not None:
        entries.append(_tracking_finished_entry(track, len(document.flags)))
        flags_by_id = {flag.id: flag for flag in document.flags}
        x = list(track.x)
        y = list(track.y)
        for correction in document.corrections:
            entries.append(_correction_entry(correction, x, y, flags_by_id))
            if isinstance(correction, SetPosition):
                x[correction.frame] = correction.x
                y[correction.frame] = correction.y

    for change in document.setup_changes:
        entries.append(
            HistoryEntry(
                id=change.id,
                kind=HistoryKind.SETUP_CHANGED,
                title=change.title,
                detail=change.detail,
                at=change.at,
            )
        )

    entries.sort(key=lambda entry: entry.at, reverse=True)
    return entries


def _tracking_finished_entry(track: Track, flag_count: int) -> HistoryEntry:
    return HistoryEntry(
        id="tracking-finished",
        kind=HistoryKind.TRACKED,
        title="Tracking finished",
        detail=f"{_format_count(track.frame_count)} frames · {_format_count(flag_count)} flags",
        at=track.tracked_at,
        frame_start=0 if track.frame_count else None,
        frame_end=track.frame_count - 1 if track.frame_count else None,
        t_start_s=track.t[0] if track.t else None,
        t_end_s=track.t[-1] if track.t else None,
    )


def _correction_entry(
    correction: Correction,
    x: list[float | None],
    y: list[float | None],
    flags_by_id: dict[str, Flag],
) -> HistoryEntry:
    if isinstance(correction, SetPosition):
        previous_x, previous_y = x[correction.frame], y[correction.frame]
        new_point = f"({round(correction.x)}, {round(correction.y)}) px"
        if previous_x is not None and previous_y is not None:
            detail = f"({round(previous_x)}, {round(previous_y)}) → {new_point}"
        else:
            detail = f"→ {new_point}"
        return HistoryEntry(
            id=correction.id,
            kind=HistoryKind.SET_POSITION,
            title="Set position",
            detail=detail,
            at=correction.created_at,
            frame_start=correction.frame,
            frame_end=correction.frame,
        )

    if isinstance(correction, Interpolate):
        count = correction.frame_end - correction.frame_start + 1
        return HistoryEntry(
            id=correction.id,
            kind=HistoryKind.INTERPOLATE,
            title="Fill in between",
            detail=f"{_format_count(count)} frames interpolated",
            at=correction.created_at,
            frame_start=correction.frame_start,
            frame_end=correction.frame_end,
        )

    if isinstance(correction, MarkHidden):
        count = correction.frame_end - correction.frame_start + 1
        return HistoryEntry(
            id=correction.id,
            kind=HistoryKind.MARK_HIDDEN,
            title="Mouse not visible",
            detail=f"{_format_count(count)} frames excluded from zone times",
            at=correction.created_at,
            frame_start=correction.frame_start,
            frame_end=correction.frame_end,
        )

    if isinstance(correction, AcceptFlag):
        flag = flags_by_id.get(correction.flag_id)
        reason_label = _REASON_LABELS.get(flag.reason, "Flag") if flag else "Flag"
        return HistoryEntry(
            id=correction.id,
            kind=HistoryKind.ACCEPT_FLAG,
            title="Accepted flag",
            detail=f"{reason_label} · tracking was fine",
            at=correction.created_at,
            frame_start=flag.frame_start if flag else None,
            frame_end=flag.frame_end if flag else None,
        )

    raise TypeError(f"unknown correction kind: {correction!r}")
