"""`POST /batches/check`, `POST /batches` — check videos against a template, then track them."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ...domain import Template, new_id
from ...services import batch as batch_service
from ...services.container import Services
from ...services.templates import setup_from_template
from ..deps import get_video_path
from ..schemas import Batch, BatchCheckItem, BatchCheckRequest, BatchCreateRequest


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["batches"])

    def _get_template(template_id: str) -> Template:
        template = services.templates.get(template_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown template '{template_id}'."
            )
        return template

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
        return Batch(id=batch_id, jobs=jobs)

    return router
