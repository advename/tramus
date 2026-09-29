"""Video/session status derived from the analysis document."""

from __future__ import annotations

from ..domain import AnalysisDocument, FlagStatus, VideoStatus
from .corrections import flag_statuses
from .exclusions import is_interval_fully_excluded


def unresolved_flag_count(document: AnalysisDocument) -> int:
    """Number of `unresolved` flags overlapping the trial window (the whole video if untrimmed)
    and not lying entirely inside an excluded period."""
    if document.track is None or not document.flags:
        return 0
    trial = document.setup.trial
    start = trial.start_s if trial else 0.0
    end = trial.end_s if trial else document.video.duration_s
    exclusions = document.setup.exclusions

    statuses = flag_statuses(document.flags, document.corrections)
    return sum(
        1
        for flag in document.flags
        if statuses[flag.id] == FlagStatus.UNRESOLVED
        and flag.t_start_s <= end
        and flag.t_end_s >= start
        and not is_interval_fully_excluded(flag.t_start_s, flag.t_end_s, exclusions)
    )


def video_status(document: AnalysisDocument | None) -> VideoStatus:
    """`new` (no document/empty setup) -> `set_up` (no track) -> `tracked` (unresolved flags) ->
    `reviewed` -> `exported` (`exported_at >= updated_at`)."""
    if document is None or document.setup.is_empty:
        return VideoStatus.NEW
    if document.track is None:
        return VideoStatus.SET_UP
    if unresolved_flag_count(document) > 0:
        return VideoStatus.TRACKED
    if document.exported_at is not None and document.exported_at >= document.updated_at:
        return VideoStatus.EXPORTED
    return VideoStatus.REVIEWED
