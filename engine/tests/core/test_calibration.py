"""domain/setup.py: `Calibration` — scale reference line (mm per px)."""

from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from tramus_engine.domain import Calibration, Setup


def test_mm_per_px() -> None:
    calibration = Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=50)
    assert calibration.length_px == 100
    assert calibration.mm_per_px == 0.5


def test_mm_per_px_diagonal_line() -> None:
    calibration = Calibration(x1=0, y1=0, x2=3, y2=4, length_mm=10)
    assert calibration.length_px == pytest.approx(5.0)
    assert calibration.mm_per_px == pytest.approx(2.0)


def test_identical_points_rejected() -> None:
    with pytest.raises(ValidationError):
        Calibration(x1=10, y1=10, x2=10, y2=10, length_mm=50)


def test_non_positive_length_mm_rejected() -> None:
    with pytest.raises(ValidationError):
        Calibration(x1=0, y1=0, x2=10, y2=0, length_mm=0)
    with pytest.raises(ValidationError):
        Calibration(x1=0, y1=0, x2=10, y2=0, length_mm=-5)


def test_setup_calibration_defaults_to_none() -> None:
    assert Setup().calibration is None


def test_setup_with_calibration_round_trips_through_json() -> None:
    setup = Setup(calibration=Calibration(x1=0, y1=0, x2=100, y2=0, length_mm=50))
    loaded = Setup.model_validate_json(setup.model_dump_json())
    assert loaded.calibration is not None
    assert loaded.calibration.mm_per_px == 0.5


def test_older_sidecar_without_calibration_still_loads() -> None:
    """Additive field: JSON missing `calibration` entirely still parses (older sidecars)."""
    setup = Setup.model_validate({"arena": None, "zones": []})
    assert setup.calibration is None


def test_length_px_matches_hypot() -> None:
    calibration = Calibration(x1=1, y1=2, x2=4, y2=6, length_mm=1)
    assert calibration.length_px == pytest.approx(math.hypot(3, 4))
