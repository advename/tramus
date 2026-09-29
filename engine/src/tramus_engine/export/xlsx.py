"""Excel export: one workbook with Summary, Visits, Track (one sheet per video), Crossings,
Crossing matrix and Settings."""

from __future__ import annotations

from pathlib import Path

import xlsxwriter

from .tables import (
    CrossingEventRow,
    CrossingMatrixGrid,
    CrossingRuleRow,
    SettingsRow,
    SummaryRow,
    VideoExport,
    VisitRow,
    build_crossing_event_rows,
    build_crossing_matrix_grids,
    build_crossing_rule_rows,
    build_settings_rows,
    build_summary_rows,
    build_track_rows,
    build_visit_rows,
)

_INVALID_SHEET_CHARS = set("[]:*?/\\")


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


def write_xlsx(exports: list[VideoExport], path: Path) -> None:
    workbook = xlsxwriter.Workbook(str(path))
    formats = {
        "header": workbook.add_format({"bold": True, "bg_color": "#EEEEEE", "border": 1}),
        "percent": workbook.add_format({"num_format": "0.0%"}),
        "seconds": workbook.add_format({"num_format": "0.000"}),
        "datetime": workbook.add_format({"num_format": "yyyy-mm-dd hh:mm:ss.000"}),
    }

    _write_summary_sheet(workbook, build_summary_rows(exports), formats)
    _write_visits_sheet(workbook, build_visit_rows(exports), formats)
    _write_track_sheets(workbook, exports, formats)
    _write_crossings_sheet(
        workbook, build_crossing_rule_rows(exports), build_crossing_event_rows(exports), formats
    )
    _write_crossing_matrix_sheet(workbook, build_crossing_matrix_grids(exports), formats)
    _write_settings_sheet(workbook, build_settings_rows(exports), formats)

    workbook.close()


def _header_row(sheet, headers: list[str], widths: list[int], fmt) -> None:
    for col, (title, width) in enumerate(zip(headers, widths, strict=True)):
        sheet.write(0, col, title, fmt["header"])
        sheet.set_column(col, col, width)
    sheet.freeze_panes(1, 0)


def _write_summary_sheet(workbook, rows: list[SummaryRow], fmt) -> None:
    sheet = workbook.add_worksheet("Summary")
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
        ],
        [30, 20, 12, 20, 14, 14, 18, 18, 12],
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
    sheet = workbook.add_worksheet("Crossings")
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


def _write_crossing_matrix_sheet(workbook, grids: list[CrossingMatrixGrid], fmt) -> None:
    sheet = workbook.add_worksheet("Crossing matrix")
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
