"""services/sessions.py: setup-change detection for calibration edits after tracking."""

from __future__ import annotations

from pathlib import Path

from tests.app.conftest import make_document, make_track
from tramus_engine.domain import Calibration
from tramus_engine.services.sessions import Session, SessionManager


def _manager() -> SessionManager:
    return SessionManager(app_version="0.1.0", default_in_zone_threshold=lambda: 0.5)


def _tracked_session(tmp_path: Path) -> Session:
    document = make_document(track=make_track())
    return Session(
        video_id="v1", video_path=tmp_path / "mouse.mp4", document=document, loaded_from_disk=False
    )


def test_setting_calibration_after_tracking_logs_scale_set(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    calibration = Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=50)
    setup = session.document.setup.model_copy(update={"calibration": calibration})

    manager.put_setup(session, setup)

    titles = [c.title for c in session.document.setup_changes]
    assert titles == ["Scale set"]
    assert session.document.setup_changes[0].detail == "1 px = 0.500 mm"


def test_calibration_change_does_not_report_detection_settings_changed(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    calibration = Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=50)
    setup = session.document.setup.model_copy(update={"calibration": calibration})

    manager.put_setup(session, setup)

    titles = [c.title for c in session.document.setup_changes]
    assert "Detection settings changed" not in titles


def test_removing_calibration_logs_scale_removed(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    calibration = Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=50)
    manager.put_setup(
        session, session.document.setup.model_copy(update={"calibration": calibration})
    )

    manager.put_setup(session, session.document.setup.model_copy(update={"calibration": None}))

    titles = [c.title for c in session.document.setup_changes]
    assert titles == ["Scale set", "Scale removed"]


def test_repeated_calibration_edits_coalesce(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    for length_mm in (50, 51, 52):
        calibration = Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=length_mm)
        setup = session.document.setup.model_copy(update={"calibration": calibration})
        manager.put_setup(session, setup)

    titles = [c.title for c in session.document.setup_changes]
    assert titles == ["Scale set"]
    assert session.document.setup_changes[0].detail == "1 px = 0.520 mm"
