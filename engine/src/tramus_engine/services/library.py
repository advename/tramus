"""Library: scanning folders for videos, a video-id ↔ path registry, and a probe cache."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path
from threading import RLock

from ..analysis.status import unresolved_flag_count, video_status
from ..domain import VIDEO_EXTENSIONS, VideoInfo, VideoStatus
from ..storage.sidecar import load_sidecar
from ..video.probe import probe_video


def video_id_for_path(path: Path) -> str:
    """`sha1(absolute path)[:16]`."""
    return hashlib.sha1(str(path.resolve()).encode("utf-8")).hexdigest()[:16]


@dataclass(frozen=True)
class VideoSummary:
    id: str
    path: str
    file_name: str
    size_bytes: int
    duration_s: float
    width: int
    height: int
    recorded_at: str | None
    status: VideoStatus
    unresolved_flags: int
    file_changed: bool
    has_analysis: bool


@dataclass(frozen=True)
class FolderInfo:
    path: str
    name: str
    video_count: int


@dataclass
class _ProbeCacheEntry:
    mtime: float
    size: int
    info: VideoInfo


class LibraryService:
    """Registers video ids ↔ absolute paths; caches probe results by path + mtime + size."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._paths_by_id: dict[str, Path] = {}
        self._probe_cache: dict[str, _ProbeCacheEntry] = {}

    def register(self, path: Path) -> str:
        video_id = video_id_for_path(path)
        with self._lock:
            self._paths_by_id[video_id] = path.resolve()
        return video_id

    def path_for(self, video_id: str) -> Path | None:
        with self._lock:
            return self._paths_by_id.get(video_id)

    def scan_folder(self, folder: Path) -> tuple[FolderInfo, list[VideoSummary]]:
        folder = folder.resolve()
        if not folder.is_dir():
            raise NotADirectoryError(str(folder))
        video_paths = sorted(
            p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS
        )
        summaries = [self.summarize(self.register(p)) for p in video_paths]
        info = FolderInfo(path=str(folder), name=folder.name, video_count=len(summaries))
        return info, summaries

    def probe(self, path: Path) -> VideoInfo:
        stat = path.stat()
        with self._lock:
            cached = self._probe_cache.get(str(path))
            if cached and cached.mtime == stat.st_mtime and cached.size == stat.st_size:
                return cached.info
        info = probe_video(path)
        with self._lock:
            self._probe_cache[str(path)] = _ProbeCacheEntry(
                mtime=stat.st_mtime, size=stat.st_size, info=info
            )
        return info

    def summarize(self, video_id: str) -> VideoSummary:
        path = self.path_for(video_id)
        if path is None:
            raise KeyError(video_id)
        probed = self.probe(path)
        document = load_sidecar(path)
        stat = path.stat()
        file_changed = document is not None and document.video.fingerprint != probed.fingerprint
        return VideoSummary(
            id=video_id,
            path=str(path),
            file_name=path.name,
            size_bytes=stat.st_size,
            duration_s=probed.duration_s,
            width=probed.width,
            height=probed.height,
            recorded_at=probed.recorded_at.isoformat().replace("+00:00", "Z")
            if probed.recorded_at
            else None,
            status=video_status(document),
            unresolved_flags=unresolved_flag_count(document) if document else 0,
            file_changed=file_changed,
            has_analysis=document is not None,
        )
