"""Template store: one JSON file per template in `<user config dir>/templates/`."""

from __future__ import annotations

from pathlib import Path
from threading import RLock

from ..domain import Template
from .paths import templates_dir
from .sidecar import atomic_write_json


class TemplateStore:
    """CRUD for `Template`s, one file per template, newest-updated first."""

    def __init__(self, directory: Path | None = None) -> None:
        self._dir = directory or templates_dir()
        self._lock = RLock()

    def _path(self, template_id: str) -> Path:
        return self._dir / f"{template_id}.json"

    def list(self) -> list[Template]:
        with self._lock:
            templates: list[Template] = []
            for file in self._dir.glob("*.json"):
                try:
                    templates.append(Template.model_validate_json(file.read_text(encoding="utf-8")))
                except ValueError:
                    continue  # corrupt/unreadable file: skip rather than fail the whole listing
            templates.sort(key=lambda t: t.updated_at, reverse=True)
            return templates

    def get(self, template_id: str) -> Template | None:
        path = self._path(template_id)
        if not path.exists():
            return None
        return Template.model_validate_json(path.read_text(encoding="utf-8"))

    def save(self, template: Template) -> Template:
        with self._lock:
            atomic_write_json(self._path(template.id), template.model_dump(mode="json"))
            return template

    def delete(self, template_id: str) -> bool:
        with self._lock:
            path = self._path(template_id)
            if not path.exists():
                return False
            path.unlink()
            return True
