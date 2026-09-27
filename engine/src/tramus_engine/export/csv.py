"""CSV export: `<name>_summary.csv` and `<name>_visits.csv`, UTF-8 with a BOM."""

from __future__ import annotations

import csv
from pathlib import Path

from .tables import SummaryRow, VideoExport, VisitRow, build_summary_rows, build_visit_rows


def write_csv(exports: list[VideoExport], base_path: Path) -> list[Path]:
    """Writes the summary and visits CSVs next to `base_path`, named after its stem."""
    summary_path = base_path.with_name(f"{base_path.stem}_summary.csv")
    visits_path = base_path.with_name(f"{base_path.stem}_visits.csv")
    _write_summary(build_summary_rows(exports), summary_path)
    _write_visits(build_visit_rows(exports), visits_path)
    return [summary_path, visits_path]


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
                "Share of trial (%)",
                "Trial start (s)",
                "Trial end (s)",
                "Threshold",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row.video,
                    row.zone,
                    f"{row.time_s:.3f}",
                    f"{row.share_of_trial * 100:.1f}",
                    f"{row.trial_start_s:.3f}",
                    f"{row.trial_end_s:.3f}",
                    f"{row.threshold * 100:.0f}",
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
