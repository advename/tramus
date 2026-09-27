"""Shared fixtures: small synthetic videos with a known "mouse" path."""

from __future__ import annotations

import math
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

import av
import cv2
import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class SyntheticVideo:
    path: Path
    width: int
    height: int
    fps: int
    frame_count: int
    positions: list[tuple[float, float] | None]  # true body centre per frame; None = no mouse
    recorded_at: str


def mouse_position(i: int, width: int, height: int) -> tuple[float, float]:
    """Deterministic path: a slow ellipse around the frame centre."""
    phase = i / 40 * 2 * math.pi
    return width / 2 + width * 0.3 * math.cos(phase), height / 2 + height * 0.25 * math.sin(phase)


def write_synthetic_video(
    path: Path,
    *,
    width: int = 320,
    height: int = 240,
    fps: int = 25,
    frame_count: int = 100,
    absent_frames: frozenset[int] = frozenset(),
    recorded_at: str = "2026-09-25T07:05:18.000000Z",
) -> SyntheticVideo:
    """A dark elliptical 'mouse' (with a thin tail) moving on a light, slightly textured floor."""
    rng = np.random.default_rng(7)
    floor = np.clip(200 + rng.normal(0, 3, (height, width)), 0, 255).astype(np.uint8)
    positions: list[tuple[float, float] | None] = []
    with av.open(str(path), mode="w") as container:
        container.metadata["creation_time"] = recorded_at
        stream = container.add_stream("mpeg4", rate=Fraction(fps, 1))
        stream.width, stream.height, stream.pix_fmt = width, height, "yuv420p"
        stream.options = {"qscale": "2"}
        for i in range(frame_count):
            img = floor.copy()
            if i in absent_frames:
                positions.append(None)
            else:
                cx, cy = mouse_position(i, width, height)
                phase = i / 40 * 2 * math.pi
                angle = math.degrees(math.atan2(math.cos(phase), -math.sin(phase)))
                centre = (round(cx), round(cy))
                cv2.ellipse(img, centre, (14, 7), angle, 0, 360, 40, -1)
                tail_dx, tail_dy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
                tail = (round(cx - 26 * tail_dx), round(cy - 26 * tail_dy))
                cv2.line(img, centre, tail, 60, 1)
                positions.append((cx, cy))
            bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
            frame = av.VideoFrame.from_ndarray(bgr, format="bgr24")
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
    return SyntheticVideo(path, width, height, fps, frame_count, positions, recorded_at)


@pytest.fixture(scope="session")
def synthetic_video(tmp_path_factory: pytest.TempPathFactory) -> SyntheticVideo:
    return write_synthetic_video(tmp_path_factory.mktemp("videos") / "mouse.mp4")


@pytest.fixture(scope="session")
def synthetic_video_with_gap(tmp_path_factory: pytest.TempPathFactory) -> SyntheticVideo:
    """Mouse absent for frames 40–59 (0.8 s) — should produce a `not_found` flag."""
    return write_synthetic_video(
        tmp_path_factory.mktemp("videos") / "mouse_gap.mp4", absent_frames=frozenset(range(40, 60))
    )


@pytest.fixture
def config_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Isolated user config dir for settings and templates."""
    directory = tmp_path / "config"
    monkeypatch.setenv("TRAMUS_CONFIG_DIR", str(directory))
    return directory


@pytest.fixture(scope="session")
def sample_video() -> Path:
    """The real lab sample, if present in the repo root (not committed)."""
    path = REPO_ROOT / "Sample1.mp4"
    if not path.exists():
        pytest.skip("Sample1.mp4 not present")
    return path
