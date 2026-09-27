"""Excel export: one workbook with Summary, Visits, Track (one sheet per video) and Settings."""

from __future__ import annotations

from pathlib import Path

import xlsxwriter

from .tables import (
    SettingsRow,
    SummaryRow,
    VideoExport,
    VisitRow,
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
            "Share of trial (%)",
            "Trial start (s)",
            "Trial end (s)",
            "Threshold",
        ],
        [30, 20, 12, 18, 14, 14, 12],
        fmt,
    )
    for r, row in enumerate(rows, start=1):
        sheet.write_string(r, 0, row.video)
        sheet.write_string(r, 1, row.zone)
        sheet.write_number(r, 2, row.time_s, fmt["seconds"])
        sheet.write_number(r, 3, row.share_of_trial, fmt["percent"])
        sheet.write_number(r, 4, row.trial_start_s, fmt["seconds"])
        sheet.write_number(r, 5, row.trial_end_s, fmt["seconds"])
        sheet.write_number(r, 6, row.threshold, fmt["percent"])


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
            "Recorded at (UTC)",
            "Fingerprint",
            "Tracked at (UTC)",
            "In-zone threshold",
            "Corrections",
        ],
        [26, 12, 20, 14, 30, 40, 22, 40, 22, 16, 60],
        fmt,
    )
    for r, row in enumerate(rows, start=1):
        sheet.write_string(r, 0, row.video)
        sheet.write_string(r, 1, row.app_version)
        sheet.write_string(r, 2, row.tracker or "")
        sheet.write_string(r, 3, row.tracker_version or "")
        sheet.write_string(r, 4, row.parameters)
        sheet.write_string(r, 5, row.zones_text)
        sheet.write_string(
            r, 6, row.recorded_at.isoformat().replace("+00:00", "Z") if row.recorded_at else ""
        )
        sheet.write_string(r, 7, row.fingerprint)
        sheet.write_string(
            r, 8, row.tracked_at.isoformat().replace("+00:00", "Z") if row.tracked_at else ""
        )
        sheet.write_number(r, 9, row.in_zone_threshold, fmt["percent"])
        sheet.write_string(r, 10, row.corrections_log)
