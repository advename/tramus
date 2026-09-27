"""The sidecar file (`<video>.tramus.json`) and the atomic, pretty-printed JSON writer it and the
other stores (settings, templates) share."""

from __future__ import annotations

import contextlib
import json
import os
import tempfile
from pathlib import Path

from ..domain import AnalysisDocument
from .paths import sidecar_path

__all__ = ["atomic_write_json", "atomic_write_text", "load_sidecar", "save_sidecar", "sidecar_path"]


def _default_file_mode() -> int:
    """The mode a normally created file gets (0o666 minus the process umask)."""
    umask = os.umask(0)
    os.umask(umask)
    return 0o666 & ~umask


_FILE_MODE = _default_file_mode()


def atomic_write_text(path: Path, text: str) -> None:
    """Writes `text` to `path` atomically: write to a temp file, then `os.replace`."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.chmod(tmp_name, _FILE_MODE)  # mkstemp creates 0o600; sidecars are shared lab files
        os.replace(tmp_name, path)
    except BaseException:
        with contextlib.suppress(OSError):
            os.remove(tmp_name)
        raise


def atomic_write_json(path: Path, data: object) -> None:
    """Writes `data` as pretty-printed JSON (indent 2), atomically."""
    atomic_write_text(path, json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def load_sidecar(video_path: Path) -> AnalysisDocument | None:
    """Loads the sidecar next to `video_path`, or `None` if it doesn't exist."""
    path = sidecar_path(video_path)
    if not path.exists():
        return None
    return AnalysisDocument.model_validate_json(path.read_text(encoding="utf-8"))


def save_sidecar(video_path: Path, document: AnalysisDocument) -> Path:
    """Writes the sidecar for `video_path` atomically and returns its path."""
    path = sidecar_path(video_path)
    atomic_write_json(path, document.model_dump(mode="json"))
    return path
