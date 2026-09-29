"""Batch store: one JSON file per saved batch in `<user config dir>/batches/`.

Job state (progress, running/succeeded/failed) is never persisted here — it lives only in the
in-memory `JobManager` for the lifetime of the engine process. What's saved is enough to rebuild
the Batch screen after a restart: which template, which videos, and each video's trial/offset.
Per-item status after a restart comes from the video's sidecar (see `services/batch.py`).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from threading import RLock

from ..domain import BatchRecord
from .paths import batches_dir
from .sidecar import atomic_write_json

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BrokenBatch:
    """A batch file that exists but couldn't be parsed — reported instead of dropped silently so
    the UI can offer to delete it."""

    id: str
    error: str


class BatchStore:
    """CRUD for `BatchRecord`s, one file per batch, newest-created first."""

    def __init__(self, directory: Path | None = None) -> None:
        self._dir = directory or batches_dir()
        self._lock = RLock()

    def _path(self, batch_id: str) -> Path:
        return self._dir / f"{batch_id}.json"

    def list_all(self) -> tuple[list[BatchRecord], list[BrokenBatch]]:
        """Valid records (newest `created_at` first) and any files that failed to parse. A
        corrupt or unreadable file never breaks the rest of the listing."""
        with self._lock:
            records: list[BatchRecord] = []
            broken: list[BrokenBatch] = []
            for file in self._dir.glob("*.json"):
                try:
                    records.append(
                        BatchRecord.model_validate_json(file.read_text(encoding="utf-8"))
                    )
                except (ValueError, OSError) as exc:
                    logger.warning("Skipping unreadable batch file %s: %s", file, exc)
                    broken.append(BrokenBatch(id=file.stem, error=str(exc)))
            records.sort(key=lambda b: b.created_at, reverse=True)
            return records, broken

    def get(self, batch_id: str) -> BatchRecord | None:
        path = self._path(batch_id)
        if not path.exists():
            return None
        return BatchRecord.model_validate_json(path.read_text(encoding="utf-8"))

    def save(self, record: BatchRecord) -> BatchRecord:
        with self._lock:
            atomic_write_json(self._path(record.id), record.model_dump(mode="json"))
            return record

    def delete(self, batch_id: str) -> bool:
        """Deletes the saved record only — never the sidecars or videos it references."""
        with self._lock:
            path = self._path(batch_id)
            if not path.exists():
                return False
            path.unlink()
            return True
