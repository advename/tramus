"""services/templates.py: `setup_from_template` scales shapes and the calibration line."""

from __future__ import annotations

from datetime import UTC, datetime

from tramus_engine.domain import (
    AnalysisSettings,
    Calibration,
    CrossingRule,
    RectShape,
    Template,
    Zone,
)
from tramus_engine.services.templates import setup_from_template


def _template(**overrides: object) -> Template:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    defaults: dict[object, object] = dict(
        id="tpl1",
        name="Standard arena",
        created_at=now,
        updated_at=now,
        created_by="tester",
        reference_width=320,
        reference_height=240,
    )
    defaults.update(overrides)
    return Template(**defaults)  # type: ignore[arg-type]


def test_setup_from_template_scales_calibration_endpoints() -> None:
    template = _template(calibration=Calibration(x1=10, y1=20, x2=110, y2=20, length_mm=50))
    setup = setup_from_template(template, width=640, height=480)  # 2x scale both axes
    assert setup.calibration is not None
    assert setup.calibration.x1 == 20
    assert setup.calibration.y1 == 40
    assert setup.calibration.x2 == 220
    assert setup.calibration.y2 == 40


def test_setup_from_template_keeps_length_mm_unchanged() -> None:
    template = _template(calibration=Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=50))
    setup = setup_from_template(template, width=1280, height=960)  # 4x scale
    assert setup.calibration is not None
    assert setup.calibration.length_mm == 50
    # mm_per_px halves because the line is now twice as long in px for the same real length.
    assert setup.calibration.mm_per_px == 0.125


def test_setup_from_template_applies_offset_to_calibration() -> None:
    template = _template(calibration=Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=50))
    setup = setup_from_template(template, width=320, height=240, offset=(5.0, -3.0))
    assert setup.calibration is not None
    assert setup.calibration.x1 == 5
    assert setup.calibration.y1 == -3
    assert setup.calibration.x2 == 105
    assert setup.calibration.y2 == -3


def test_setup_from_template_without_calibration_stays_none() -> None:
    template = _template()
    setup = setup_from_template(template, width=640, height=480)
    assert setup.calibration is None


def test_setup_from_template_has_no_exclusions() -> None:
    """Exclusions are per video — a fresh setup from a template never carries any."""
    template = _template()
    setup = setup_from_template(template, width=640, height=480)
    assert setup.exclusions == []


def test_setup_from_template_preserves_zone_ids_so_crossing_rules_keep_matching() -> None:
    left_shape = RectShape(x=0, y=0, width=10, height=10)
    right_shape = RectShape(x=20, y=0, width=10, height=10)
    left = Zone(id="left-zone", name="Left", color_index=0, shape=left_shape)
    right = Zone(id="right-zone", name="Right", color_index=1, shape=right_shape)
    rule = CrossingRule(id="r1", from_zone_id="left-zone", to_zone_id="right-zone")
    template = _template(zones=[left, right], analysis=AnalysisSettings(crossing_rules=[rule]))

    # Applied to a differently-sized video (2x scale, like a batch run).
    setup = setup_from_template(template, width=640, height=480)

    assert [zone.id for zone in setup.zones] == ["left-zone", "right-zone"]
    assert setup.analysis.crossing_rules == [rule]
    matching_rule = setup.analysis.crossing_rules[0]
    zone_ids = {zone.id for zone in setup.zones}
    assert matching_rule.from_zone_id in zone_ids
    assert matching_rule.to_zone_id in zone_ids
