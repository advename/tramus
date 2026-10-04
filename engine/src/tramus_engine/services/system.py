"""System info: engine version, platform, CPU count, GPU and available trackers."""

from __future__ import annotations

import os
import platform
import subprocess
from dataclasses import dataclass

from .. import __version__
from ..tracking.registry import available_trackers as _available_trackers

APP_VERSION_ENV = "TRAMUS_APP_VERSION"


def app_version() -> str:
    """The full Tramus version, e.g. "1.2.3 (build 45)" or "0.0.0-dev+abc1234.dirty".

    The desktop app passes it in `TRAMUS_APP_VERSION` so analyses, exports and the About screen
    all show what the app reports. Without it (CLI use) the engine's own version is used.
    """
    return os.environ.get(APP_VERSION_ENV) or __version__


@dataclass(frozen=True)
class GpuInfo:
    name: str


@dataclass(frozen=True)
class TrackerInfo:
    id: str
    name: str
    supports_gpu: bool


@dataclass(frozen=True)
class SystemInfo:
    version: str
    engine_version: str
    platform: str
    cpu_count: int
    gpu: GpuInfo | None
    trackers: list[TrackerInfo]


def detect_gpu() -> GpuInfo | None:
    """Runs `nvidia-smi` with a short timeout; `None` on any failure (no GPU, no driver, …)."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    name = result.stdout.strip().splitlines()[0].strip() if result.stdout.strip() else ""
    return GpuInfo(name=name) if name else None


def available_trackers() -> list[TrackerInfo]:
    """Trackers registered in `tracking.registry`."""
    return [
        TrackerInfo(id=t.id, name=t.name, supports_gpu=t.supports_gpu)
        for t in _available_trackers()
    ]


def get_system_info() -> SystemInfo:
    return SystemInfo(
        version=app_version(),
        engine_version=__version__,
        platform=platform.platform(),
        cpu_count=os.cpu_count() or 1,
        gpu=detect_gpu(),
        trackers=available_trackers(),
    )
