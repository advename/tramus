"""Fast video probing: container metadata plus a packet scan (no pixel decoding).

Frame time is presentation-order PTS relative to the first frame, never `i / fps` — the lab's
recordings are variable frame rate (samples jitter between 38 and 42 ms).
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import av
import numpy as np

from ..domain import VideoInfo
from .fingerprint import compute_fingerprint


def _scan_presentation_pts(path: Path) -> tuple[np.ndarray, float]:
    """Demux (not decode) every packet and return `(pts, time_base)`.

    `pts` is sorted ascending (presentation order; B-frames make packet order differ from PTS
    order). Demuxing reads packet headers only, so this is fast even for long recordings.
    """
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        time_base = float(stream.time_base)
        pts = [packet.pts for packet in container.demux(stream) if packet.pts is not None]
    pts.sort()
    return np.asarray(pts, dtype=np.int64), time_base


def _stream_info(path: Path) -> tuple[int, int, str, float]:
    """Cheap container-metadata-only read: `(width, height, codec, nominal_fps)`."""
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        rate = stream.average_rate or stream.guessed_rate
        return stream.width, stream.height, stream.codec_context.name, float(rate) if rate else 0.0


def read_frame_times(path: Path) -> np.ndarray:
    """Frame times in seconds, presentation order, relative to the first frame.

    Falls back to an evenly spaced `i / nominal_fps` grid only when the container carries no
    presentation timestamps at all.
    """
    pts, time_base = _scan_presentation_pts(path)
    if pts.size == 0:
        _width, _height, _codec, fps = _stream_info(path)
        if fps <= 0:
            return np.zeros(0, dtype=np.float64)
        with av.open(str(path)) as container:
            stream = container.streams.video[0]
            frame_count = sum(1 for _ in container.decode(stream))
        return np.arange(frame_count, dtype=np.float64) / fps
    return (pts - pts[0]).astype(np.float64) * time_base


def _recorded_at(path: Path) -> datetime | None:
    with av.open(str(path)) as container:
        stream = container.streams.video[0]
        raw = container.metadata.get("creation_time") or stream.metadata.get("creation_time")
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def probe_video(path: Path) -> VideoInfo:
    """Read everything Tramus needs to know about a video file, without decoding pixels."""
    width, height, codec, nominal_fps = _stream_info(path)
    times = read_frame_times(path)
    frame_count = len(times)

    if frame_count > 1:
        median_dt = float(np.median(np.diff(times)))
        duration_s = float(times[-1]) + median_dt
    elif frame_count == 1:
        duration_s = float(times[0])
    else:
        duration_s = 0.0

    if nominal_fps <= 0 and duration_s > 0:
        nominal_fps = frame_count / duration_s

    recorded_at = _recorded_at(path)

    return VideoInfo(
        file_name=path.name,
        fingerprint=compute_fingerprint(path),
        size_bytes=path.stat().st_size,
        width=width,
        height=height,
        codec=codec,
        frame_count=frame_count,
        duration_s=duration_s,
        nominal_fps=nominal_fps,
        recorded_at=recorded_at,
        recorded_at_source="container_metadata" if recorded_at is not None else None,
    )
