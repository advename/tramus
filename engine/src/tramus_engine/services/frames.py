"""FrameService: frame images, thumbnails, frame times, and detection previews used by the
video stage and the Setup screen.

An LRU of at most `_READER_CACHE_SIZE` open `FrameReader`s keeps sequential playback requests
fast; thumbnails are cached in memory, keyed by (video id, max_side, requested time).
"""

from __future__ import annotations

import base64
import threading
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from ..domain import ImageAdjustments, Setup
from ..imaging.adjust import apply_adjustments
from ..imaging.encode import encode_jpeg, encode_png, resize_max_side
from ..tracking.base import Observation
from ..tracking.registry import get_tracker
from ..video.reader import FrameReader
from .library import LibraryService

_READER_CACHE_SIZE = 4
_THUMBNAIL_CACHE_SIZE = 128


class _FrameReaderCache:
    """At most `capacity` open readers, evicting the least recently used."""

    def __init__(self, capacity: int = _READER_CACHE_SIZE) -> None:
        self._capacity = capacity
        self._lock = threading.Lock()
        self._readers: OrderedDict[str, FrameReader] = OrderedDict()

    def get(self, path: Path) -> FrameReader:
        key = str(path)
        with self._lock:
            reader = self._readers.pop(key, None)
            if reader is not None:
                self._readers[key] = reader
                return reader

        reader = FrameReader(path)
        with self._lock:
            self._readers[key] = reader
            while len(self._readers) > self._capacity:
                _, oldest = self._readers.popitem(last=False)
                oldest.close()
        return reader

    def close_all(self) -> None:
        with self._lock:
            readers = list(self._readers.values())
            self._readers.clear()
        for reader in readers:
            reader.close()


@dataclass(frozen=True)
class DetectionPreviewResult:
    """A detection preview, ready for the API layer to wrap in a response schema."""

    mask_png: str
    """Base64-encoded PNG of the thresholded detection mask (processing scale)."""
    observation: Observation | None
    scale: float


class FrameService:
    """Frame images, thumbnails, frame times, and detection previews.

    Resolves video ids to paths via `LibraryService`, raising `KeyError` for an unknown id (the
    API layer looks the video up first and turns that into a 404, so this is a safety net).
    """

    def __init__(self, library: LibraryService) -> None:
        self._library = library
        self._readers = _FrameReaderCache()
        self._thumbnail_lock = threading.Lock()
        self._thumbnails: OrderedDict[tuple[str, int, float], bytes] = OrderedDict()

    def _path_for(self, video_id: str) -> Path:
        path = self._library.path_for(video_id)
        if path is None:
            raise KeyError(video_id)
        return path

    def frame_times(self, video_id: str) -> np.ndarray:
        reader = self._readers.get(self._path_for(video_id))
        return reader.frame_times

    def frame_jpeg(
        self,
        video_id: str,
        index: int,
        *,
        max_side: int | None,
        brightness: int,
        contrast: int,
        quality: int,
    ) -> bytes:
        reader = self._readers.get(self._path_for(video_id))
        image = reader.read(index)  # raises IndexError for an out-of-range index
        return self._encode_frame(
            image, max_side=max_side, brightness=brightness, contrast=contrast, quality=quality
        )

    def thumbnail_jpeg(self, video_id: str, *, max_side: int, t: float) -> bytes:
        cache_key = (video_id, max_side, t)
        with self._thumbnail_lock:
            cached = self._thumbnails.get(cache_key)
            if cached is not None:
                self._thumbnails.move_to_end(cache_key)
                return cached

        reader = self._readers.get(self._path_for(video_id))
        index = reader.index_at_time(t)
        image = reader.read(index)
        jpeg = self._encode_frame(image, max_side=max_side, brightness=0, contrast=0, quality=80)

        with self._thumbnail_lock:
            self._thumbnails[cache_key] = jpeg
            self._thumbnails.move_to_end(cache_key)
            while len(self._thumbnails) > _THUMBNAIL_CACHE_SIZE:
                self._thumbnails.popitem(last=False)
        return jpeg

    def detection_preview(
        self, video_id: str, frame_index: int, setup: Setup
    ) -> DetectionPreviewResult:
        path = self._path_for(video_id)
        tracker = get_tracker(setup.detection.tracker)
        preview = tracker.preview(path, frame_index, setup)
        mask_png = base64.b64encode(encode_png(preview.mask)).decode("ascii")
        return DetectionPreviewResult(
            mask_png=mask_png, observation=preview.observation, scale=preview.scale
        )

    def shutdown(self) -> None:
        """Closes every open reader. Called on app shutdown."""
        self._readers.close_all()

    @staticmethod
    def _encode_frame(
        image: np.ndarray, *, max_side: int | None, brightness: int, contrast: int, quality: int
    ) -> bytes:
        adjustments = ImageAdjustments(brightness=brightness, contrast=contrast)
        adjusted = apply_adjustments(image, adjustments)
        resized = resize_max_side(adjusted, max_side)
        return encode_jpeg(resized, quality=quality)
