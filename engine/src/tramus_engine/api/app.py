"""FastAPI application: wires services, auth, the event hub and the routes together."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from ..services.container import Services
from .auth import make_verify_token, make_verify_ws_token
from .errors import register_exception_handlers
from .events import EventHub
from .routes import batches, export, jobs, library, sessions, settings, system, templates, videos
from .schemas import HealthResponse


def create_app(services: Services, token: str) -> FastAPI:
    """Builds the FastAPI app for one engine process. `services` is created once by the caller
    (the CLI's `serve` command); this only wires it to HTTP routes, auth and the event hub."""
    hub = EventHub()
    services.jobs.set_publisher(hub.publish_job_threadsafe)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        hub.bind_loop(asyncio.get_running_loop())
        try:
            yield
        finally:
            services.shutdown()

    app = FastAPI(
        title="Tramus Engine",
        version=services.app_version,
        lifespan=lifespan,
    )
    app.state.services = services
    app.state.hub = hub

    register_exception_handlers(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    verify_token = make_verify_token(token)
    verify_ws_token = make_verify_ws_token(token)
    protected = [Depends(verify_token)]

    @app.get(
        "/api/health",
        response_model=HealthResponse,
        operation_id="health",
        tags=["system"],
        dependencies=protected,
    )
    def health() -> HealthResponse:
        return HealthResponse(status="ok", version=services.app_version)

    app.include_router(system.build_router(services), prefix="/api", dependencies=protected)
    app.include_router(settings.build_router(services), prefix="/api", dependencies=protected)
    app.include_router(library.build_router(services), prefix="/api", dependencies=protected)
    app.include_router(videos.build_router(services), prefix="/api", dependencies=protected)
    app.include_router(sessions.build_router(services, hub), prefix="/api", dependencies=protected)
    app.include_router(jobs.build_router(services), prefix="/api", dependencies=protected)
    app.include_router(batches.build_router(services), prefix="/api", dependencies=protected)
    app.include_router(templates.build_router(services), prefix="/api", dependencies=protected)
    app.include_router(export.build_router(services), prefix="/api", dependencies=protected)

    @app.websocket("/api/events")
    async def events_ws(websocket: WebSocket, _auth: None = Depends(verify_ws_token)) -> None:
        await hub.connect(websocket)
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            hub.disconnect(websocket)

    return app
