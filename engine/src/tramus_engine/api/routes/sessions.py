"""Session routes: the open-video draft document, corrections, tracking, save/discard.

`POST .../session` is idempotent: if a session is already open for the video (which may hold
unsaved edits) it's returned as-is rather than reloaded from disk.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ...domain import Correction, HistoryEntry, Job, JobState, Results, Setup, Track
from ...services.container import Services
from ...services.worker import WorkerResult
from ..deps import build_session_state, get_open_session, get_video_path
from ..events import EventHub
from ..schemas import ApplyTemplateToSessionRequest, FlagView, SessionState, build_flag_view


def build_router(services: Services, hub: EventHub) -> APIRouter:
    router = APIRouter(tags=["sessions"])

    def _publish(video_id: str) -> None:
        session = services.sessions.get(video_id)
        if session is not None:
            hub.publish_session_threadsafe(video_id, build_session_state(services, session))

    @router.post(
        "/videos/{video_id}/session", response_model=SessionState, operation_id="open_session"
    )
    def open_session(video_id: str) -> SessionState:
        path = get_video_path(services, video_id)
        video_info = services.library.probe(path)
        session = services.sessions.open(video_id, path, video_info)
        return build_session_state(services, session)

    @router.get(
        "/videos/{video_id}/session", response_model=SessionState, operation_id="get_session"
    )
    def get_session(video_id: str) -> SessionState:
        session = get_open_session(services, video_id)
        return build_session_state(services, session)

    @router.put(
        "/videos/{video_id}/session/setup",
        response_model=SessionState,
        operation_id="update_session_setup",
    )
    def update_session_setup(video_id: str, setup: Setup) -> SessionState:
        session = get_open_session(services, video_id)
        services.sessions.put_setup(session, setup)
        state = build_session_state(services, session)
        _publish(video_id)
        return state

    @router.put(
        "/videos/{video_id}/session/corrections",
        response_model=SessionState,
        operation_id="update_session_corrections",
    )
    def update_session_corrections(video_id: str, corrections: list[Correction]) -> SessionState:
        session = get_open_session(services, video_id)
        services.sessions.put_corrections(session, corrections)
        state = build_session_state(services, session)
        _publish(video_id)
        return state

    @router.post(
        "/videos/{video_id}/session/save", response_model=SessionState, operation_id="save_session"
    )
    def save_session(video_id: str) -> SessionState:
        session = get_open_session(services, video_id)
        services.sessions.save(session)
        state = build_session_state(services, session)
        _publish(video_id)
        return state

    @router.post(
        "/videos/{video_id}/session/discard",
        response_model=SessionState,
        operation_id="discard_session",
    )
    def discard_session(video_id: str) -> SessionState:
        session = get_open_session(services, video_id)
        services.sessions.discard(session)
        state = build_session_state(services, session)
        _publish(video_id)
        return state

    @router.post(
        "/videos/{video_id}/session/apply-template",
        response_model=SessionState,
        operation_id="apply_template_to_session",
    )
    def apply_template_to_session(
        video_id: str, body: ApplyTemplateToSessionRequest
    ) -> SessionState:
        session = get_open_session(services, video_id)
        template = services.templates.get(body.template_id)
        if template is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown template '{body.template_id}'.",
            )
        services.sessions.apply_template(session, template)
        state = build_session_state(services, session)
        _publish(video_id)
        return state

    @router.get(
        "/videos/{video_id}/session/track", response_model=Track, operation_id="get_session_track"
    )
    def get_session_track(video_id: str) -> Track:
        session = get_open_session(services, video_id)
        track = session.effective_track()
        if track is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="This video has not been tracked yet."
            )
        return track

    @router.get(
        "/videos/{video_id}/session/flags",
        response_model=list[FlagView],
        operation_id="get_session_flags",
    )
    def get_session_flags(video_id: str) -> list[FlagView]:
        session = get_open_session(services, video_id)
        return [
            build_flag_view(flag, flag_status) for flag, flag_status in session.flags_with_status()
        ]

    @router.get(
        "/videos/{video_id}/session/results",
        response_model=Results | None,
        operation_id="get_session_results",
    )
    def get_session_results(video_id: str) -> Results | None:
        session = get_open_session(services, video_id)
        return session.results()

    @router.get(
        "/videos/{video_id}/session/history",
        response_model=list[HistoryEntry],
        operation_id="get_session_history",
    )
    def get_session_history(video_id: str) -> list[HistoryEntry]:
        session = get_open_session(services, video_id)
        return session.history()

    @router.post(
        "/videos/{video_id}/session/track",
        response_model=Job,
        operation_id="start_session_tracking",
    )
    def start_session_tracking(video_id: str) -> Job:
        session = get_open_session(services, video_id)
        already_running = any(
            job.video_id == video_id and job.state in (JobState.QUEUED, JobState.RUNNING)
            for job in services.jobs.list()
        )
        if already_running:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tracking is already running for this video.",
            )
        requested_device = services.settings.load().device

        def on_success(job: Job, result: WorkerResult) -> None:
            if result.track is not None:
                services.sessions.record_tracking_result(session, result.track, result.flags or [])
            _publish(video_id)

        return services.jobs.submit(
            video_id=video_id,
            video_name=session.video_path.name,
            video_path=session.video_path,
            setup=session.document.setup,
            requested_device=requested_device,
            on_success=on_success,
        )

    return router
