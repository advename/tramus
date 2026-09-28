"""An LRU cache of open `FrameReader`s, shared by anything that repeatedly reads frames from the
same video (frame serving, the tracker's detection preview) so a hot path reuses the reader's
already-open decoder and pre-scanned presentation timestamps instead of paying `FrameReader`'s
full-container packet scan (`probe._scan_presentation_pts`, demuxes the whole file) on every call.
"""

from __future__ import annotations

import threading
from collections import OrderedDict
from pathlib import Path

from .reader import FrameReader


class FrameReaderCache:
    """At most `capacity` open readers, evicting the least recently used."""

    def __init__(self, capacity: int = 4) -> None:
        self._capacity = capacity
        self._lock = threading.Lock()
        self._readers: OrderedDict[str, FrameReader] = OrderedDict()

    def get(self, path: Path) -> FrameReader:
        key = str(path)
        with self._lock:
            reader = self._readers.pop(key, None)
            if reader is not None:
                self._readers[key] = reader
                return reader

        reader = FrameReader(path)
        with self._lock:
            self._readers[key] = reader
            while len(self._readers) > self._capacity:
                _, oldest = self._readers.popitem(last=False)
                oldest.close()
        return reader

    def close_all(self) -> None:
        with self._lock:
            readers = list(self._readers.values())
            self._readers.clear()
        for reader in readers:
            reader.close()
