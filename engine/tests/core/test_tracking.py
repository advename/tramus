"""tracking/background_subtraction.py, flags.py, postprocess.py, runner.py."""

from __future__ import annotations

import math
import threading

import pytest

from tests.conftest import SyntheticVideo
from tests.core.conftest import make_track
from tramus_engine.domain import FlagReason, FrameStatus, ProcessingDevice, Setup, UnusualSizeRule
from tramus_engine.tracking import (
    TrackingCancelled,
    get_tracker,
    run_tracking,
)
from tramus_engine.tracking.postprocess import fill_short_gaps


def test_tracker_detects_every_frame_within_tolerance(synthetic_video: SyntheticVideo) -> None:
    tracker = get_tracker("background_subtraction")
    track = tracker.track(synthetic_video.path, Setup(), device=ProcessingDevice.CPU)

    assert track.frame_count == synthetic_video.frame_count
    assert all(status == FrameStatus.DETECTED for status in track.status)

    errors = []
    for i, position in enumerate(synthetic_video.positions):
        assert position is not None
        true_x, true_y = position
        errors.append(math.hypot(track.x[i] - true_x, track.y[i] - true_y))
    assert max(errors) < 1.5

    # The tail must be excluded: body semi_major should track the drawn ellipse (~14 px), not
    # the ~30 px it would be if the tail were included in the contour.
    majors = [value for value in track.semi_major if value is not None]
    assert 11 <= sum(majors) / len(majors) <= 17


def test_tracker_parameters_snapshot_is_complete(synthetic_video: SyntheticVideo) -> None:
    tracker = get_tracker("background_subtraction")
    track = tracker.track(synthetic_video.path, Setup(), device=ProcessingDevice.CPU)
    for key in (
        "threshold",
        "processing_scale",
        "background_sample_count",
        "sensitivity",
        "polarity",
        "min_mouse_area_px",
        "brightness",
        "contrast",
    ):
        assert key in track.parameters


def test_tracker_registry_returns_singletons() -> None:
    from tramus_engine.tracking.registry import get_tracker as _get

    a = _get("background_subtraction")
    b = _get("background_subtraction")
    assert a is b
    assert a.id == "background_subtraction"
    assert a.version == "1.0.0"
    assert a.supports_gpu is False


def test_gap_produces_missing_frames_and_not_found_flag(
    synthetic_video_with_gap: SyntheticVideo,
) -> None:
    outcome_track = get_tracker("background_subtraction").track(
        synthetic_video_with_gap.path, Setup(), device=ProcessingDevice.CPU
    )
    for i in range(40, 60):
        assert outcome_track.status[i] == FrameStatus.MISSING

    from tramus_engine.tracking.flags import detect_flags

    flags = detect_flags(outcome_track, UnusualSizeRule())
    not_found = [f for f in flags if f.reason == FlagReason.NOT_FOUND]
    assert len(not_found) == 1
    flag = not_found[0]
    assert flag.frame_start == 40
    assert flag.frame_end == 59
    assert flag.detail == "Lost for 0.8 s"


def test_run_tracking_returns_track_and_flags(synthetic_video_with_gap: SyntheticVideo) -> None:
    outcome = run_tracking(synthetic_video_with_gap.path, Setup(), device=ProcessingDevice.CPU)
    assert outcome.track.frame_count == synthetic_video_with_gap.frame_count
    assert any(f.reason == FlagReason.NOT_FOUND for f in outcome.flags)


def test_cancellation_raises_and_progress_is_reported(synthetic_video: SyntheticVideo) -> None:
    tracker = get_tracker("background_subtraction")
    cancel = threading.Event()
    progress_calls: list[tuple[int, int]] = []

    def progress(done: int, total: int) -> None:
        progress_calls.append((done, total))
        if done >= 15:
            cancel.set()

    with pytest.raises(TrackingCancelled):
        tracker.track(
            synthetic_video.path,
            Setup(),
            device=ProcessingDevice.CPU,
            progress=progress,
            cancel=cancel,
        )
    assert progress_calls
    assert progress_calls[0][1] == synthetic_video.frame_count


def test_preview_returns_mask_and_observation(synthetic_video: SyntheticVideo) -> None:
    tracker = get_tracker("background_subtraction")
    preview = tracker.preview(synthetic_video.path, 10, Setup())
    assert preview.mask.dtype.name == "uint8"
    assert set(preview.mask.reshape(-1).tolist()) <= {0, 255}
    assert preview.observation is not None
    assert 0 < preview.scale <= 1.0


def test_fill_short_gaps_interpolates_within_half_second() -> None:
    status = [FrameStatus.DETECTED] * 3 + [FrameStatus.MISSING] * 4 + [FrameStatus.DETECTED] * 3
    track = make_track(n=10, dt=0.1, x=[float(i) for i in range(10)], status=status)
    filled = fill_short_gaps(track)
    for i in range(3, 7):
        assert filled.status[i] == FrameStatus.INTERPOLATED
        assert filled.x[i] is not None
    # linear interpolation between frame 2 (x=2) and frame 7 (x=7)
    assert filled.x[4] == pytest.approx(4.0, abs=0.05)


def test_fill_short_gaps_leaves_long_gaps_missing() -> None:
    status = [FrameStatus.DETECTED] * 3 + [FrameStatus.MISSING] * 20 + [FrameStatus.DETECTED] * 3
    track = make_track(n=26, dt=0.1, status=status)
    filled = fill_short_gaps(track)
    for i in range(3, 23):
        assert filled.status[i] == FrameStatus.MISSING
        assert filled.x[i] is None
