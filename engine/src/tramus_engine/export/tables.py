"""Row builders shared by the xlsx and csv writers.

Turns one or more `AnalysisDocument`s into flat rows: Summary (time per zone), Visits (zone
enter/exit events), Track (per-frame position and zone membership), Crossings (rule counts and
events), Crossing matrix (from×to grid) and Settings (setup + corrections log, for provenance).
Kept independent of the output format so `xlsx.py` and `csv.py` only deal with layout.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import numpy as np

from ..analysis.corrections import apply_corrections
from ..analysis.exclusions import frame_is_excluded
from ..analysis.occupancy import zone_fractions, zone_membership
from ..analysis.results import compute_results
from ..domain import (
    VISIBLE_STATUSES,
    AnalysisDocument,
    Correction,
    CrossingRule,
    Exclusion,
    Results,
    Track,
)
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
    share_of_analysed: float
    trial_start_s: float
    trial_end_s: float
    analysed_duration_s: float
    excluded_duration_s: float
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
                    share_of_analysed=row.share_of_analysed,
                    trial_start_s=results.trial_start_s,
                    trial_end_s=results.trial_end_s,
                    analysed_duration_s=results.analysed_duration_s,
                    excluded_duration_s=results.excluded_duration_s,
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
            excluded = frame_is_excluded(
                np.asarray(track.t, dtype=np.float64), export.document.setup.exclusions
            )
            membership = zone_membership(fractions, outside, visible, threshold, excluded=excluded)
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
    exclusions_text: str
    crossing_rules_text: str
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


def _format_time_precise(seconds: float) -> str:
    """`mm:ss.sss`, e.g. `01:02.300`."""
    minutes = int(seconds // 60)
    rest = seconds - minutes * 60
    return f"{minutes:02d}:{rest:06.3f}"


def _exclusion_text(exclusion: Exclusion) -> str:
    duration = exclusion.end_s - exclusion.start_s
    start, end = _format_time_precise(exclusion.start_s), _format_time_precise(exclusion.end_s)
    text = f"{start}–{end} ({duration:.3f} s)"
    return f"{text} — {exclusion.note}" if exclusion.note else text


def zone_name_lookup(zones: list[Zone]) -> dict[str, str]:
    return {zone.id: zone.name for zone in zones}


def _zone_label(zone_id: str | None, zone_names: dict[str, str]) -> str:
    if zone_id is None:
        return "Any zone"
    return zone_names.get(zone_id, zone_id)


def _crossing_rule_text(rule: CrossingRule, zone_names: dict[str, str]) -> str:
    from_label = _zone_label(rule.from_zone_id, zone_names)
    to_label = _zone_label(rule.to_zone_id, zone_names)
    return f"{from_label} → {to_label}"


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
        exclusions_text = "; ".join(_exclusion_text(excl) for excl in document.setup.exclusions)
        zone_names = zone_name_lookup(document.setup.zones)
        crossing_rules_text = "; ".join(
            _crossing_rule_text(rule, zone_names) for rule in document.setup.analysis.crossing_rules
        )
        rows.append(
            SettingsRow(
                video=export.file_name,
                app_version=document.app_version,
                tracker=track.tracker if track else None,
                tracker_version=track.tracker_version if track else None,
                parameters=str(track.parameters) if track else "",
                zones_text=zones_text,
                exclusions_text=exclusions_text,
                crossing_rules_text=crossing_rules_text,
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


@dataclass(frozen=True)
class CrossingRuleRow:
    """One video × rule: the rule's own from/to labels (possibly "Any zone") and its count."""

    video: str
    rule_from: str
    rule_to: str
    count: int


def build_crossing_rule_rows(exports: list[VideoExport]) -> list[CrossingRuleRow]:
    rows: list[CrossingRuleRow] = []
    for export in exports:
        results = export.results
        if results is None:
            continue
        zone_names = zone_name_lookup(export.document.setup.zones)
        for crossing in results.crossings:
            rows.append(
                CrossingRuleRow(
                    video=export.file_name,
                    rule_from=_zone_label(crossing.from_zone_id, zone_names),
                    rule_to=_zone_label(crossing.to_zone_id, zone_names),
                    count=crossing.count,
                )
            )
    return rows


@dataclass(frozen=True)
class CrossingEventRow:
    """One event: which rule matched it (its from/to labels) and the concrete zones crossed."""

    video: str
    rule: str
    from_zone: str
    to_zone: str
    time_s: float
    time_utc: datetime | None
    time_local: datetime | None


def build_crossing_event_rows(exports: list[VideoExport]) -> list[CrossingEventRow]:
    rows: list[CrossingEventRow] = []
    for export in exports:
        results = export.results
        if results is None:
            continue
        zone_names = zone_name_lookup(export.document.setup.zones)
        for crossing in results.crossings:
            rule_text = _crossing_rule_text(
                CrossingRule(
                    id=crossing.rule_id,
                    from_zone_id=crossing.from_zone_id,
                    to_zone_id=crossing.to_zone_id,
                ),
                zone_names,
            )
            for event in crossing.events:
                rows.append(
                    CrossingEventRow(
                        video=export.file_name,
                        rule=rule_text,
                        from_zone=zone_names.get(event.from_zone_id, event.from_zone_id),
                        to_zone=zone_names.get(event.to_zone_id, event.to_zone_id),
                        time_s=event.time_s,
                        time_utc=event.time_utc,
                        time_local=event.time_utc.astimezone() if event.time_utc else None,
                    )
                )
    return rows


@dataclass(frozen=True)
class CrossingMatrixGrid:
    """One video's from×to crossing-count grid, in setup zone order."""

    video: str
    zone_names: list[str]
    counts: list[list[int]]  # counts[from_index][to_index]


def build_crossing_matrix_grids(exports: list[VideoExport]) -> list[CrossingMatrixGrid]:
    grids: list[CrossingMatrixGrid] = []
    for export in exports:
        results = export.results
        if results is None:
            continue
        zones = export.document.setup.zones
        index = {zone.id: i for i, zone in enumerate(zones)}
        counts = [[0] * len(zones) for _ in zones]
        for cell in results.crossing_matrix:
            from_index, to_index = index.get(cell.from_zone_id), index.get(cell.to_zone_id)
            if from_index is not None and to_index is not None:
                counts[from_index][to_index] = cell.count
        grids.append(
            CrossingMatrixGrid(
                video=export.file_name,
                zone_names=[zone.name for zone in zones],
                counts=counts,
            )
        )
    return grids
