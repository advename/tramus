"""Export row builders and writers, using hand-made documents (no dependency on `analysis`)."""

from __future__ import annotations

import csv
import zipfile
from datetime import UTC, datetime
from pathlib import Path

from tests.app.conftest import make_document, make_track
from tramus_engine.domain import Results, SummaryRow, SummaryRowKind, ZoneVisit
from tramus_engine.export.csv import write_csv
from tramus_engine.export.tables import (
    VideoExport,
    build_settings_rows,
    build_summary_rows,
    build_track_rows,
    build_visit_rows,
)
from tramus_engine.export.xlsx import write_xlsx


def _make_results() -> Results:
    return Results(
        computed_at=datetime.now(UTC),
        trial_start_s=0.0,
        trial_end_s=4.0,
        trial_duration_s=4.0,
        in_zone_threshold=0.5,
        summary=[
            SummaryRow(
                kind=SummaryRowKind.ZONE,
                zone_id="z1",
                name="Center",
                color_index=0,
                time_s=2.5,
                share_of_trial=0.625,
            ),
            SummaryRow(
                kind=SummaryRowKind.NO_ZONE, name="No zone", time_s=1.0, share_of_trial=0.25
            ),
            SummaryRow(
                kind=SummaryRowKind.NOT_VISIBLE,
                name="Not visible",
                time_s=0.5,
                share_of_trial=0.125,
            ),
        ],
        visits=[
            ZoneVisit(
                index=1,
                zone_id="z1",
                zone_name="Center",
                frame_enter=0,
                frame_exit=9,
                enter_s=0.0,
                exit_s=2.5,
                duration_s=2.5,
                enter_utc=datetime(2026, 9, 25, 7, 5, 18, tzinfo=UTC),
                exit_utc=datetime(2026, 9, 25, 7, 5, 20, 500000, tzinfo=UTC),
            ),
        ],
    )


def _make_export(with_zones: bool = False) -> VideoExport:
    track = make_track()
    document = make_document(track=track)
    if with_zones:
        document = document.model_copy(update={"setup": document.setup})
    return VideoExport(
        video_id="abc123",
        file_name=document.video.file_name,
        document=document,
        effective_track=track,
        results=_make_results(),
    )


def test_build_summary_rows() -> None:
    rows = build_summary_rows([_make_export()])
    assert [r.zone for r in rows] == ["Center", "No zone", "Not visible"]
    assert rows[0].time_s == 2.5
    assert rows[0].share_of_trial == 0.625
    assert rows[0].threshold == 0.5


def test_build_visit_rows_converts_local_time() -> None:
    rows = build_visit_rows([_make_export()])
    assert len(rows) == 1
    row = rows[0]
    assert row.zone == "Center"
    assert row.enter_utc is not None
    assert row.enter_local is not None
    assert row.enter_local.astimezone(UTC) == row.enter_utc


def test_build_track_rows_without_zones() -> None:
    export = _make_export()
    rows = build_track_rows([export])
    assert len(rows) == export.effective_track.frame_count
    assert rows[0].zone_flags == {}
    assert rows[0].status == "detected"


def test_build_settings_rows() -> None:
    rows = build_settings_rows([_make_export()])
    assert len(rows) == 1
    row = rows[0]
    assert row.tracker == "background_subtraction"
    assert row.in_zone_threshold == 0.5


def test_write_xlsx_contains_expected_sheets(tmp_path: Path) -> None:
    out = tmp_path / "export.xlsx"
    write_xlsx([_make_export()], out)
    assert out.exists()
    with zipfile.ZipFile(out) as zf:
        names = zf.namelist()
        assert "xl/workbook.xml" in names
        workbook_xml = zf.read("xl/workbook.xml").decode("utf-8")
        for sheet_name in ("Summary", "Visits", "Settings"):
            assert sheet_name in workbook_xml
        assert "Track mouse.mp4" in workbook_xml


def test_write_xlsx_multiple_videos_unique_track_sheets(tmp_path: Path) -> None:
    export_a = _make_export()
    export_b = _make_export()
    out = tmp_path / "combined.xlsx"
    write_xlsx([export_a, export_b], out)
    with zipfile.ZipFile(out) as zf:
        workbook_xml = zf.read("xl/workbook.xml").decode("utf-8")
        assert "Track mouse.mp4" in workbook_xml
        assert "Track mouse.mp4 (2)" in workbook_xml


def test_write_csv_summary_and_visits(tmp_path: Path) -> None:
    out_base = tmp_path / "export"
    paths = write_csv([_make_export()], out_base)
    assert [p.name for p in paths] == ["export_summary.csv", "export_visits.csv"]
    for path in paths:
        assert path.exists()

    with paths[0].open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))
    assert rows[0] == [
        "Video",
        "Zone",
        "Time (s)",
        "Share of trial (%)",
        "Trial start (s)",
        "Trial end (s)",
        "Threshold",
    ]
    assert rows[1][0] == "mouse.mp4"
    assert rows[1][1] == "Center"

    with paths[1].open(encoding="utf-8-sig", newline="") as handle:
        visit_rows = list(csv.reader(handle))
    assert visit_rows[1][2] == "Center"
    assert visit_rows[1][6].endswith("Z")  # UTC ISO column
