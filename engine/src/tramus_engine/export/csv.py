"""CSV export: UTF-8 with a BOM, comma separated.

Long layout (`ExportLayout.LONG`, the original shape) writes `<name>_summary.csv`,
`<name>_visits.csv` and `<name>_crossings.csv`. Wide layout (`ExportLayout.WIDE`, the default,
§9) writes `<name>_summary_wide.csv` and `<name>_crossings_wide.csv` instead — the `_wide` suffix
is what makes the layout obvious from the file list — while `<name>_visits.csv` is unchanged:
visits, crossing events and Track are event lists and stay long in both layouts.
"""

from __future__ import annotations

import csv
from pathlib import Path

from ..domain import ExportLayout
from .tables import (
    CrossingEventRow,
    CrossingMatrixGrid,
    CrossingRuleRow,
    SummaryRow,
    VideoExport,
    VisitRow,
    WideCrossingRow,
    WideMatrixRow,
    WideSummaryRow,
    build_crossing_event_rows,
    build_crossing_matrix_grids,
    build_crossing_matrix_rows_wide,
    build_crossing_rule_rows,
    build_crossing_rule_rows_wide,
    build_summary_rows,
    build_summary_rows_wide,
    build_visit_rows,
)


def write_csv(
    exports: list[VideoExport], base_path: Path, *, layout: ExportLayout = ExportLayout.WIDE
) -> list[Path]:
    """Writes the summary, visits and crossings CSVs next to `base_path`, named after its stem."""
    visits_path = base_path.with_name(f"{base_path.stem}_visits.csv")
    _write_visits(build_visit_rows(exports), visits_path)

    if layout is ExportLayout.WIDE:
        summary_path = base_path.with_name(f"{base_path.stem}_summary_wide.csv")
        crossings_path = base_path.with_name(f"{base_path.stem}_crossings_wide.csv")
        _write_summary_wide(build_summary_rows_wide(exports), summary_path)
        _write_crossings_wide(
            build_crossing_rule_rows_wide(exports),
            build_crossing_matrix_rows_wide(exports),
            build_crossing_event_rows(exports),
            crossings_path,
        )
    else:
        summary_path = base_path.with_name(f"{base_path.stem}_summary.csv")
        crossings_path = base_path.with_name(f"{base_path.stem}_crossings.csv")
        _write_summary(build_summary_rows(exports), summary_path)
        _write_crossings(
            build_crossing_rule_rows(exports),
            build_crossing_matrix_grids(exports),
            build_crossing_event_rows(exports),
            crossings_path,
        )
    return [summary_path, visits_path, crossings_path]


def _iso(dt) -> str:
    return dt.isoformat().replace("+00:00", "Z") if dt is not None else ""


def _write_summary(rows: list[SummaryRow], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "Video",
                "Zone",
                "Time (s)",
                "Share of analysed (%)",
                "Trial start (s)",
                "Trial end (s)",
                "Analysed duration (s)",
                "Excluded duration (s)",
                "Threshold",
                "Distance travelled (cm)",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row.video,
                    row.zone,
                    f"{row.time_s:.3f}",
                    f"{row.share_of_analysed * 100:.1f}",
                    f"{row.trial_start_s:.3f}",
                    f"{row.trial_end_s:.3f}",
                    f"{row.analysed_duration_s:.3f}",
                    f"{row.excluded_duration_s:.3f}",
                    f"{row.threshold * 100:.0f}",
                    f"{row.distance_mm / 10.0:.3f}" if row.distance_mm is not None else "",
                ]
            )


def _write_summary_wide(rows: list[WideSummaryRow], path: Path) -> None:
    zone_columns = list(rows[0].time_by_zone.keys()) if rows else []
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "Video",
                "Trial start (s)",
                "Trial end (s)",
                "Analysed duration (s)",
                "Excluded duration (s)",
                "Threshold",
                *(f"{name} – Time (s)" for name in zone_columns),
                *(f"{name} – Share of analysed (%)" for name in zone_columns),
                "Distance travelled (cm)",
            ]
        )
        for row in rows:
            time_cells = [
                f"{row.time_by_zone[name]:.3f}" if row.time_by_zone[name] is not None else ""
                for name in zone_columns
            ]
            share_cells = [
                f"{row.share_by_zone[name] * 100:.1f}"
                if row.share_by_zone[name] is not None
                else ""
                for name in zone_columns
            ]
            writer.writerow(
                [
                    row.video,
                    f"{row.trial_start_s:.3f}",
                    f"{row.trial_end_s:.3f}",
                    f"{row.analysed_duration_s:.3f}",
                    f"{row.excluded_duration_s:.3f}",
                    f"{row.threshold * 100:.0f}",
                    *time_cells,
                    *share_cells,
                    f"{row.distance_mm / 10.0:.3f}" if row.distance_mm is not None else "",
                ]
            )


def _write_visits(rows: list[VisitRow], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "Video",
                "#",
                "Zone",
                "Entered (s)",
                "Left (s)",
                "Duration (s)",
                "Entered (UTC)",
                "Left (UTC)",
                "Entered (local)",
                "Left (local)",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row.video,
                    row.index,
                    row.zone,
                    f"{row.enter_s:.3f}",
                    f"{row.exit_s:.3f}",
                    f"{row.duration_s:.3f}",
                    _iso(row.enter_utc),
                    _iso(row.exit_utc),
                    row.enter_local.isoformat() if row.enter_local else "",
                    row.exit_local.isoformat() if row.exit_local else "",
                ]
            )


def _write_crossings(
    rule_rows: list[CrossingRuleRow],
    grids: list[CrossingMatrixGrid],
    event_rows: list[CrossingEventRow],
    path: Path,
) -> None:
    """Three blocks in one file, separated by a blank line: per-rule counts, the from×to matrix
    (one grid per video) and the individual events."""
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Video", "From", "To", "Count"])
        for row in rule_rows:
            writer.writerow([row.video, row.rule_from, row.rule_to, row.count])

        writer.writerow([])
        writer.writerow(["Video", "From", "To", "Count"])
        for grid in grids:
            for ri, from_name in enumerate(grid.zone_names):
                for ci, to_name in enumerate(grid.zone_names):
                    writer.writerow([grid.video, from_name, to_name, grid.counts[ri][ci]])

        writer.writerow([])
        writer.writerow(["Video", "Rule", "From", "To", "Time (s)", "Time (UTC)", "Time (local)"])
        for row in event_rows:
            writer.writerow(
                [
                    row.video,
                    row.rule,
                    row.from_zone,
                    row.to_zone,
                    f"{row.time_s:.3f}",
                    _iso(row.time_utc),
                    row.time_local.isoformat() if row.time_local else "",
                ]
            )


def _write_crossings_wide(
    rule_rows: list[WideCrossingRow],
    matrix_rows: list[WideMatrixRow],
    event_rows: list[CrossingEventRow],
    path: Path,
) -> None:
    """Three blocks in one file, separated by a blank line: rule counts pivoted (one row per
    video, one column per rule), the crossing matrix pivoted the same way, and the individual
    events (always long)."""
    rule_labels = list(rule_rows[0].counts_by_rule.keys()) if rule_rows else []
    pair_labels = list(matrix_rows[0].counts_by_pair.keys()) if matrix_rows else []
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Video", *(f"{label}" for label in rule_labels)])
        for row in rule_rows:
            writer.writerow(
                [
                    row.video,
                    *(
                        row.counts_by_rule[label] if row.counts_by_rule[label] is not None else ""
                        for label in rule_labels
                    ),
                ]
            )

        writer.writerow([])
        writer.writerow(["Video", *pair_labels])
        for row in matrix_rows:
            writer.writerow(
                [
                    row.video,
                    *(
                        row.counts_by_pair[label] if row.counts_by_pair[label] is not None else ""
                        for label in pair_labels
                    ),
                ]
            )

        writer.writerow([])
        writer.writerow(["Video", "Rule", "From", "To", "Time (s)", "Time (UTC)", "Time (local)"])
        for row in event_rows:
            writer.writerow(
                [
                    row.video,
                    row.rule,
                    row.from_zone,
                    row.to_zone,
                    f"{row.time_s:.3f}",
                    _iso(row.time_utc),
                    row.time_local.isoformat() if row.time_local else "",
                ]
            )
