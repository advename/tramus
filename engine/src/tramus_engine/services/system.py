"""System info: engine version, platform, CPU count, GPU and available trackers."""

from __future__ import annotations

import os
import platform
import subprocess
from dataclasses import dataclass
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _package_version

from .. import __version__
from ..tracking.registry import available_trackers as _available_trackers


def app_version() -> str:
    try:
        return _package_version("tramus-engine")
    except PackageNotFoundError:  # pragma: no cover - only when not installed
        return __version__


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
        platform=platform.platform(),
        cpu_count=os.cpu_count() or 1,
        gpu=detect_gpu(),
        trackers=available_trackers(),
    )
