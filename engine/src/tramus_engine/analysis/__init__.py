"""Corrections, zone membership, results, crossings and history: everything derived from a raw
track."""

from .corrections import apply_corrections, flag_statuses
from .crossings import compute_crossings
from .exclusions import (
    analysed_intervals,
    clipped_exclusions,
    excluded_duration_s,
    frame_interval_overlap,
    frame_is_excluded,
    is_interval_fully_excluded,
)
from .history import build_history
from .occupancy import zone_fractions, zone_membership
from .results import compute_results
from .status import unresolved_flag_count, video_status

__all__ = [
    "analysed_intervals",
    "apply_corrections",
    "build_history",
    "clipped_exclusions",
    "compute_crossings",
    "compute_results",
    "excluded_duration_s",
    "flag_statuses",
    "frame_interval_overlap",
    "frame_is_excluded",
    "is_interval_fully_excluded",
    "unresolved_flag_count",
    "video_status",
    "zone_fractions",
    "zone_membership",
]
