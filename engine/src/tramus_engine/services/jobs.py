"""JobManager: runs tracking jobs in worker processes and tracks their progress.

Each job runs in a `ProcessPoolExecutor` (the `spawn` context). Progress comes back through a
`multiprocessing.Manager` queue; cancellation goes out through a per-job `Manager` event. A
background thread consumes progress messages, updates `Job` objects, and publishes them
(thread-safely — the publisher usually calls `loop.call_soon_threadsafe`).
"""

from __future__ import annotations

import multiprocessing
import queue
import threading
from collections.abc import Callable
from concurrent.futures import Future, ProcessPoolExecutor
from dataclasses import dataclass
from multiprocessing.managers import SyncManager
from pathlib import Path
from threading import RLock
from typing import Any

from ..domain import Job, JobState, ProcessingDevice, Setup, new_id, utc_now
from ..tracking.registry import get_tracker
from .system import detect_gpu
from .worker import (
    ProgressMessage,
    WorkerRequest,
    WorkerResult,
    exit_with_parent,
    run_tracking_worker,
)

PublishJob = Callable[[Job], None]
OnJobSuccess = Callable[[Job, WorkerResult], None]


@dataclass
class _JobHandle:
    job: Job
    cancel_event: Any
    on_success: OnJobSuccess | None = None


class JobManager:
    def __init__(self, max_workers: int, publish: PublishJob | None = None) -> None:
        self._publish: PublishJob = publish or (lambda job: None)
        self._mp_context = multiprocessing.get_context("spawn")
        self._manager = SyncManager(ctx=self._mp_context)
        self._manager.start(initializer=exit_with_parent)
        self._executor = ProcessPoolExecutor(
            max_workers=max_workers, mp_context=self._mp_context, initializer=exit_with_parent
        )
        self._progress_queue: Any = self._manager.Queue()
        self._lock = RLock()
        self._jobs: dict[str, _JobHandle] = {}
        self._stopping = threading.Event()
        self._consumer = threading.Thread(target=self._consume_progress, daemon=True)
        self._consumer.start()

    def set_publisher(self, publish: PublishJob) -> None:
        """Set after construction once the WebSocket hub exists (services are created first)."""
        self._publish = publish

    def submit(
        self,
        *,
        video_id: str,
        video_name: str,
        video_path: Path,
        setup: Setup,
        requested_device: ProcessingDevice,
        batch_id: str | None = None,
        on_success: OnJobSuccess | None = None,
    ) -> Job:
        device = self._resolve_device(setup.detection.tracker, requested_device)
        job = Job(
            id=new_id(),
            video_id=video_id,
            video_name=video_name,
            batch_id=batch_id,
            state=JobState.QUEUED,
            created_at=utc_now(),
        )
        cancel_event = self._manager.Event()
        with self._lock:
            self._jobs[job.id] = _JobHandle(
                job=job, cancel_event=cancel_event, on_success=on_success
            )
        request = WorkerRequest(job_id=job.id, video_path=video_path, setup=setup, device=device)
        future = self._executor.submit(
            run_tracking_worker, request, self._progress_queue, cancel_event
        )
        future.add_done_callback(lambda f, jid=job.id: self._on_future_done(jid, f))
        self._publish(job)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            handle = self._jobs.get(job_id)
            return handle.job if handle else None

    def list(self) -> list[Job]:
        with self._lock:
            return [handle.job for handle in self._jobs.values()]

    def cancel(self, job_id: str) -> Job | None:
        with self._lock:
            handle = self._jobs.get(job_id)
            if handle is None:
                return None
            if handle.job.state in (JobState.QUEUED, JobState.RUNNING):
                handle.cancel_event.set()
            return handle.job

    def shutdown(self) -> None:
        """Stops all tracking immediately: running workers are terminated, not awaited."""
        self._stopping.set()
        self._executor.shutdown(wait=False, cancel_futures=True)
        _terminate_workers(self._executor)
        self._manager.shutdown()

    def _resolve_device(self, tracker_id: str, requested: ProcessingDevice) -> ProcessingDevice:
        try:
            supports_gpu = get_tracker(tracker_id).supports_gpu
        except Exception:  # unknown or misbehaving tracker id: fall back to CPU
            supports_gpu = False
        if requested == ProcessingDevice.CPU:
            return ProcessingDevice.CPU
        if requested == ProcessingDevice.GPU:
            return ProcessingDevice.GPU if supports_gpu else ProcessingDevice.CPU
        return (
            ProcessingDevice.GPU
            if supports_gpu and detect_gpu() is not None
            else ProcessingDevice.CPU
        )

    def _on_future_done(self, job_id: str, future: Future[WorkerResult]) -> None:
        with self._lock:
            handle = self._jobs.get(job_id)
        if handle is None:
            return
        try:
            result = future.result()
        except Exception as exc:  # pragma: no cover - defensive: worker process crashed outright
            self._finish(handle, JobState.FAILED, error=str(exc))
            return
        if result.cancelled:
            self._finish(handle, JobState.CANCELLED)
            return
        if result.error is not None:
            self._finish(handle, JobState.FAILED, error=result.error)
            return
        with self._lock:
            handle.job = handle.job.model_copy(
                update={
                    "state": JobState.SUCCEEDED,
                    "progress": 1.0,
                    "finished_at": utc_now(),
                    "flag_count": len(result.flags) if result.flags is not None else None,
                }
            )
        if handle.on_success is not None:
            handle.on_success(handle.job, result)
        self._publish(handle.job)

    def _finish(self, handle: _JobHandle, state: JobState, error: str | None = None) -> None:
        with self._lock:
            handle.job = handle.job.model_copy(
                update={"state": state, "finished_at": utc_now(), "error": error}
            )
        self._publish(handle.job)

    def _consume_progress(self) -> None:
        while not self._stopping.is_set():
            try:
                message: ProgressMessage = self._progress_queue.get(timeout=0.5)
            except queue.Empty:
                continue
            except (EOFError, OSError, BrokenPipeError):
                return
            with self._lock:
                handle = self._jobs.get(message.job_id)
            if handle is None:
                continue
            now = utc_now()
            update: dict[str, Any] = {}
            if handle.job.state == JobState.QUEUED:
                update["state"] = JobState.RUNNING
                update["started_at"] = now
            started_at = handle.job.started_at or now
            elapsed = max((now - started_at).total_seconds(), 0.0)
            fps = message.frames_done / elapsed if elapsed > 0 else None
            remaining = (
                (message.frames_total - message.frames_done) / fps if fps and fps > 0 else None
            )
            progress = message.frames_done / message.frames_total if message.frames_total else 0.0
            update.update(
                {
                    "frames_done": message.frames_done,
                    "frames_total": message.frames_total,
                    "progress": min(max(progress, 0.0), 1.0),
                    "fps": fps,
                    "elapsed_s": elapsed,
                    "remaining_s": remaining,
                }
            )
            with self._lock:
                handle.job = handle.job.model_copy(update=update)
            self._publish(handle.job)


def _terminate_workers(executor: ProcessPoolExecutor) -> None:
    """Terminates the pool's worker processes (Python 3.14+ has a public API for this)."""
    terminate = getattr(executor, "terminate_workers", None)
    if terminate is not None:
        terminate()
        return
    for process in list(getattr(executor, "_processes", {}).values()):
        process.terminate()
