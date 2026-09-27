"""`POST /library/open`, `GET /library/recent` — folder scanning and recent folders."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from ...domain import RecentFolder
from ...services.container import Services
from ..schemas import FolderInfo, Library, OpenLibraryRequest, VideoSummary


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["library"])

    @router.post("/library/open", response_model=Library, operation_id="open_library")
    def open_library(body: OpenLibraryRequest) -> Library:
        folder = Path(body.path)
        try:
            info, summaries = services.library.scan_folder(folder)
        except (NotADirectoryError, FileNotFoundError) as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Not a folder: '{body.path}'."
            ) from exc
        services.settings.add_recent_folder(info.path, info.name, info.video_count)
        return Library(
            folder=FolderInfo(path=info.path, name=info.name, video_count=info.video_count),
            videos=[VideoSummary(**vars(v)) for v in summaries],
        )

    @router.get(
        "/library/recent", response_model=list[RecentFolder], operation_id="list_recent_folders"
    )
    def list_recent_folders() -> list[RecentFolder]:
        return services.settings.load().recent_folders

    return router
