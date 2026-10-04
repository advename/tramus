"""What a tracking worker process runs: track, then detect flags, end to end."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ..domain import Flag, ProcessingDevice, Setup, Track
from .base import CancelToken, ProgressCallback
from .flags import detect_flags
from .registry import get_tracker


@dataclass
class TrackingOutcome:
    track: Track
    flags: list[Flag]


def run_tracking(
    video_path: Path,
    setup: Setup,
    *,
    device: ProcessingDevice,
    progress: ProgressCallback | None = None,
    cancel: CancelToken | None = None,
) -> TrackingOutcome:
    tracker = get_tracker(setup.detection.tracker)
    track = tracker.track(video_path, setup, device=device, progress=progress, cancel=cancel)
    flags = detect_flags(track, setup.analysis.unusual_size)
    return TrackingOutcome(track=track, flags=flags)
