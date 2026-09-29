"""Excel export: one workbook with Summary, Visits, Track (one sheet per video), Crossings,
Crossing matrix and Settings.

`layout` (§9, `ExportLayout`) only changes the shape of the three per-video aggregate sheets —
Summary, Crossings' rule-count block and Crossing matrix. Visits, crossing events and Track are
event lists and are always long. The "Export info" sheet and " (wide)"/" (long)" sheet-name
suffixes make the chosen layout obvious without having to open a sheet and count columns.
"""

from __future__ import annotations

from pathlib import Path

import xlsxwriter

from ..domain import ExportLayout
from .tables import (
    CrossingEventRow,
    CrossingMatrixGrid,
    CrossingRuleRow,
    SettingsRow,
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
    build_settings_rows,
    build_summary_rows,
    build_summary_rows_wide,
    build_track_rows,
    build_visit_rows,
)

_INVALID_SHEET_CHARS = set("[]:*?/\\")

_LAYOUT_NOTE = {
    ExportLayout.WIDE: "Wide — one row per video. Zones are matched by name across videos.",
    ExportLayout.LONG: "Long — one row per video and zone (per video and rule/pair for crossings).",
}


def _sheet_name(base: str, used: set[str]) -> str:
    """A valid, unique Excel sheet name (<= 31 chars, no `[]:*?/\\`)."""
    cleaned = "".join("_" if ch in _INVALID_SHEET_CHARS else ch for ch in base).strip() or "Sheet"
    name = cleaned[:31]
    suffix = 2
    while name in used:
        tail = f" ({suffix})"
        name = cleaned[: 31 - len(tail)] + tail
        suffix += 1
    used.add(name)
    return name


def write_xlsx(
    exports: list[VideoExport], path: Path, *, layout: ExportLayout = ExportLayout.WIDE
) -> None:
    workbook = xlsxwriter.Workbook(str(path))
    formats = {
        "header": workbook.add_format({"bold": True, "bg_color": "#EEEEEE", "border": 1}),
        "percent": workbook.add_format({"num_format": "0.0%"}),
        "seconds": workbook.add_format({"num_format": "0.000"}),
        "cm": workbook.add_format({"num_format": "0.00"}),
        "datetime": workbook.add_format({"num_format": "yyyy-mm-dd hh:mm:ss.000"}),
    }

    _write_info_sheet(workbook, layout, formats)
    if layout is ExportLayout.WIDE:
        _write_summary_sheet_wide(workbook, build_summary_rows_wide(exports), formats)
        _write_crossings_sheet_wide(
            workbook,
            build_crossing_rule_rows_wide(exports),
            build_crossing_event_rows(exports),
            formats,
        )
        _write_crossing_matrix_sheet_wide(
            workbook, build_crossing_matrix_rows_wide(exports), formats
        )
    else:
        _write_summary_sheet(workbook, build_summary_rows(exports), formats)
        _write_crossings_sheet(
            workbook,
            build_crossing_rule_rows(exports),
            build_crossing_event_rows(exports),
            formats,
        )
        _write_crossing_matrix_sheet(workbook, build_crossing_matrix_grids(exports), formats)
    _write_visits_sheet(workbook, build_visit_rows(exports), formats)
    _write_track_sheets(workbook, exports, formats)
    _write_settings_sheet(workbook, build_settings_rows(exports), formats)

    workbook.close()


def _write_info_sheet(workbook, layout: ExportLayout, fmt) -> None:
    sheet = workbook.add_worksheet("Export info")
    sheet.set_column(0, 0, 16)
    sheet.set_column(1, 1, 70)
    sheet.write(0, 0, "Export layout", fmt["header"])
    sheet.write(0, 1, layout.value)
    sheet.write(1, 0, "")
    sheet.write(1, 1, _LAYOUT_NOTE[layout])


def _header_row(sheet, headers: list[str], widths: list[int], fmt) -> None:
    for col, (title, width) in enumerate(zip(headers, widths, strict=True)):
        sheet.write(0, col, title, fmt["header"])
        sheet.set_column(col, col, width)
    sheet.freeze_panes(1, 0)


def _write_summary_sheet(workbook, rows: list[SummaryRow], fmt) -> None:
    sheet = workbook.add_worksheet("Summary (long)")
    _header_row(
        sheet,
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
        ],
        [30, 20, 12, 20, 14, 14, 18, 18, 12, 20],
        fmt,
    )
    for r, row in enumerate(rows, start=1):
        sheet.write_string(r, 0, row.video)
        sheet.write_string(r, 1, row.zone)
        sheet.write_number(r, 2, row.time_s, fmt["seconds"])
        sheet.write_number(r, 3, row.share_of_analysed, fmt["percent"])
        sheet.write_number(r, 4, row.trial_start_s, fmt["seconds"])
        sheet.write_number(r, 5, row.trial_end_s, fmt["seconds"])
        sheet.write_number(r, 6, row.analysed_duration_s, fmt["seconds"])
        sheet.write_number(r, 7, row.excluded_duration_s, fmt["seconds"])
        sheet.write_number(r, 8, row.threshold, fmt["percent"])
        if row.distance_mm is not None:
            sheet.write_number(r, 9, row.distance_mm / 10.0, fmt["cm"])


def _write_summary_sheet_wide(workbook, rows: list[WideSummaryRow], fmt) -> None:
    sheet = workbook.add_worksheet("Summary (wide)")
    zone_columns = list(rows[0].time_by_zone.keys()) if rows else []
    headers = [
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
    widths = [30, 14, 14, 18, 18, 12, *([18] * len(zone_columns)), *([22] * len(zone_columns)), 20]
    _header_row(sheet, headers, widths, fmt)
    for r, row in enumerate(rows, start=1):
        sheet.write_string(r, 0, row.video)
        sheet.write_number(r, 1, row.trial_start_s, fmt["seconds"])
        sheet.write_number(r, 2, row.trial_end_s, fmt["seconds"])
        sheet.write_number(r, 3, row.analysed_duration_s, fmt["seconds"])
        sheet.write_number(r, 4, row.excluded_duration_s, fmt["seconds"])
        sheet.write_number(r, 5, row.threshold, fmt["percent"])
        col = 6
        for name in zone_columns:
            value = row.time_by_zone.get(name)
            if value is not None:
                sheet.write_number(r, col, value, fmt["seconds"])
            col += 1
        for name in zone_columns:
            value = row.share_by_zone.get(name)
            if value is not None:
                sheet.write_number(r, col, value, fmt["percent"])
            col += 1
        if row.distance_mm is not None:
            sheet.write_number(r, col, row.distance_mm / 10.0, fmt["cm"])


def _write_visits_sheet(workbook, rows: list[VisitRow], fmt) -> None:
    sheet = workbook.add_worksheet("Visits")
    _header_row(
        sheet,
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
        ],
        [30, 6, 20, 14, 14, 14, 24, 24, 22, 22],
        fmt,
    )
    for r, row in enumerate(rows, start=1):
        sheet.write_string(r, 0, row.video)
        sheet.write_number(r, 1, row.index)
        sheet.write_string(r, 2, row.zone)
        sheet.write_number(r, 3, row.enter_s, fmt["seconds"])
        sheet.write_number(r, 4, row.exit_s, fmt["seconds"])
        sheet.write_number(r, 5, row.duration_s, fmt["seconds"])
        sheet.write_string(
            r, 6, row.enter_utc.isoformat().replace("+00:00", "Z") if row.enter_utc else ""
        )
        sheet.write_string(
            r, 7, row.exit_utc.isoformat().replace("+00:00", "Z") if row.exit_utc else ""
        )
        if row.enter_local:
            sheet.write_datetime(r, 8, row.enter_local.replace(tzinfo=None), fmt["datetime"])
        if row.exit_local:
            sheet.write_datetime(r, 9, row.exit_local.replace(tzinfo=None), fmt["datetime"])


def _write_track_sheets(workbook, exports: list[VideoExport], fmt) -> None:
    used: set[str] = set()
    for export in exports:
        rows = build_track_rows([export])
        zone_names = [zone.name for zone in export.document.setup.zones]
        sheet = workbook.add_worksheet(_sheet_name(f"Track {export.file_name}", used))
        headers = ["Frame", "t (s)", "x", "y", "Status", *zone_names]
        widths = [8, 12, 10, 10, 12, *([14] * len(zone_names))]
        _header_row(sheet, headers, widths, fmt)
        for r, row in enumerate(rows, start=1):
            sheet.write_number(r, 0, row.frame)
            sheet.write_number(r, 1, row.t_s, fmt["seconds"])
            if row.x is not None:
                sheet.write_number(r, 2, row.x)
            if row.y is not None:
                sheet.write_number(r, 3, row.y)
            sheet.write_string(r, 4, row.status)
            for zi, name in enumerate(zone_names):
                sheet.write_number(r, 5 + zi, row.zone_flags.get(name, 0))


def _write_crossings_sheet(
    workbook, rule_rows: list[CrossingRuleRow], event_rows: list[CrossingEventRow], fmt
) -> None:
    sheet = workbook.add_worksheet("Crossings (long)")
    _header_row(sheet, ["Video", "From", "To", "Count"], [30, 20, 20, 10], fmt)
    for r, row in enumerate(rule_rows, start=1):
        sheet.write_string(r, 0, row.video)
        sheet.write_string(r, 1, row.rule_from)
        sheet.write_string(r, 2, row.rule_to)
        sheet.write_number(r, 3, row.count)

    events_start = len(rule_rows) + 3
    headers = ["Video", "Rule", "From", "To", "Time (s)", "Time (UTC)", "Time (local)"]
    widths = [30, 24, 20, 20, 12, 24, 22]
    for col, (title, width) in enumerate(zip(headers, widths, strict=True)):
        sheet.write(events_start, col, title, fmt["header"])
        sheet.set_column(col, col, width)
    for offset, row in enumerate(event_rows, start=1):
        r = events_start + offset
        sheet.write_string(r, 0, row.video)
        sheet.write_string(r, 1, row.rule)
        sheet.write_string(r, 2, row.from_zone)
        sheet.write_string(r, 3, row.to_zone)
        sheet.write_number(r, 4, row.time_s, fmt["seconds"])
        sheet.write_string(
            r, 5, row.time_utc.isoformat().replace("+00:00", "Z") if row.time_utc else ""
        )
        if row.time_local:
            sheet.write_datetime(r, 6, row.time_local.replace(tzinfo=None), fmt["datetime"])


def _write_crossings_sheet_wide(
    workbook, rule_rows: list[WideCrossingRow], event_rows: list[CrossingEventRow], fmt
) -> None:
    """One row per video with a count column per rule, then the (always long) event list below,
    same as `_write_crossings_sheet` but with the top block pivoted."""
    sheet = workbook.add_worksheet("Crossings (wide)")
    rule_labels = list(rule_rows[0].counts_by_rule.keys()) if rule_rows else []
    headers = ["Video", *rule_labels]
    widths = [30, *([22] * len(rule_labels))]
    _header_row(sheet, headers, widths, fmt)
    for r, row in enumerate(rule_rows, start=1):
        sheet.write_string(r, 0, row.video)
        for c, label in enumerate(rule_labels, start=1):
            value = row.counts_by_rule.get(label)
            if value is not None:
                sheet.write_number(r, c, value)

    events_start = len(rule_rows) + 3
    sheet.write(events_start - 1, 0, "Crossing events (always long)", fmt["header"])
    headers = ["Video", "Rule", "From", "To", "Time (s)", "Time (UTC)", "Time (local)"]
    widths = [30, 24, 20, 20, 12, 24, 22]
    for col, (title, width) in enumerate(zip(headers, widths, strict=True)):
        sheet.write(events_start, col, title, fmt["header"])
        sheet.set_column(col, col, width)
    for offset, row in enumerate(event_rows, start=1):
        r = events_start + offset
        sheet.write_string(r, 0, row.video)
        sheet.write_string(r, 1, row.rule)
        sheet.write_string(r, 2, row.from_zone)
        sheet.write_string(r, 3, row.to_zone)
        sheet.write_number(r, 4, row.time_s, fmt["seconds"])
        sheet.write_string(
            r, 5, row.time_utc.isoformat().replace("+00:00", "Z") if row.time_utc else ""
        )
        if row.time_local:
            sheet.write_datetime(r, 6, row.time_local.replace(tzinfo=None), fmt["datetime"])


def _write_crossing_matrix_sheet(workbook, grids: list[CrossingMatrixGrid], fmt) -> None:
    sheet = workbook.add_worksheet("Crossing matrix (long)")
    sheet.set_column(0, 0, 26)
    row = 0
    for grid in grids:
        sheet.write(row, 0, grid.video, fmt["header"])
        row += 1
        sheet.write(row, 0, "From \\ To", fmt["header"])
        for c, name in enumerate(grid.zone_names, start=1):
            sheet.write(row, c, name, fmt["header"])
            sheet.set_column(c, c, 16)
        row += 1
        for ri, from_name in enumerate(grid.zone_names):
            sheet.write_string(row, 0, from_name)
            for ci in range(len(grid.zone_names)):
                sheet.write_number(row, ci + 1, grid.counts[ri][ci])
            row += 1
        row += 1  # blank row between videos


def _write_crossing_matrix_sheet_wide(workbook, rows: list[WideMatrixRow], fmt) -> None:
    sheet = workbook.add_worksheet("Crossing matrix (wide)")
    pair_labels = list(rows[0].counts_by_pair.keys()) if rows else []
    headers = ["Video", *pair_labels]
    widths = [30, *([18] * len(pair_labels))]
    _header_row(sheet, headers, widths, fmt)
    for r, row in enumerate(rows, start=1):
        sheet.write_string(r, 0, row.video)
        for c, label in enumerate(pair_labels, start=1):
            value = row.counts_by_pair.get(label)
            if value is not None:
                sheet.write_number(r, c, value)


def _write_settings_sheet(workbook, rows: list[SettingsRow], fmt) -> None:
    sheet = workbook.add_worksheet("Settings")
    _header_row(
        sheet,
        [
            "Video",
            "App version",
            "Tracker",
            "Tracker version",
            "Parameters",
            "Zones",
            "Exclusions",
            "Crossing rules",
            "Recorded at (UTC)",
            "Fingerprint",
            "Tracked at (UTC)",
            "In-zone threshold",
            "Reference length (mm)",
            "mm per px",
            "Corrections",
        ],
        [26, 12, 20, 14, 30, 40, 40, 30, 22, 40, 22, 16, 18, 12, 60],
        fmt,
    )
    for r, row in enumerate(rows, start=1):
        sheet.write_string(r, 0, row.video)
        sheet.write_string(r, 1, row.app_version)
        sheet.write_string(r, 2, row.tracker or "")
        sheet.write_string(r, 3, row.tracker_version or "")
        sheet.write_string(r, 4, row.parameters)
        sheet.write_string(r, 5, row.zones_text)
        sheet.write_string(r, 6, row.exclusions_text)
        sheet.write_string(r, 7, row.crossing_rules_text)
        sheet.write_string(
            r, 8, row.recorded_at.isoformat().replace("+00:00", "Z") if row.recorded_at else ""
        )
        sheet.write_string(r, 9, row.fingerprint)
        sheet.write_string(
            r, 10, row.tracked_at.isoformat().replace("+00:00", "Z") if row.tracked_at else ""
        )
        sheet.write_number(r, 11, row.in_zone_threshold, fmt["percent"])
        if row.reference_length_mm is not None:
            sheet.write_number(r, 12, row.reference_length_mm)
        if row.mm_per_px is not None:
            sheet.write_number(r, 13, row.mm_per_px)
        sheet.write_string(r, 14, row.corrections_log)
