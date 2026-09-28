"""Row builders shared by the xlsx and csv writers.

Turns one or more `AnalysisDocument`s into flat rows: Summary (time per zone), Visits (zone
enter/exit events), Track (per-frame position and zone membership) and Settings (setup +
corrections log, for provenance). Kept independent of the output format so `xlsx.py` and
`csv.py` only deal with layout.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import numpy as np

from ..analysis.corrections import apply_corrections
from ..analysis.occupancy import zone_fractions, zone_membership
from ..analysis.results import compute_results
from ..domain import VISIBLE_STATUSES, AnalysisDocument, Correction, Results, Track
from ..domain.setup import Zone
from ..domain.shapes import EllipseShape, PolygonShape, RectShape, Shape


@dataclass(frozen=True)
class VideoExport:
    """One video's contribution to an export: its document plus data derived from it."""

    video_id: str
    file_name: str
    document: AnalysisDocument
    effective_track: Track | None
    results: Results | None


def build_video_export(video_id: str, file_name: str, document: AnalysisDocument) -> VideoExport:
    """Derives the effective track and results for one video's document.

    Recomputes rather than trusting `document.results`, so an export always reflects the
    document's current corrections and setup (results are only a cached snapshot).
    """
    effective = apply_corrections(document.track, document.corrections) if document.track else None
    results = compute_results(document, effective)
    return VideoExport(
        video_id=video_id,
        file_name=file_name,
        document=document,
        effective_track=effective,
        results=results,
    )


@dataclass(frozen=True)
class SummaryRow:
    video: str
    zone: str
    time_s: float
    share_of_trial: float
    trial_start_s: float
    trial_end_s: float
    threshold: float


def build_summary_rows(exports: list[VideoExport]) -> list[SummaryRow]:
    rows: list[SummaryRow] = []
    for export in exports:
        results = export.results
        if results is None:
            continue
        for row in results.summary:
            rows.append(
                SummaryRow(
                    video=export.file_name,
                    zone=row.name,
                    time_s=row.time_s,
                    share_of_trial=row.share_of_trial,
                    trial_start_s=results.trial_start_s,
                    trial_end_s=results.trial_end_s,
                    threshold=results.in_zone_threshold,
                )
            )
    return rows


@dataclass(frozen=True)
class VisitRow:
    video: str
    index: int
    zone: str
    enter_s: float
    exit_s: float
    duration_s: float
    enter_utc: datetime | None
    exit_utc: datetime | None
    enter_local: datetime | None
    exit_local: datetime | None


def build_visit_rows(exports: list[VideoExport]) -> list[VisitRow]:
    rows: list[VisitRow] = []
    for export in exports:
        results = export.results
        if results is None:
            continue
        for visit in results.visits:
            rows.append(
                VisitRow(
                    video=export.file_name,
                    index=visit.index,
                    zone=visit.zone_name,
                    enter_s=visit.enter_s,
                    exit_s=visit.exit_s,
                    duration_s=visit.duration_s,
                    enter_utc=visit.enter_utc,
                    exit_utc=visit.exit_utc,
                    enter_local=visit.enter_utc.astimezone() if visit.enter_utc else None,
                    exit_local=visit.exit_utc.astimezone() if visit.exit_utc else None,
                )
            )
    return rows


@dataclass(frozen=True)
class TrackRow:
    video: str
    frame: int
    t_s: float
    x: float | None
    y: float | None
    status: str
    zone_flags: dict[str, int]  # zone name -> 0/1, in setup order


def build_track_rows(exports: list[VideoExport]) -> list[TrackRow]:
    rows: list[TrackRow] = []
    for export in exports:
        track = export.effective_track
        if track is None:
            continue
        zones = export.document.setup.zones
        width, height = export.document.video.width, export.document.video.height
        if zones:
            fractions, outside = zone_fractions(track, zones, width, height)
            visible = np.array([status in VISIBLE_STATUSES for status in track.status], dtype=bool)
            threshold = export.document.setup.analysis.in_zone_threshold
            membership = zone_membership(fractions, outside, visible, threshold)
        else:
            membership = np.zeros((track.frame_count, 0), dtype=bool)
        for i in range(track.frame_count):
            zone_flags = {zone.name: int(membership[i, zi]) for zi, zone in enumerate(zones)}
            rows.append(
                TrackRow(
                    video=export.file_name,
                    frame=i,
                    t_s=track.t[i],
                    x=track.x[i],
                    y=track.y[i],
                    status=str(track.status[i]),
                    zone_flags=zone_flags,
                )
            )
    return rows


@dataclass(frozen=True)
class SettingsRow:
    video: str
    app_version: str
    tracker: str | None
    tracker_version: str | None
    parameters: str
    zones_text: str
    recorded_at: datetime | None
    fingerprint: str
    tracked_at: datetime | None
    in_zone_threshold: float
    corrections_log: str
    reference_length_mm: float | None
    mm_per_px: float | None


def _shape_size_mm_text(shape: Shape, mm_per_px: float) -> str | None:
    """A short "W × H mm" description of a shape's size, or `None` for shapes without a simple
    width/height (a polygon's bounding box is used instead)."""
    if isinstance(shape, RectShape):
        return f"{shape.width * mm_per_px:.1f} × {shape.height * mm_per_px:.1f} mm"
    if isinstance(shape, EllipseShape):
        return f"{2 * shape.rx * mm_per_px:.1f} × {2 * shape.ry * mm_per_px:.1f} mm"
    if isinstance(shape, PolygonShape):
        xs = [px for px, _ in shape.points]
        ys = [py for _, py in shape.points]
        width_mm = (max(xs) - min(xs)) * mm_per_px
        height_mm = (max(ys) - min(ys)) * mm_per_px
        return f"{width_mm:.1f} × {height_mm:.1f} mm bounding box"
    return None


def _zone_text(zone: Zone, mm_per_px: float | None) -> str:
    if mm_per_px is None:
        return f"{zone.name} ({zone.shape.kind})"
    size = _shape_size_mm_text(zone.shape, mm_per_px)
    return (
        f"{zone.name} ({zone.shape.kind}, {size})" if size else f"{zone.name} ({zone.shape.kind})"
    )


def _describe_correction(correction: Correction) -> str:
    at = correction.created_at.isoformat().replace("+00:00", "Z")
    if correction.kind == "set_position":
        pos = f"({correction.x:.1f}, {correction.y:.1f})"
        return f"{at}  Set position — frame {correction.frame} → {pos}"
    if correction.kind == "mark_hidden":
        return f"{at}  Mouse not visible — frames {correction.frame_start}–{correction.frame_end}"
    if correction.kind == "interpolate":
        return f"{at}  Fill in between — frames {correction.frame_start}–{correction.frame_end}"
    return f"{at}  Accepted flag — {correction.flag_id}"


def build_settings_rows(exports: list[VideoExport]) -> list[SettingsRow]:
    rows: list[SettingsRow] = []
    for export in exports:
        document = export.document
        track = document.track
        calibration = document.setup.calibration
        mm_per_px = calibration.mm_per_px if calibration else None
        zones_text = "; ".join(_zone_text(zone, mm_per_px) for zone in document.setup.zones)
        rows.append(
            SettingsRow(
                video=export.file_name,
                app_version=document.app_version,
                tracker=track.tracker if track else None,
                tracker_version=track.tracker_version if track else None,
                parameters=str(track.parameters) if track else "",
                zones_text=zones_text,
                recorded_at=document.video.recorded_at,
                fingerprint=document.video.fingerprint,
                tracked_at=track.tracked_at if track else None,
                in_zone_threshold=document.setup.analysis.in_zone_threshold,
                corrections_log="\n".join(_describe_correction(c) for c in document.corrections),
                reference_length_mm=calibration.length_mm if calibration else None,
                mm_per_px=mm_per_px,
            )
        )
    return rows
