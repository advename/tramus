"""`GET/POST /templates`, `GET/PUT/DELETE /templates/{id}`, `POST /templates/{id}/apply`."""

from __future__ import annotations

import getpass

from fastapi import APIRouter, HTTPException, Response, status

from ...domain import Template, new_id, utc_now
from ...services import batch as batch_service
from ...services.container import Services
from ...services.templates import setup_from_template
from ...storage.sidecar import save_sidecar
from ..deps import get_open_session, get_video_path, get_video_summary
from ..schemas import ApplyTemplateRequest, TemplateCreateRequest, VideoSummary


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["templates"])

    def _get_template(template_id: str) -> Template:
        template = services.templates.get(template_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown template '{template_id}'."
            )
        return template

    @router.get("/templates", response_model=list[Template], operation_id="list_templates")
    def list_templates() -> list[Template]:
        return services.templates.list()

    @router.post("/templates", response_model=Template, operation_id="create_template")
    def create_template(body: TemplateCreateRequest) -> Template:
        session = get_open_session(services, body.video_id)
        setup = session.document.setup
        now = utc_now()
        trial_duration_s = (setup.trial.end_s - setup.trial.start_s) if setup.trial else None
        template = Template(
            id=new_id(),
            name=body.name,
            created_at=now,
            updated_at=now,
            created_by=getpass.getuser(),
            reference_width=session.document.video.width,
            reference_height=session.document.video.height,
            arena=setup.arena,
            zones=setup.zones,
            image=setup.image,
            detection=setup.detection,
            analysis=setup.analysis,
            trial_duration_s=trial_duration_s,
        )
        return services.templates.save(template)

    @router.get("/templates/{template_id}", response_model=Template, operation_id="get_template")
    def get_template(template_id: str) -> Template:
        return _get_template(template_id)

    @router.put("/templates/{template_id}", response_model=Template, operation_id="update_template")
    def update_template(template_id: str, template: Template) -> Template:
        _get_template(template_id)  # 404 if unknown
        updated = template.model_copy(update={"id": template_id, "updated_at": utc_now()})
        return services.templates.save(updated)

    @router.delete(
        "/templates/{template_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        operation_id="delete_template",
    )
    def delete_template(template_id: str) -> Response:
        if not services.templates.delete(template_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown template '{template_id}'."
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post(
        "/templates/{template_id}/apply",
        response_model=list[VideoSummary],
        operation_id="apply_template",
    )
    def apply_template(template_id: str, body: ApplyTemplateRequest) -> list[VideoSummary]:
        template = _get_template(template_id)
        summaries: list[VideoSummary] = []
        for video_id in body.video_ids:
            path = get_video_path(services, video_id)
            video_info = services.library.probe(path)
            check = batch_service.check_video(video_id, path, video_info, template)
            setup = setup_from_template(
                template, video_info.width, video_info.height, trial=check.suggested_trial
            )
            session = services.sessions.get(video_id)
            if session is not None:
                services.sessions.put_setup(session, setup)
                services.sessions.save(session)
            else:
                document = batch_service.build_batch_document(
                    path, video_info, setup, services.app_version
                )
                save_sidecar(path, document)
            summaries.append(get_video_summary(services, video_id))
        return summaries

    return router
