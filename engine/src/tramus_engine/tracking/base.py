"""The tracker plugin API: every tracker (built-in or third-party) implements `Tracker`."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np

from ..domain import ProcessingDevice, Setup, Track

ProgressCallback = Callable[[int, int], None]
"""`(frames_done, frames_total)`, called about every 10 frames plus once at completion."""


class CancelToken(Protocol):
    """Anything with an `is_set()` predicate — `threading.Event` and `multiprocessing.Event`
    both satisfy this without needing an adapter."""

    def is_set(self) -> bool: ...


class TrackingCancelled(Exception):
    """Raised by a tracker when `cancel.is_set()` becomes true during `track()`."""


class TrackingFailed(Exception):
    """Raised when tracking cannot continue. The message is shown to the end user as-is."""


@dataclass(frozen=True)
class Observation:
    """One detected body, in full-resolution video pixels."""

    x: float
    y: float
    semi_major: float
    semi_minor: float
    angle_deg: float
    area_px: float


@dataclass(frozen=True)
class DetectionPreview:
    """Result of previewing detection on a single frame, for the Setup screen."""

    mask: np.ndarray
    """Thresholded detection mask, uint8 0/255, at processing scale."""
    observation: Observation | None
    scale: float


class Tracker(Protocol):
    id: str
    name: str
    version: str
    supports_gpu: bool

    def track(
        self,
        video_path: Path,
        setup: Setup,
        *,
        device: ProcessingDevice,
        progress: ProgressCallback | None = None,
        cancel: CancelToken | None = None,
    ) -> Track: ...

    def preview(self, video_path: Path, frame_index: int, setup: Setup) -> DetectionPreview: ...
