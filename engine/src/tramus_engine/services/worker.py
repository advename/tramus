"""The function that actually runs in a tracking worker process.

Must be a top-level, picklable callable (required by `ProcessPoolExecutor` with the `spawn`
start method — instance methods and closures can't be pickled).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..domain import Flag, ProcessingDevice, Setup, Track
from ..tracking.base import TrackingCancelled, TrackingFailed
from ..tracking.runner import run_tracking


@dataclass(frozen=True)
class WorkerRequest:
    job_id: str
    video_path: Path
    setup: Setup
    device: ProcessingDevice


@dataclass(frozen=True)
class ProgressMessage:
    job_id: str
    frames_done: int
    frames_total: int


@dataclass(frozen=True)
class WorkerResult:
    job_id: str
    track: Track | None = None
    flags: list[Flag] | None = None
    error: str | None = None
    cancelled: bool = False


def run_tracking_worker(
    request: WorkerRequest, progress_queue: Any, cancel_event: Any
) -> WorkerResult:
    """Runs `tracking.runner.run_tracking` for one video, reporting progress on `progress_queue`
    and honouring `cancel_event` (both created by a `multiprocessing.Manager`, so they're safe
    to share with the worker process)."""

    def progress(done: int, total: int) -> None:
        progress_queue.put(
            ProgressMessage(job_id=request.job_id, frames_done=done, frames_total=total)
        )

    try:
        outcome = run_tracking(
            request.video_path,
            request.setup,
            device=request.device,
            progress=progress,
            cancel=cancel_event,
        )
    except TrackingCancelled:
        return WorkerResult(job_id=request.job_id, cancelled=True)
    except TrackingFailed as exc:
        return WorkerResult(job_id=request.job_id, error=str(exc))
    except (
        Exception
    ) as exc:  # defensive: surface unexpected worker errors to the UI, not a traceback
        return WorkerResult(job_id=request.job_id, error=str(exc))
    return WorkerResult(job_id=request.job_id, track=outcome.track, flags=outcome.flags)
