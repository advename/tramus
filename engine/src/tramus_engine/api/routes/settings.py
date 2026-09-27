"""`GET/PUT /settings` — application-wide user preferences."""

from __future__ import annotations

from fastapi import APIRouter

from ...domain import AppSettings
from ...services.container import Services


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["settings"])

    @router.get("/settings", response_model=AppSettings, operation_id="get_settings")
    def get_settings() -> AppSettings:
        return services.settings.load()

    @router.put("/settings", response_model=AppSettings, operation_id="update_settings")
    def update_settings(settings: AppSettings) -> AppSettings:
        # `parallel_jobs` takes effect on the next engine start: `ProcessPoolExecutor` can't be
        # resized in place, and tearing it down here would cancel any job in flight.
        return services.settings.save(settings)

    return router
