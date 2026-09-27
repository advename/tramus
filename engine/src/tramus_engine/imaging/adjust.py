"""Linear brightness/contrast adjustment applied to every frame before display *and* detection."""

from __future__ import annotations

import numpy as np

from ..domain import ImageAdjustments


def apply_adjustments(image: np.ndarray, adjustments: ImageAdjustments) -> np.ndarray:
    """`out = clip((in - 128) * (1 + contrast/100) + 128 + brightness * 1.28)`."""
    if adjustments.brightness == 0 and adjustments.contrast == 0:
        return image
    scaled = (image.astype(np.float32) - 128.0) * (1.0 + adjustments.contrast / 100.0)
    scaled += 128.0 + adjustments.brightness * 1.28
    np.clip(scaled, 0, 255, out=scaled)
    return scaled.astype(np.uint8)
