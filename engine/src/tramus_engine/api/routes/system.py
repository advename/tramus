"""`GET /system` — version, platform, CPU count, GPU, available trackers."""

from __future__ import annotations

from fastapi import APIRouter

from ...services.container import Services
from ...services.system import get_system_info
from ..schemas import GpuInfo, SystemInfo, TrackerInfo


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["system"])

    @router.get("/system", response_model=SystemInfo, operation_id="get_system_info")
    def system_info() -> SystemInfo:
        info = get_system_info()
        return SystemInfo(
            version=info.version,
            engine_version=info.engine_version,
            platform=info.platform,
            cpu_count=info.cpu_count,
            gpu=GpuInfo(name=info.gpu.name) if info.gpu else None,
            trackers=[
                TrackerInfo(id=t.id, name=t.name, supports_gpu=t.supports_gpu)
                for t in info.trackers
            ],
        )

    return router
