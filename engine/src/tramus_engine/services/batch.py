"""Batch tracking: checking videos against a template, then queuing a tracking job per video.

A batch job doesn't use a `Session` — it loads (or creates) the document straight from the
sidecar, applies the item's setup, and on success saves the sidecar directly, refreshing an
open session for that video if there is one.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ..domain import AnalysisDocument, Job, ProcessingDevice, Setup, Template, VideoInfo, utc_now
from ..storage.sidecar import load_sidecar, save_sidecar
from .jobs import JobManager
from .sessions import SessionManager
from .worker import WorkerResult


def _format_precise(seconds: float) -> str:
    """`mm:ss.sss`, e.g. `04:48.620` — used for a video's actual duration."""
    minutes = int(seconds // 60)
    rest = seconds - minutes * 60
    return f"{minutes:02d}:{rest:06.3f}"


def _format_short(seconds: float) -> str:
    """`m:ss`, dropping a trailing `.000` — used for a template's round trial length."""
    minutes = int(seconds // 60)
    rest = seconds - minutes * 60
    if rest == int(rest):
        return f"{minutes}:{int(rest):02d}"
    return f"{minutes}:{rest:05.2f}"


@dataclass(frozen=True)
class BatchCheckItem:
    video_id: str
    file_name: str
    duration_s: float
    width: int
    height: int
    scale_x: float
    scale_y: float
    suggested_trial: tuple[float, float] | None
    warnings: list[str]


def check_video(
    video_id: str, video_path: Path, video_info: VideoInfo, template: Template
) -> BatchCheckItem:
    scale_x = video_info.width / template.reference_width
    scale_y = video_info.height / template.reference_height
    warnings: list[str] = []
    if (video_info.width, video_info.height) != (
        template.reference_width,
        template.reference_height,
    ):
        warnings.append(
            f"Different resolution: {video_info.width} × {video_info.height} "
            f"(template {template.reference_width} × {template.reference_height}). "
            "The overlay was scaled to fit."
        )

    stored = load_sidecar(video_path)
    if stored is not None and stored.setup.trial is not None:
        trial = (stored.setup.trial.start_s, stored.setup.trial.end_s)
    elif template.trial_duration_s is not None:
        end = min(video_info.duration_s, template.trial_duration_s)
        trial = (0.0, end)
        if template.trial_duration_s > video_info.duration_s:
            duration_text = _format_precise(video_info.duration_s)
            trial_text = _format_short(template.trial_duration_s)
            warnings.append(
                f"Video is {duration_text} long — shorter than the {trial_text} trial. "
                "The end was set to the last frame."
            )
    else:
        trial = (0.0, video_info.duration_s)

    return BatchCheckItem(
        video_id=video_id,
        file_name=video_path.name,
        duration_s=video_info.duration_s,
        width=video_info.width,
        height=video_info.height,
        scale_x=scale_x,
        scale_y=scale_y,
        suggested_trial=trial,
        warnings=warnings,
    )


def build_batch_document(
    video_path: Path, video_info: VideoInfo, setup: Setup, app_version: str
) -> AnalysisDocument:
    stored = load_sidecar(video_path)
    now = utc_now()
    if stored is not None:
        return stored.model_copy(update={"video": video_info, "setup": setup, "updated_at": now})
    return AnalysisDocument(
        app_version=app_version, created_at=now, updated_at=now, video=video_info, setup=setup
    )


def submit_batch_job(
    *,
    job_manager: JobManager,
    sessions: SessionManager,
    video_id: str,
    video_path: Path,
    video_info: VideoInfo,
    setup: Setup,
    requested_device: ProcessingDevice,
    batch_id: str,
    app_version: str,
) -> Job:
    document = build_batch_document(video_path, video_info, setup, app_version)

    def on_success(job: Job, result: WorkerResult) -> None:
        updated = document.model_copy(
            update={
                "track": result.track,
                "flags": result.flags or [],
                "corrections": [],
                "setup_changes": [],
                "updated_at": utc_now(),
            }
        )
        save_sidecar(video_path, updated)
        session = sessions.get(video_id)
        if session is not None and result.track is not None:
            sessions.record_tracking_result(session, result.track, result.flags or [])

    return job_manager.submit(
        video_id=video_id,
        video_name=video_path.name,
        video_path=video_path,
        setup=setup,
        requested_device=requested_device,
        batch_id=batch_id,
        on_success=on_success,
    )
