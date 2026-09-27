"""Tracker discovery: built-ins plus third-party trackers registered under the
`tramus.trackers` entry-point group. `get_tracker`/`available_trackers` return singleton
instances so a tracker's state (e.g. the background LRU cache) persists across calls."""

from __future__ import annotations

from importlib.metadata import entry_points

from .background_subtraction import BackgroundSubtractionTracker
from .base import Tracker

_builtin_trackers: dict[str, Tracker] = {}
_entry_point_trackers: dict[str, Tracker] | None = None


def _builtins() -> dict[str, Tracker]:
    if not _builtin_trackers:
        tracker = BackgroundSubtractionTracker()
        _builtin_trackers[tracker.id] = tracker
    return _builtin_trackers


def _plugins() -> dict[str, Tracker]:
    global _entry_point_trackers
    if _entry_point_trackers is None:
        trackers: dict[str, Tracker] = {}
        for entry_point in entry_points(group="tramus.trackers"):
            try:
                loaded = entry_point.load()
                tracker = loaded() if isinstance(loaded, type) else loaded
                trackers[tracker.id] = tracker
            except Exception:  # a broken third-party plugin must not break the whole registry
                continue
        _entry_point_trackers = trackers
    return _entry_point_trackers


def get_tracker(tracker_id: str) -> Tracker:
    trackers = {**_builtins(), **_plugins()}
    try:
        return trackers[tracker_id]
    except KeyError:
        raise KeyError(f"Unknown tracker '{tracker_id}'") from None


def available_trackers() -> list[Tracker]:
    return list({**_builtins(), **_plugins()}.values())
