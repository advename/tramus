"""API-only DTOs: request/response shapes that aren't part of the sidecar/domain contract.

Domain models (`Setup`, `Correction`, `Track`, `Results`, `Job`, `Template`, `AppSettings`,
`HistoryEntry`, `RecentFolder`, …) are used directly as request/response types where the API
shape matches the sidecar shape exactly; only the API-specific projections live here.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

from ..domain import (
    AnalysisDocument,
    Correction,
    ExportLayout,
    Flag,
    FlagStatus,
    Job,
    Results,
    Setup,
    SetupChange,
    UtcDateTime,
    VideoInfo,
    VideoStatus,
)
from ..services.batch import BatchItemSummary, BatchSummary
from ..storage.batches import BrokenBatch


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


# ---- system -------------------------------------------------------------------------------


class GpuInfo(ApiModel):
    name: str


class TrackerInfo(ApiModel):
    id: str
    name: str
    supports_gpu: bool


class SystemInfo(ApiModel):
    version: str
    engine_version: str
    platform: str
    cpu_count: int
    gpu: GpuInfo | None
    trackers: list[TrackerInfo]


class HealthResponse(ApiModel):
    status: str
    version: str


# ---- library --------------------------------------------------------------------------------


class VideoSummary(ApiModel):
    id: str
    path: str
    file_name: str
    size_bytes: int
    duration_s: float
    width: int
    height: int
    recorded_at: str | None
    status: VideoStatus
    unresolved_flags: int
    file_changed: bool
    has_analysis: bool


class FolderInfo(ApiModel):
    path: str
    name: str
    video_count: int


class Library(ApiModel):
    folder: FolderInfo
    videos: list[VideoSummary]


class OpenLibraryRequest(ApiModel):
    path: str


class FrameTimesResponse(ApiModel):
    t: list[float]


# ---- sessions -------------------------------------------------------------------------------


class TrackSummary(ApiModel):
    tracked_at: UtcDateTime
    frame_count: int
    tracker: str


class DocumentView(ApiModel):
    """`AnalysisDocument` without the (large, per-frame) track arrays."""

    schema_version: int
    app_version: str
    created_at: UtcDateTime
    updated_at: UtcDateTime
    video: VideoInfo
    setup: Setup
    track_summary: TrackSummary | None
    flags: list[Flag]
    corrections: list[Correction]
    setup_changes: list[SetupChange]
    exported_at: UtcDateTime | None
    results: Results | None


def build_document_view(document: AnalysisDocument) -> DocumentView:
    track_summary = None
    if document.track is not None:
        track_summary = TrackSummary(
            tracked_at=document.track.tracked_at,
            frame_count=document.track.frame_count,
            tracker=document.track.tracker,
        )
    return DocumentView(
        schema_version=document.schema_version,
        app_version=document.app_version,
        created_at=document.created_at,
        updated_at=document.updated_at,
        video=document.video,
        setup=document.setup,
        track_summary=track_summary,
        flags=document.flags,
        corrections=document.corrections,
        setup_changes=document.setup_changes,
        exported_at=document.exported_at,
        results=document.results,
    )


class SessionState(ApiModel):
    video: VideoSummary
    document: DocumentView
    dirty: bool
    saved_at: UtcDateTime | None
    loaded_from_disk: bool
    file_changed: bool
    active_job: Job | None


class FlagView(ApiModel):
    id: str
    reason: str
    frame_start: int
    frame_end: int
    t_start_s: float
    t_end_s: float
    detail: str
    metric: float
    status: FlagStatus


def build_flag_view(flag: Flag, status: FlagStatus) -> FlagView:
    return FlagView(
        id=flag.id,
        reason=flag.reason,
        frame_start=flag.frame_start,
        frame_end=flag.frame_end,
        t_start_s=flag.t_start_s,
        t_end_s=flag.t_end_s,
        detail=flag.detail,
        metric=flag.metric,
        status=status,
    )


class ApplyTemplateToSessionRequest(ApiModel):
    template_id: str


# ---- detection preview ------------------------------------------------------------------------


class DetectionPreviewRequest(ApiModel):
    frame_index: int
    setup: Setup


class ObservationView(ApiModel):
    x: float
    y: float
    semi_major: float
    semi_minor: float
    angle_deg: float
    area_px: float


class DetectionPreviewResponse(ApiModel):
    mask_png: str
    observation: ObservationView | None
    scale: float


# ---- batches --------------------------------------------------------------------------------


class BatchCheckRequest(ApiModel):
    template_id: str
    video_ids: list[str]


class BatchCheckItem(ApiModel):
    video_id: str
    file_name: str
    duration_s: float
    width: int
    height: int
    scale_x: float
    scale_y: float
    suggested_trial: tuple[float, float] | None
    warnings: list[str]


class BatchItemRequest(ApiModel):
    video_id: str
    trial: tuple[float, float] | None = None
    offset_x: float = 0.0
    offset_y: float = 0.0


class BatchCreateRequest(ApiModel):
    template_id: str
    items: list[BatchItemRequest]


class Batch(ApiModel):
    id: str
    jobs: list[Job]


class BatchItemView(ApiModel):
    """One video's current status within a saved batch — combines the persisted record (path,
    trial, offset) with live status derived from its sidecar plus any running job."""

    video_id: str
    video_path: str
    file_name: str
    trial: tuple[float, float] | None
    offset_x: float
    offset_y: float
    status: VideoStatus
    unresolved_flags: int
    job: Job | None


class BatchView(ApiModel):
    id: str
    created_at: UtcDateTime
    template_id: str
    template_name: str
    folder: str
    items: list[BatchItemView]


class BrokenBatchView(ApiModel):
    """A saved batch file that couldn't be parsed — the UI offers to reset (delete) it."""

    id: str
    error: str


class BatchListResponse(ApiModel):
    batches: list[BatchView]
    broken: list[BrokenBatchView]


def build_batch_item_view(item: BatchItemSummary) -> BatchItemView:
    return BatchItemView(
        video_id=item.video_id,
        video_path=item.video_path,
        file_name=item.file_name,
        trial=item.trial,
        offset_x=item.offset_x,
        offset_y=item.offset_y,
        status=item.status,
        unresolved_flags=item.unresolved_flags,
        job=item.job,
    )


def build_batch_view(summary: BatchSummary) -> BatchView:
    return BatchView(
        id=summary.id,
        created_at=summary.created_at,
        template_id=summary.template_id,
        template_name=summary.template_name,
        folder=summary.folder,
        items=[build_batch_item_view(item) for item in summary.items],
    )


def build_broken_batch_view(broken: BrokenBatch) -> BrokenBatchView:
    return BrokenBatchView(id=broken.id, error=broken.error)


# ---- templates ------------------------------------------------------------------------------


class TemplateCreateRequest(ApiModel):
    name: str
    video_id: str


class ApplyTemplateRequest(ApiModel):
    video_ids: list[str]


# ---- export ---------------------------------------------------------------------------------


class ExportRequest(ApiModel):
    video_ids: list[str]
    format: Literal["xlsx", "csv"]
    path: str
    layout: ExportLayout = ExportLayout.WIDE


class ExportResponse(ApiModel):
    files: list[str]


# ---- WebSocket event messages -----------------------------------------------------------------


class JobEvent(ApiModel):
    type: Literal["job"] = "job"
    job: Job


class SessionEvent(ApiModel):
    type: Literal["session"] = "session"
    video_id: str
    state: SessionState
