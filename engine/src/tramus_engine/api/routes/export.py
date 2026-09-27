"""`POST /export` — one workbook or a pair of CSVs for one or many videos."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, status

from ...services import export as export_service
from ...services.container import Services
from ..schemas import ExportRequest, ExportResponse


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["export"])

    @router.post("/export", response_model=ExportResponse, operation_id="export_videos")
    def export_videos(body: ExportRequest) -> ExportResponse:
        try:
            files = export_service.export_videos(
                library=services.library,
                sessions=services.sessions,
                video_ids=body.video_ids,
                format=body.format,
                path=Path(body.path),
            )
        except KeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown video id {exc}."
            ) from exc
        except export_service.NoAnalysisToExportError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return ExportResponse(files=[str(f) for f in files])

    return router
