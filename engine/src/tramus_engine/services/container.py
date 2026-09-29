"""Wires the application layer together: one `Services` object, created once at startup."""

from __future__ import annotations

from dataclasses import dataclass

from ..storage.batches import BatchStore
from ..storage.settings import SettingsStore
from ..storage.templates import TemplateStore
from .frames import FrameService
from .jobs import JobManager
from .library import LibraryService
from .sessions import SessionManager
from .system import app_version


@dataclass
class Services:
    """Everything the API and CLI share."""

    settings: SettingsStore
    templates: TemplateStore
    batches: BatchStore
    library: LibraryService
    sessions: SessionManager
    jobs: JobManager
    frames: FrameService
    app_version: str

    def shutdown(self) -> None:
        """Releases resources held across requests: open frame readers and job workers."""
        self.frames.shutdown()
        self.jobs.shutdown()


def create_services() -> Services:
    """Builds a `Services` instance. The job manager's WebSocket publisher is wired in
    separately by `api.app.create_app` once the event hub exists (`services.jobs.set_publisher`)."""
    version = app_version()
    settings = SettingsStore()
    templates = TemplateStore()
    batches = BatchStore()
    library = LibraryService()
    app_settings = settings.load()
    sessions = SessionManager(version, lambda: settings.load().default_in_zone_threshold)
    jobs = JobManager(max_workers=app_settings.parallel_jobs)
    frames = FrameService(library)
    return Services(
        settings=settings,
        templates=templates,
        batches=batches,
        library=library,
        sessions=sessions,
        jobs=jobs,
        frames=frames,
        app_version=version,
    )
