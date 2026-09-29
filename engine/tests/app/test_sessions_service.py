"""services/sessions.py: setup-change detection for calibration edits after tracking."""

from __future__ import annotations

from pathlib import Path

from tests.app.conftest import make_document, make_track
from tramus_engine.domain import Calibration, CrossingRule, Exclusion, Flag, FlagReason
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


def test_adding_a_crossing_rule_after_tracking_logs_crossing_rules_changed(
    tmp_path: Path,
) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    rule = CrossingRule(id="r1", from_zone_id=None, to_zone_id=None)
    setup = session.document.setup.model_copy(
        update={
            "analysis": session.document.setup.analysis.model_copy(
                update={"crossing_rules": [rule]}
            )
        }
    )

    manager.put_setup(session, setup)

    change = session.document.setup_changes[-1]
    assert change.title == "Crossing rules changed"
    assert change.detail == "Results recalculated"


def test_crossing_rule_change_does_not_report_detection_settings_changed(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    rule = CrossingRule(id="r1", from_zone_id=None, to_zone_id=None)
    setup = session.document.setup.model_copy(
        update={
            "analysis": session.document.setup.analysis.model_copy(
                update={"crossing_rules": [rule]}
            )
        }
    )

    manager.put_setup(session, setup)

    titles = [c.title for c in session.document.setup_changes]
    assert "Detection settings changed" not in titles


def test_adding_an_exclusion_logs_excluded_with_the_time_range(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    exclusion = Exclusion(id="e1", start_s=62.3, end_s=65.0)
    setup = session.document.setup.model_copy(update={"exclusions": [exclusion]})

    manager.put_setup(session, setup)

    change = session.document.setup_changes[-1]
    assert change.title == "Excluded 01:02.300–01:05.000"
    assert change.detail == "Results recalculated"


def test_removing_an_exclusion_logs_removed_with_the_time_range(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    exclusion = Exclusion(id="e1", start_s=62.3, end_s=65.0)
    manager.put_setup(
        session, session.document.setup.model_copy(update={"exclusions": [exclusion]})
    )

    manager.put_setup(session, session.document.setup.model_copy(update={"exclusions": []}))

    change = session.document.setup_changes[-1]
    assert change.title == "Removed exclusion 01:02.300–01:05.000"
    assert change.detail == "Results recalculated"


def test_editing_an_exclusion_uses_a_stable_title_with_its_note(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    exclusion = Exclusion(id="e1", start_s=62.3, end_s=65.0, note="Cage door opened")
    manager.put_setup(
        session, session.document.setup.model_copy(update={"exclusions": [exclusion]})
    )

    moved = exclusion.model_copy(update={"start_s": 63.0, "end_s": 66.0})
    manager.put_setup(session, session.document.setup.model_copy(update={"exclusions": [moved]}))

    titles = [c.title for c in session.document.setup_changes]
    assert titles == ["Excluded 01:02.300–01:05.000", "Edited exclusion “Cage door opened”"]


def test_dragging_an_exclusion_boundary_coalesces(tmp_path: Path) -> None:
    manager = _manager()
    session = _tracked_session(tmp_path)
    exclusion = Exclusion(id="e1", start_s=10.0, end_s=20.0, note="Handling")
    manager.put_setup(
        session, session.document.setup.model_copy(update={"exclusions": [exclusion]})
    )

    for end_s in (20.5, 21.0, 21.5):
        dragged = exclusion.model_copy(update={"end_s": end_s})
        manager.put_setup(
            session, session.document.setup.model_copy(update={"exclusions": [dragged]})
        )

    titles = [c.title for c in session.document.setup_changes]
    assert titles == ["Excluded 00:10.000–00:20.000", "Edited exclusion “Handling”"]


def test_flags_with_status_hides_flags_entirely_inside_an_exclusion(tmp_path: Path) -> None:
    document = make_document(track=make_track())
    flag = Flag(
        id="not_found-2",
        reason=FlagReason.NOT_FOUND,
        frame_start=2,
        frame_end=3,
        t_start_s=0.08,
        t_end_s=0.12,
        detail="Lost for 0.04 s",
        metric=0.04,
    )
    document = document.model_copy(update={"flags": [flag]})
    setup = document.setup.model_copy(
        update={"exclusions": [Exclusion(id="e1", start_s=0.0, end_s=0.2)]}
    )
    document = document.model_copy(update={"setup": setup})
    session = Session(
        video_id="v1", video_path=tmp_path / "mouse.mp4", document=document, loaded_from_disk=False
    )

    assert session.flags_with_status() == []
