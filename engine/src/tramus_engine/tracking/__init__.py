"""Tracker plugin API, the built-in background-subtraction tracker, and flag detection."""

from .background_subtraction import BackgroundSubtractionTracker
from .base import (
    CancelToken,
    DetectionPreview,
    Observation,
    ProgressCallback,
    Tracker,
    TrackingCancelled,
    TrackingFailed,
)
from .flags import detect_flags
from .registry import available_trackers, get_tracker
from .runner import TrackingOutcome, run_tracking

__all__ = [
    "BackgroundSubtractionTracker",
    "CancelToken",
    "DetectionPreview",
    "Observation",
    "ProgressCallback",
    "Tracker",
    "TrackingCancelled",
    "TrackingFailed",
    "TrackingOutcome",
    "available_trackers",
    "detect_flags",
    "get_tracker",
    "run_tracking",
]
