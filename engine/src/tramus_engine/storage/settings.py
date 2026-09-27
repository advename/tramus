"""Application settings: one JSON file in the user config directory."""

from __future__ import annotations

from pathlib import Path
from threading import RLock

from ..domain import AppSettings, RecentFolder, utc_now
from .paths import settings_path
from .sidecar import atomic_write_json


class SettingsStore:
    """Loads/saves `AppSettings`, cached in memory and guarded by a lock."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path or settings_path()
        self._lock = RLock()
        self._settings: AppSettings | None = None

    def load(self) -> AppSettings:
        with self._lock:
            if self._settings is None:
                if self._path.exists():
                    self._settings = AppSettings.model_validate_json(
                        self._path.read_text(encoding="utf-8")
                    )
                else:
                    self._settings = AppSettings()
            return self._settings

    def save(self, settings: AppSettings) -> AppSettings:
        with self._lock:
            atomic_write_json(self._path, settings.model_dump(mode="json"))
            self._settings = settings
            return settings

    def add_recent_folder(self, path: str, name: str, video_count: int) -> AppSettings:
        """Records a folder as just opened: dedupe by path, newest first, capped at 12."""
        with self._lock:
            current = self.load()
            others = [folder for folder in current.recent_folders if folder.path != path]
            entry = RecentFolder(
                path=path, name=name, video_count=video_count, last_opened_at=utc_now()
            )
            updated = current.model_copy(update={"recent_folders": [entry, *others][:12]})
            return self.save(updated)
