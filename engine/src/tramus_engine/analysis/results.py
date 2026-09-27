"""Time per zone and zone visits, over the trial window (§5.5)."""

from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np

from ..domain import (
    VISIBLE_STATUSES,
    AnalysisDocument,
    Results,
    SummaryRow,
    SummaryRowKind,
    Track,
    Zone,
    ZoneVisit,
)
from ..domain.base import utc_now
from .corrections import apply_corrections
from .occupancy import zone_fractions, zone_membership

_ROUND = 6


def compute_results(document: AnalysisDocument, effective: Track | None = None) -> Results | None:
    """`None` if the video hasn't been tracked yet."""
    if document.track is None:
        return None
    track = (
        effective
        if effective is not None
        else apply_corrections(document.track, document.corrections)
    )

    setup, video = document.setup, document.video
    trial_start = setup.trial.start_s if setup.trial else 0.0
    trial_end = setup.trial.end_s if setup.trial else video.duration_s
    trial_duration = max(trial_end - trial_start, 0.0)

    overlap = _frame_trial_overlap(track, video.duration_s, trial_start, trial_end)
    visible = np.array([status in VISIBLE_STATUSES for status in track.status])

    zones = setup.zones
    fractions, outside = zone_fractions(track, zones, video.width, video.height)
    membership = zone_membership(fractions, outside, visible, setup.analysis.in_zone_threshold)

    summary = _build_summary(zones, membership, visible, overlap, trial_duration)
    visits = _build_visits(track, zones, membership, trial_start, trial_end, video.recorded_at)

    return Results(
        computed_at=utc_now(),
        trial_start_s=round(trial_start, _ROUND),
        trial_end_s=round(trial_end, _ROUND),
        trial_duration_s=round(trial_duration, _ROUND),
        in_zone_threshold=setup.analysis.in_zone_threshold,
        summary=summary,
        visits=visits,
    )


def _frame_trial_overlap(
    track: Track, video_duration_s: float, trial_start: float, trial_end: float
) -> np.ndarray:
    """Seconds of `[t[i], t[i] + d[i])` inside `[trial_start, trial_end)`, per frame."""
    n = track.frame_count
    t = np.asarray(track.t, dtype=np.float64)
    if n == 0:
        return np.zeros(0, dtype=np.float64)
    if n == 1:
        durations = np.array([max(video_duration_s - t[0], 0.0)])
    else:
        diffs = np.diff(t)
        durations = np.append(diffs, np.median(diffs))
    frame_start, frame_end = t, t + durations
    overlap = np.minimum(frame_end, trial_end) - np.maximum(frame_start, trial_start)
    return np.clip(overlap, 0.0, None)


def _build_summary(
    zones: list[Zone],
    membership: np.ndarray,
    visible: np.ndarray,
    overlap: np.ndarray,
    trial_duration: float,
) -> list[SummaryRow]:
    def share(seconds: float) -> float:
        return round(seconds / trial_duration, _ROUND) if trial_duration > 0 else 0.0

    rows: list[SummaryRow] = []
    for zi, zone in enumerate(zones):
        seconds = float(np.sum(overlap[membership[:, zi]]))
        rows.append(
            SummaryRow(
                kind=SummaryRowKind.ZONE,
                zone_id=zone.id,
                name=zone.name,
                color_index=zone.color_index,
                time_s=round(seconds, _ROUND),
                share_of_trial=share(seconds),
            )
        )

    in_no_zone = visible & ~membership.any(axis=1) if zones else visible
    no_zone_seconds = float(np.sum(overlap[in_no_zone]))
    rows.append(
        SummaryRow(
            kind=SummaryRowKind.NO_ZONE,
            name="No zone",
            time_s=round(no_zone_seconds, _ROUND),
            share_of_trial=share(no_zone_seconds),
        )
    )

    not_visible_seconds = float(np.sum(overlap[~visible]))
    rows.append(
        SummaryRow(
            kind=SummaryRowKind.NOT_VISIBLE,
            name="Not visible",
            time_s=round(not_visible_seconds, _ROUND),
            share_of_trial=share(not_visible_seconds),
        )
    )
    return rows


def _build_visits(
    track: Track,
    zones: list[Zone],
    membership: np.ndarray,
    trial_start: float,
    trial_end: float,
    recorded_at: datetime | None,
) -> list[ZoneVisit]:
    t = np.asarray(track.t, dtype=np.float64)
    n = track.frame_count
    if n > 1:
        diffs = np.diff(t)
        frame_durations = np.append(diffs, np.median(diffs))
    elif n == 1:
        frame_durations = np.array([0.0])
    else:
        frame_durations = np.zeros(0)
    frame_end_times = t + frame_durations

    raw_visits: list[tuple[float, float, int, int, Zone]] = []
    for zi, zone in enumerate(zones):
        column = membership[:, zi]
        i = 0
        while i < n:
            if not column[i]:
                i += 1
                continue
            start = i
            while i < n and column[i]:
                i += 1
            end = i - 1
            enter_s = max(float(t[start]), trial_start)
            exit_s = min(float(frame_end_times[end]), trial_end)
            if exit_s <= enter_s:
                continue
            raw_visits.append((enter_s, exit_s, start, end, zone))

    raw_visits.sort(key=lambda visit: visit[0])
    visits: list[ZoneVisit] = []
    for index, (enter_s, exit_s, frame_enter, frame_exit, zone) in enumerate(raw_visits, start=1):
        enter_utc = recorded_at + timedelta(seconds=enter_s) if recorded_at is not None else None
        exit_utc = recorded_at + timedelta(seconds=exit_s) if recorded_at is not None else None
        visits.append(
            ZoneVisit(
                index=index,
                zone_id=zone.id,
                zone_name=zone.name,
                frame_enter=frame_enter,
                frame_exit=frame_exit,
                enter_s=round(enter_s, _ROUND),
                exit_s=round(exit_s, _ROUND),
                duration_s=round(exit_s - enter_s, _ROUND),
                enter_utc=enter_utc,
                exit_utc=exit_utc,
            )
        )
    return visits
