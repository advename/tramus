"""`POST /batches/check`, `POST /batches` — check videos against a template, then track them.
`GET /batches`, `GET /batches/{id}`, `DELETE /batches/{id}` — the saved batch list (persisted so
it survives an app restart; job progress itself stays in-memory, see `services/batch.py`)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Response, status

from ...domain import BatchItemRecord, BatchRecord, Template, new_id, utc_now
from ...services import batch as batch_service
from ...services.container import Services
from ...services.templates import setup_from_template
from ..deps import get_video_path
from ..schemas import (
    Batch,
    BatchCheckItem,
    BatchCheckRequest,
    BatchCreateRequest,
    BatchListResponse,
    BatchView,
    build_batch_view,
    build_broken_batch_view,
)


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["batches"])

    def _get_template(template_id: str) -> Template:
        template = services.templates.get(template_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown template '{template_id}'."
            )
        return template

    def _get_batch_record(batch_id: str) -> BatchRecord:
        record = services.batches.get(batch_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown batch '{batch_id}'."
            )
        return record

    @router.post("/batches/check", response_model=list[BatchCheckItem], operation_id="check_batch")
    def check_batch(body: BatchCheckRequest) -> list[BatchCheckItem]:
        template = _get_template(body.template_id)
        items: list[BatchCheckItem] = []
        for video_id in body.video_ids:
            path = get_video_path(services, video_id)
            video_info = services.library.probe(path)
            check = batch_service.check_video(video_id, path, video_info, template)
            items.append(
                BatchCheckItem(
                    video_id=check.video_id,
                    file_name=check.file_name,
                    duration_s=check.duration_s,
                    width=check.width,
                    height=check.height,
                    scale_x=check.scale_x,
                    scale_y=check.scale_y,
                    suggested_trial=check.suggested_trial,
                    warnings=check.warnings,
                )
            )
        return items

    @router.post("/batches", response_model=Batch, operation_id="create_batch")
    def create_batch(body: BatchCreateRequest) -> Batch:
        template = _get_template(body.template_id)
        batch_id = new_id()
        requested_device = services.settings.load().device
        jobs = []
        records: list[BatchItemRecord] = []
        for item in body.items:
            path = get_video_path(services, item.video_id)
            video_info = services.library.probe(path)
            setup = setup_from_template(
                template,
                video_info.width,
                video_info.height,
                offset=(item.offset_x, item.offset_y),
                trial=item.trial,
            )
            job = batch_service.submit_batch_job(
                job_manager=services.jobs,
                sessions=services.sessions,
                video_id=item.video_id,
                video_path=path,
                video_info=video_info,
                setup=setup,
                requested_device=requested_device,
                batch_id=batch_id,
                app_version=services.app_version,
            )
            jobs.append(job)
            records.append(
                BatchItemRecord(
                    video_id=item.video_id,
                    video_path=str(path),
                    file_name=path.name,
                    trial=item.trial,
                    offset_x=item.offset_x,
                    offset_y=item.offset_y,
                )
            )
        folder = str(Path(records[0].video_path).parent) if records else ""
        services.batches.save(
            BatchRecord(
                id=batch_id,
                created_at=utc_now(),
                template_id=template.id,
                template_name=template.name,
                folder=folder,
                items=records,
            )
        )
        return Batch(id=batch_id, jobs=jobs)

    @router.get("/batches", response_model=BatchListResponse, operation_id="list_batches")
    def list_batches() -> BatchListResponse:
        records, broken = services.batches.list_all()
        summaries = [
            batch_service.summarize_batch(record, library=services.library, jobs=services.jobs)
            for record in records
        ]
        return BatchListResponse(
            batches=[build_batch_view(summary) for summary in summaries],
            broken=[build_broken_batch_view(item) for item in broken],
        )

    @router.get("/batches/{batch_id}", response_model=BatchView, operation_id="get_batch")
    def get_batch(batch_id: str) -> BatchView:
        record = _get_batch_record(batch_id)
        summary = batch_service.summarize_batch(
            record, library=services.library, jobs=services.jobs
        )
        return build_batch_view(summary)

    @router.delete(
        "/batches/{batch_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        operation_id="delete_batch",
    )
    def delete_batch(batch_id: str) -> Response:
        """Reset: removes the saved batch record only — never the sidecars or videos it tracked."""
        if not services.batches.delete(batch_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown batch '{batch_id}'."
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router
