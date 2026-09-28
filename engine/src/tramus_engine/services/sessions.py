"""In-memory sessions: one open-video draft `AnalysisDocument` per video.

Edits (setup, corrections) go to the session; `save()` writes the sidecar. The effective track
and results are cached per session and recomputed lazily after an edit invalidates them.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock

from ..analysis.corrections import apply_corrections, flag_statuses
from ..analysis.history import build_history
from ..analysis.results import compute_results
from ..domain import (
    AnalysisDocument,
    AnalysisSettings,
    Correction,
    EllipseShape,
    Flag,
    FlagStatus,
    HistoryEntry,
    PolygonShape,
    RectShape,
    Results,
    Setup,
    SetupChange,
    Shape,
    Template,
    Track,
    VideoInfo,
    new_id,
    utc_now,
)
from ..storage.sidecar import load_sidecar, save_sidecar, sidecar_path
from .templates import setup_from_template

COALESCE_WINDOW_S = 60.0


@dataclass
class Session:
    """One open video: the draft document plus UI-facing state and derived-data caches."""

    video_id: str
    video_path: Path
    document: AnalysisDocument
    loaded_from_disk: bool
    file_changed: bool = False
    dirty: bool = False
    saved_at: datetime | None = None
    lock: RLock = field(default_factory=RLock)
    _effective_track: Track | None = field(default=None, repr=False, compare=False)
    _track_stale: bool = field(default=True, repr=False, compare=False)
    _results: Results | None = field(default=None, repr=False, compare=False)
    _results_stale: bool = field(default=True, repr=False, compare=False)

    def invalidate(self) -> None:
        self._track_stale = True
        self._results_stale = True

    def effective_track(self) -> Track | None:
        with self.lock:
            if self._track_stale:
                if self.document.track is None:
                    self._effective_track = None
                else:
                    self._effective_track = apply_corrections(
                        self.document.track, self.document.corrections
                    )
                self._track_stale = False
            return self._effective_track

    def results(self) -> Results | None:
        with self.lock:
            if self._results_stale:
                self._results = compute_results(self.document, self.effective_track())
                self._results_stale = False
            return self._results

    def flags_with_status(self) -> list[tuple[Flag, FlagStatus]]:
        """Flags overlapping the trial window, each paired with its resolution status."""
        with self.lock:
            statuses = flag_statuses(self.document.flags, self.document.corrections)
            trial = self.document.setup.trial
            flags = self.document.flags
            if trial is not None:
                flags = [
                    f for f in flags if f.t_end_s >= trial.start_s and f.t_start_s <= trial.end_s
                ]
            return [(f, statuses[f.id]) for f in flags]

    def history(self) -> list[HistoryEntry]:
        with self.lock:
            return build_history(self.document)


def _modified_at(path: Path) -> datetime:
    """When `path` was last written, as a UTC datetime (for "Loaded · saved <time>")."""
    return datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)


def _empty_document(
    app_version: str, video_info: VideoInfo, in_zone_threshold: float
) -> AnalysisDocument:
    now = utc_now()
    setup = Setup(analysis=AnalysisSettings(in_zone_threshold=in_zone_threshold))
    return AnalysisDocument(
        app_version=app_version, created_at=now, updated_at=now, video=video_info, setup=setup
    )


def _shape_change_kind(old: Shape, new: Shape) -> str | None:
    """'moved', 'resized', or `None` if unchanged — a coarse classification for change text."""
    if old == new:
        return None
    if type(old) is not type(new):
        return "resized"
    if isinstance(old, RectShape) and isinstance(new, RectShape):
        return "moved" if (old.width, old.height) == (new.width, new.height) else "resized"
    if isinstance(old, EllipseShape) and isinstance(new, EllipseShape):
        return "moved" if (old.rx, old.ry) == (new.rx, new.ry) else "resized"
    if isinstance(old, PolygonShape) and isinstance(new, PolygonShape):
        if len(old.points) != len(new.points):
            return "resized"
        offsets = {
            (round(nx - ox, 3), round(ny - oy, 3))
            for (ox, oy), (nx, ny) in zip(old.points, new.points, strict=True)
        }
        return "moved" if len(offsets) == 1 else "resized"
    return "resized"


@dataclass(frozen=True)
class _SetupChangeText:
    title: str
    detail: str


def _diff_setup(old: Setup, new: Setup) -> list[_SetupChangeText]:
    """Human-readable setup changes, in the design's wording, for the session history."""
    changes: list[_SetupChangeText] = []

    if old.arena != new.arena:
        if old.arena is not None and new.arena is not None:
            kind = _shape_change_kind(old.arena, new.arena)
            if kind:
                changes.append(
                    _SetupChangeText("Edited arena", f"{kind.capitalize()} · results recalculated")
                )
        else:
            changes.append(_SetupChangeText("Edited arena", "Results recalculated"))

    old_zones = {zone.id: zone for zone in old.zones}
    new_zones = {zone.id: zone for zone in new.zones}
    for zone_id, zone in new_zones.items():
        previous = old_zones.get(zone_id)
        if previous is None:
            changes.append(_SetupChangeText(f"Added zone “{zone.name}”", "Results recalculated"))
            continue
        if previous.name != zone.name:
            title = f"Renamed zone “{previous.name}” → “{zone.name}”"
            changes.append(_SetupChangeText(title, "Results recalculated"))
        shape_change = _shape_change_kind(previous.shape, zone.shape)
        if shape_change:
            title = f"Edited zone “{zone.name}”"
            changes.append(
                _SetupChangeText(title, f"{shape_change.capitalize()} · results recalculated")
            )
    for zone_id, zone in old_zones.items():
        if zone_id not in new_zones:
            changes.append(_SetupChangeText(f"Deleted zone “{zone.name}”", "Results recalculated"))

    if old.analysis.in_zone_threshold != new.analysis.in_zone_threshold:
        old_pct = round(old.analysis.in_zone_threshold * 100)
        new_pct = round(new.analysis.in_zone_threshold * 100)
        title = f"In-zone threshold {old_pct}% → {new_pct}%"
        changes.append(_SetupChangeText(title, "Results recalculated"))

    if old.trial != new.trial:
        changes.append(_SetupChangeText("Trial changed", "Results recalculated"))

    if old.calibration != new.calibration:
        if new.calibration is not None:
            detail = f"1 px = {new.calibration.mm_per_px:.3f} mm"
            changes.append(_SetupChangeText("Scale set", detail))
        else:
            changes.append(_SetupChangeText("Scale removed", "Zone sizes shown in px"))

    if old.detection != new.detection or old.image != new.image:
        changes.append(_SetupChangeText("Detection settings changed", "Re-track to apply"))

    return changes


def _append_setup_changes(
    document: AnalysisDocument, changes: Sequence[_SetupChangeText], at: datetime
) -> AnalysisDocument:
    """Appends changes to `document.setup_changes`, coalescing consecutive same-title entries
    made within `COALESCE_WINDOW_S` of each other (a drag sends many updates)."""
    setup_changes = list(document.setup_changes)
    for change in changes:
        if (
            setup_changes
            and setup_changes[-1].title == change.title
            and (at - setup_changes[-1].at).total_seconds() < COALESCE_WINDOW_S
        ):
            setup_changes[-1] = setup_changes[-1].model_copy(
                update={"at": at, "detail": change.detail}
            )
        else:
            setup_changes.append(
                SetupChange(id=new_id(), at=at, title=change.title, detail=change.detail)
            )
    return document.model_copy(update={"setup_changes": setup_changes})


class SessionManager:
    """Owns every open-video `Session`, keyed by video id."""

    def __init__(self, app_version: str, default_in_zone_threshold: Callable[[], float]) -> None:
        self._app_version = app_version
        self._default_in_zone_threshold = default_in_zone_threshold
        self._lock = RLock()
        self._sessions: dict[str, Session] = {}

    def get(self, video_id: str) -> Session | None:
        with self._lock:
            return self._sessions.get(video_id)

    def open(self, video_id: str, video_path: Path, video_info: VideoInfo) -> Session:
        """Ensures a session is open for `video_id`. Idempotent: an already-open session (which
        may have unsaved edits) is returned as-is, with its video metadata refreshed."""
        with self._lock:
            existing = self._sessions.get(video_id)
            if existing is not None:
                with existing.lock:
                    existing.document = existing.document.model_copy(update={"video": video_info})
                return existing

            stored = load_sidecar(video_path)
            if stored is not None:
                file_changed = stored.video.fingerprint != video_info.fingerprint
                document = stored.model_copy(update={"video": video_info})
                loaded_from_disk = True
                saved_at = _modified_at(sidecar_path(video_path))
            else:
                file_changed = False
                document = _empty_document(
                    self._app_version, video_info, self._default_in_zone_threshold()
                )
                loaded_from_disk = False
                saved_at = None

            session = Session(
                video_id=video_id,
                video_path=video_path,
                document=document,
                loaded_from_disk=loaded_from_disk,
                file_changed=file_changed,
                saved_at=saved_at,
            )
            self._sessions[video_id] = session
            return session

    def close(self, video_id: str) -> None:
        with self._lock:
            self._sessions.pop(video_id, None)

    def put_setup(self, session: Session, setup: Setup) -> Session:
        with session.lock:
            now = utc_now()
            old_setup = session.document.setup
            document = session.document.model_copy(update={"setup": setup, "updated_at": now})
            if session.document.track is not None:
                changes = _diff_setup(old_setup, setup)
                if changes:
                    document = _append_setup_changes(document, changes, now)
            session.document = document
            session.dirty = True
            session.invalidate()
            return session

    def put_corrections(self, session: Session, corrections: list[Correction]) -> Session:
        with session.lock:
            session.document = session.document.model_copy(
                update={"corrections": corrections, "updated_at": utc_now()}
            )
            session.dirty = True
            session.invalidate()
            return session

    def apply_template(self, session: Session, template: Template) -> Session:
        setup = setup_from_template(
            template, session.document.video.width, session.document.video.height
        )
        return self.put_setup(session, setup)

    def record_tracking_result(self, session: Session, track: Track, flags: list[Flag]) -> Session:
        """Stores a fresh tracking outcome. Clears corrections/flags/setup-changes: they refer
        to the track that was just replaced."""
        with session.lock:
            session.document = session.document.model_copy(
                update={
                    "track": track,
                    "flags": flags,
                    "corrections": [],
                    "setup_changes": [],
                    "updated_at": utc_now(),
                }
            )
            session.dirty = True
            session.invalidate()
            return session

    def save(self, session: Session) -> Session:
        with session.lock:
            document = session.document.model_copy(update={"results": session.results()})
            save_sidecar(session.video_path, document)
            session.document = document
            session.dirty = False
            session.saved_at = utc_now()
            session.file_changed = False
            return session

    def discard(self, session: Session) -> Session:
        with session.lock:
            stored = load_sidecar(session.video_path)
            video_info = session.document.video
            if stored is not None:
                session.document = stored.model_copy(update={"video": video_info})
                session.loaded_from_disk = True
            else:
                session.document = _empty_document(
                    self._app_version, video_info, self._default_in_zone_threshold()
                )
                session.loaded_from_disk = False
            session.dirty = False
            session.file_changed = False
            session.invalidate()
            return session
