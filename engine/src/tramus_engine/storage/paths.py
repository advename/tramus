"""Filesystem locations for user data: sidecars, templates, settings.

The user config directory is `platformdirs.user_config_dir("Tramus")`, overridable with the
`TRAMUS_CONFIG_DIR` environment variable (used by tests to get an isolated directory).
"""

from __future__ import annotations

import os
from pathlib import Path

import platformdirs

APP_NAME = "Tramus"


def config_dir() -> Path:
    """The user config directory, created if it doesn't exist yet."""
    override = os.environ.get("TRAMUS_CONFIG_DIR")
    path = Path(override) if override else Path(platformdirs.user_config_dir(APP_NAME))
    path.mkdir(parents=True, exist_ok=True)
    return path


def templates_dir() -> Path:
    path = config_dir() / "templates"
    path.mkdir(parents=True, exist_ok=True)
    return path


def batches_dir() -> Path:
    path = config_dir() / "batches"
    path.mkdir(parents=True, exist_ok=True)
    return path


def settings_path() -> Path:
    return config_dir() / "settings.json"


def sidecar_path(video_path: Path) -> Path:
    """`<video file name>.tramus.json`, next to the video."""
    return video_path.with_name(video_path.name + ".tramus.json")
