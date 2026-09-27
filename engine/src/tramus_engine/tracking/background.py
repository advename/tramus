"""Background-image computation shared by background-subtraction style trackers (§5.1 step 3).

The mouse moves throughout the recording, so a per-pixel median of frames sampled evenly across
the whole video drops it out, leaving a clean floor/arena image. This never adapts frame to
frame (unlike MOG2 etc.) because a mouse that stops moving must not fade into the background.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from ..domain import ImageAdjustments
from ..imaging.adjust import apply_adjustments
from ..video.reader import FrameReader
from .base import TrackingFailed


def sample_background(
    path: Path, *, sample_count: int, scale: float, adjustments: ImageAdjustments
) -> np.ndarray:
    """Median of `sample_count` frames sampled evenly across the video, at processing scale.

    Frames are seeked to (not decoded sequentially) since only a handful are needed.
    """
    with FrameReader(path) as reader:
        frame_count = reader.frame_count
        if frame_count == 0:
            raise TrackingFailed("The video has no frames.")
        n = min(sample_count, frame_count)
        indices = np.linspace(0, frame_count - 1, num=n, dtype=np.int64)
        proc_w = max(1, round(reader.width * scale))
        proc_h = max(1, round(reader.height * scale))
        samples = np.empty((n, proc_h, proc_w), dtype=np.uint8)
        for i, index in enumerate(indices):
            gray = reader.read(int(index), gray=True)
            gray = apply_adjustments(gray, adjustments)
            if scale < 1.0:
                gray = cv2.resize(gray, (proc_w, proc_h), interpolation=cv2.INTER_AREA)
            samples[i] = gray
    return np.median(samples, axis=0).astype(np.uint8)
