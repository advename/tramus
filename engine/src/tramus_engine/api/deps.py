"""Shared helpers used by several route modules (video lookup, DTO projection)."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, status

from ..domain import JobState
from ..services.container import Services
from ..services.sessions import Session
from .schemas import SessionState, VideoSummary, build_document_view


def get_video_path(services: Services, video_id: str) -> Path:
    path = services.library.path_for(video_id)
    if path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown video id '{video_id}'."
        )
    return path


def get_video_summary(services: Services, video_id: str) -> VideoSummary:
    get_video_path(services, video_id)  # raises 404 for an unknown id
    return VideoSummary(**vars(services.library.summarize(video_id)))


def get_open_session(services: Services, video_id: str) -> Session:
    session = services.sessions.get(video_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"No open session for video '{video_id}'."
        )
    return session


def build_session_state(services: Services, session: Session) -> SessionState:
    active_job = next(
        (
            job
            for job in services.jobs.list()
            if job.video_id == session.video_id and job.state in (JobState.QUEUED, JobState.RUNNING)
        ),
        None,
    )
    return SessionState(
        video=get_video_summary(services, session.video_id),
        document=build_document_view(session.document),
        dirty=session.dirty,
        saved_at=session.saved_at,
        loaded_from_disk=session.loaded_from_disk,
        file_changed=session.file_changed,
        active_job=active_job,
    )
