"""Cheap, stable file fingerprint used to detect that a video changed on disk.

Hashing the whole file would be slow for multi-gigabyte recordings, so we hash the file size
plus three 1 MiB chunks (start, middle, end). That is enough to notice truncation, re-encoding
or any edit that touches the file, without reading gigabytes for every probe.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

_CHUNK_SIZE = 1024 * 1024


def compute_fingerprint(path: Path) -> str:
    """Return `"sha256:<hex>"` of the file size plus its first, middle and last 1 MiB."""
    size = path.stat().st_size
    digest = hashlib.sha256()
    digest.update(str(size).encode("ascii"))
    with path.open("rb") as file:
        digest.update(file.read(_CHUNK_SIZE))
        if size > _CHUNK_SIZE:
            middle = max(_CHUNK_SIZE, size // 2 - _CHUNK_SIZE // 2)
            file.seek(middle)
            digest.update(file.read(_CHUNK_SIZE))
        if size > _CHUNK_SIZE * 2:
            file.seek(max(0, size - _CHUNK_SIZE))
            digest.update(file.read(_CHUNK_SIZE))
    return f"sha256:{digest.hexdigest()}"
