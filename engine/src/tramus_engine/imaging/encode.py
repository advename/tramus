"""Resizing and encoding frames for the API (`image/jpeg`, `image/png` responses)."""

from __future__ import annotations

import cv2
import numpy as np


def resize_max_side(image: np.ndarray, max_side: int | None) -> np.ndarray:
    """Downscale `image` so its longest side is `max_side`, preserving aspect ratio.

    Never upscales; returns `image` unchanged if it already fits or `max_side` is `None`.
    """
    if max_side is None:
        return image
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= max_side:
        return image
    scale = max_side / longest
    new_size = (max(1, round(width * scale)), max(1, round(height * scale)))
    return cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)


def encode_jpeg(image: np.ndarray, quality: int = 82) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("failed to encode image as JPEG")
    return buffer.tobytes()


def encode_png(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".png", image)
    if not ok:
        raise ValueError("failed to encode image as PNG")
    return buffer.tobytes()
