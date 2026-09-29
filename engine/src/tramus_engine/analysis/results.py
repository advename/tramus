"""Time per zone, zone visits and zone crossings, over the analysed time (§5.5)."""

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
from .crossings import compute_crossings
from .distance import compute_distance_mm
from .exclusions import analysed_intervals, frame_interval_overlap, frame_is_excluded
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

    intervals = analysed_intervals(trial_start, trial_end, setup.exclusions)
    analysed_duration = sum(end - start for start, end in intervals)
    excluded_duration = trial_duration - analysed_duration

    t, frame_end_times = _frame_bounds(track, video.duration_s)
    overlap = frame_interval_overlap(t, frame_end_times, intervals)
    excluded_frames = frame_is_excluded(t, setup.exclusions)
    visible = np.array([status in VISIBLE_STATUSES for status in track.status])

    zones = setup.zones
    fractions, outside = zone_fractions(track, zones, video.width, video.height)
    membership = zone_membership(
        fractions, outside, visible, setup.analysis.in_zone_threshold, excluded=excluded_frames
    )

    summary = _build_summary(
        zones, membership, visible, excluded_frames, overlap, analysed_duration
    )
    visits = _build_visits(
        t, frame_end_times, zones, membership, trial_start, trial_end, video.recorded_at
    )
    crossings, crossing_matrix = compute_crossings(
        t=t,
        frame_end_times=frame_end_times,
        membership=membership,
        visible=visible,
        zones=zones,
        intervals=intervals,
        rules=setup.analysis.crossing_rules,
        recorded_at=video.recorded_at,
    )

    return Results(
        computed_at=utc_now(),
        trial_start_s=round(trial_start, _ROUND),
        trial_end_s=round(trial_end, _ROUND),
        trial_duration_s=round(trial_duration, _ROUND),
        analysed_duration_s=round(analysed_duration, _ROUND),
        excluded_duration_s=round(excluded_duration, _ROUND),
        in_zone_threshold=setup.analysis.in_zone_threshold,
        summary=summary,
        visits=visits,
        crossings=crossings,
        crossing_matrix=crossing_matrix,
        distance_mm=compute_distance_mm(document, track),
    )


def _frame_bounds(track: Track, video_duration_s: float) -> tuple[np.ndarray, np.ndarray]:
    """`(frame_start_times, frame_end_times)`: each frame's `[t[i], t[i] + d[i])`, the last
    frame's duration taken from the median (same convention used throughout §3)."""
    n = track.frame_count
    t = np.asarray(track.t, dtype=np.float64)
    if n == 0:
        return t, t
    if n == 1:
        durations = np.array([max(video_duration_s - t[0], 0.0)])
    else:
        diffs = np.diff(t)
        durations = np.append(diffs, np.median(diffs))
    return t, t + durations


def _build_summary(
    zones: list[Zone],
    membership: np.ndarray,
    visible: np.ndarray,
    excluded: np.ndarray,
    overlap: np.ndarray,
    analysed_duration: float,
) -> list[SummaryRow]:
    def share(seconds: float) -> float:
        return round(seconds / analysed_duration, _ROUND) if analysed_duration > 0 else 0.0

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
                share_of_analysed=share(seconds),
            )
        )

    analysable = visible & ~excluded
    in_no_zone = analysable & ~membership.any(axis=1) if zones else analysable
    no_zone_seconds = float(np.sum(overlap[in_no_zone]))
    rows.append(
        SummaryRow(
            kind=SummaryRowKind.NO_ZONE,
            name="No zone",
            time_s=round(no_zone_seconds, _ROUND),
            share_of_analysed=share(no_zone_seconds),
        )
    )

    not_visible_seconds = float(np.sum(overlap[~visible & ~excluded]))
    rows.append(
        SummaryRow(
            kind=SummaryRowKind.NOT_VISIBLE,
            name="Not visible",
            time_s=round(not_visible_seconds, _ROUND),
            share_of_analysed=share(not_visible_seconds),
        )
    )
    return rows


def _build_visits(
    t: np.ndarray,
    frame_end_times: np.ndarray,
    zones: list[Zone],
    membership: np.ndarray,
    trial_start: float,
    trial_end: float,
    recorded_at: datetime | None,
) -> list[ZoneVisit]:
    n = t.shape[0]
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
