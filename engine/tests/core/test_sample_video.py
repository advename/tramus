"""Integration test on the real lab footage (skipped if Sample1.mp4 isn't present)."""

from __future__ import annotations

import time
from pathlib import Path

from tramus_engine.domain import FrameStatus, ProcessingDevice, Setup
from tramus_engine.tracking import get_tracker


def test_tracking_sample1_has_almost_no_missing_frames(sample_video: Path) -> None:
    tracker = get_tracker("background_subtraction")
    start = time.time()
    track = tracker.track(sample_video, Setup(), device=ProcessingDevice.CPU)
    elapsed = time.time() - start

    missing = sum(1 for status in track.status if status == FrameStatus.MISSING)
    missing_pct = 100 * missing / track.frame_count
    fps = track.frame_count / elapsed
    print(
        f"\nSample1.mp4: {track.frame_count} frames in {elapsed:.2f}s "
        f"({fps:.1f} fps), {missing_pct:.3f}% missing"
    )
    assert missing_pct < 1.0
