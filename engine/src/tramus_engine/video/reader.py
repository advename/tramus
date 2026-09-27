"""Frame-accurate, thread-safe random access into a video file, backed by PyAV."""

from __future__ import annotations

import threading
from collections.abc import Iterator
from pathlib import Path
from types import TracebackType
from typing import Self

import av
import numpy as np

from .probe import _scan_presentation_pts

_MAX_FORWARD_SKIP = 64
"""Sequential/short-forward reads (target at most this many frames ahead) decode forward
instead of seeking; seeking is only worth its cost for larger jumps."""


class FrameReader:
    """Random-access reader for one video file.

    Sequential or short forward reads decode straight ahead. Any other read seeks to the
    previous keyframe and decodes forward to the exact target frame, so `read()` always returns
    the pixel-identical frame regardless of access pattern. Safe to call from multiple threads;
    an internal lock serialises access to the single underlying decoder.
    """

    def __init__(self, path: Path) -> None:
        self._path = Path(path)
        self._lock = threading.Lock()
        self._container = av.open(str(self._path))
        self._stream = self._container.streams.video[0]
        self._stream.thread_type = "AUTO"
        self.width = self._stream.width
        self.height = self._stream.height

        pts, time_base = _scan_presentation_pts(self._path)
        self._pts = pts
        self.frame_times = (
            (pts - pts[0]).astype(np.float64) * time_base if pts.size else np.zeros(0, np.float64)
        )
        self.frame_count = len(self.frame_times)

        self._decoder: Iterator[av.VideoFrame] | None = None
        self._pending_frame: av.VideoFrame | None = None
        self._next_index = 0

    def read(self, index: int, *, gray: bool = False) -> np.ndarray:
        """Return frame `index` as a BGR uint8 (or, with `gray=True`, grayscale uint8) array."""
        with self._lock:
            frame = self._frame_at(index)
            return frame.to_ndarray(format="gray" if gray else "bgr24")

    def iter_frames(
        self, start: int = 0, stop: int | None = None, *, gray: bool = True
    ) -> Iterator[tuple[int, np.ndarray]]:
        """Yield `(index, frame)` for `start..stop` (exclusive) in presentation order."""
        stop = self.frame_count if stop is None else stop
        fmt = "gray" if gray else "bgr24"
        with self._lock:
            for index in range(start, stop):
                frame = self._frame_at(index)
                yield index, frame.to_ndarray(format=fmt)

    def index_at_time(self, t_s: float) -> int:
        """Index of the frame whose presentation time is closest to `t_s`."""
        if self.frame_count == 0:
            raise IndexError("video has no frames")
        position = int(np.searchsorted(self.frame_times, t_s))
        if position <= 0:
            return 0
        if position >= self.frame_count:
            return self.frame_count - 1
        before, after = self.frame_times[position - 1], self.frame_times[position]
        return position - 1 if (t_s - before) <= (after - t_s) else position

    def close(self) -> None:
        with self._lock:
            self._decoder = None
            self._pending_frame = None
            self._container.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.close()

    # -- internals, assume the lock is held --------------------------------------------------

    def _frame_at(self, index: int) -> av.VideoFrame:
        if not 0 <= index < self.frame_count:
            raise IndexError(f"frame index {index} out of range (0..{self.frame_count - 1})")
        if (
            self._decoder is None
            or index < self._next_index
            or index - self._next_index > _MAX_FORWARD_SKIP
        ):
            self._seek_to(index)
        frame = self._pop_frame()
        while self._next_index <= index:
            frame = self._pop_frame()
        return frame

    def _pop_frame(self) -> av.VideoFrame:
        assert self._decoder is not None
        if self._pending_frame is not None:
            frame = self._pending_frame
            self._pending_frame = None
        else:
            frame = next(self._decoder)
        self._next_index += 1
        return frame

    def _seek_to(self, index: int) -> None:
        target_pts = int(self._pts[index])
        self._container.seek(target_pts, stream=self._stream, backward=True, any_frame=False)
        self._decoder = self._container.decode(self._stream)
        frame = next(self._decoder)
        self._next_index = int(np.searchsorted(self._pts, frame.pts))
        self._pending_frame = frame
