"""Export orchestration: gathers each video's current document, writes the workbook or CSVs,
and marks the source documents as exported."""

from __future__ import annotations

from pathlib import Path

from ..domain import ExportLayout, utc_now
from ..export.csv import write_csv
from ..export.tables import VideoExport, build_video_export
from ..export.xlsx import write_xlsx
from ..storage.sidecar import load_sidecar, save_sidecar
from .library import LibraryService
from .sessions import SessionManager


class NoAnalysisToExportError(ValueError):
    """Raised when none of the requested videos have a document to export."""


def export_videos(
    *,
    library: LibraryService,
    sessions: SessionManager,
    video_ids: list[str],
    format: str,
    path: Path,
    layout: ExportLayout = ExportLayout.WIDE,
) -> list[Path]:
    """Exports `video_ids` to `path`. Uses each video's open session if there is one, otherwise
    its sidecar; skips videos with neither. Sets `exported_at` and saves the source document."""
    exports: list[VideoExport] = []
    now = utc_now()
    for video_id in video_ids:
        video_path = library.path_for(video_id)
        if video_path is None:
            raise KeyError(video_id)
        session = sessions.get(video_id)
        document = session.document if session is not None else load_sidecar(video_path)
        if document is None:
            continue
        document = document.model_copy(update={"exported_at": now})
        save_sidecar(video_path, document)
        if session is not None:
            session.document = document
        exports.append(build_video_export(video_id, video_path.name, document))

    if not exports:
        raise NoAnalysisToExportError("none of the requested videos have an analysis to export")

    if format == "xlsx":
        write_xlsx(exports, path, layout=layout)
        return [path]
    if format == "csv":
        return write_csv(exports, path, layout=layout)
    raise ValueError(f"unknown export format: {format!r}")
