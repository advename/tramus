"""`GET /jobs`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ...domain import Job
from ...services.container import Services


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["jobs"])

    @router.get("/jobs", response_model=list[Job], operation_id="list_jobs")
    def list_jobs() -> list[Job]:
        return services.jobs.list()

    @router.get("/jobs/{job_id}", response_model=Job, operation_id="get_job")
    def get_job(job_id: str) -> Job:
        job = services.jobs.get(job_id)
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown job '{job_id}'."
            )
        return job

    @router.post("/jobs/{job_id}/cancel", response_model=Job, operation_id="cancel_job")
    def cancel_job(job_id: str) -> Job:
        job = services.jobs.cancel(job_id)
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown job '{job_id}'."
            )
        return job

    return router
