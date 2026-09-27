"""Frame images (`GET /videos/{id}/frames/{index}`), thumbnails, frame times, and the
detection-preview endpoint used by the Setup screen.

A thin HTTP adapter over `services.frames.FrameService`, which owns the reader/thumbnail caches.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Response, status

from ...services.container import Services
from ..deps import get_video_path, get_video_summary
from ..schemas import (
    DetectionPreviewRequest,
    DetectionPreviewResponse,
    FrameTimesResponse,
    ObservationView,
    VideoSummary,
)


def build_router(services: Services) -> APIRouter:
    router = APIRouter(tags=["videos"])

    @router.get("/videos/{video_id}", response_model=VideoSummary, operation_id="get_video")
    def get_video(video_id: str) -> VideoSummary:
        return get_video_summary(services, video_id)

    @router.get(
        "/videos/{video_id}/frame-times",
        response_model=FrameTimesResponse,
        operation_id="get_frame_times",
    )
    def get_frame_times(video_id: str) -> FrameTimesResponse:
        get_video_path(services, video_id)
        return FrameTimesResponse(t=services.frames.frame_times(video_id).tolist())

    @router.get(
        "/videos/{video_id}/frames/{index}",
        operation_id="get_frame",
        responses={200: {"content": {"image/jpeg": {}}}},
    )
    def get_frame(
        video_id: str,
        index: int,
        max_side: int | None = Query(default=None, gt=0),
        brightness: int = Query(default=0, ge=-100, le=100),
        contrast: int = Query(default=0, ge=-100, le=100),
        quality: int = Query(default=82, ge=1, le=100),
    ) -> Response:
        get_video_path(services, video_id)
        try:
            jpeg = services.frames.frame_jpeg(
                video_id,
                index,
                max_side=max_side,
                brightness=brightness,
                contrast=contrast,
                quality=quality,
            )
        except IndexError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return Response(content=jpeg, media_type="image/jpeg")

    @router.get(
        "/videos/{video_id}/thumbnail",
        operation_id="get_thumbnail",
        responses={200: {"content": {"image/jpeg": {}}}},
    )
    def get_thumbnail(
        video_id: str,
        max_side: int = Query(default=320, gt=0),
        t: float = Query(default=0.0, ge=0),
    ) -> Response:
        get_video_path(services, video_id)
        jpeg = services.frames.thumbnail_jpeg(video_id, max_side=max_side, t=t)
        return Response(content=jpeg, media_type="image/jpeg")

    @router.post(
        "/videos/{video_id}/detection-preview",
        response_model=DetectionPreviewResponse,
        operation_id="preview_detection",
    )
    def preview_detection(video_id: str, body: DetectionPreviewRequest) -> DetectionPreviewResponse:
        get_video_path(services, video_id)
        try:
            preview = services.frames.detection_preview(video_id, body.frame_index, body.setup)
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        observation = (
            ObservationView(
                x=preview.observation.x,
                y=preview.observation.y,
                semi_major=preview.observation.semi_major,
                semi_minor=preview.observation.semi_minor,
                angle_deg=preview.observation.angle_deg,
                area_px=preview.observation.area_px,
            )
            if preview.observation
            else None
        )
        return DetectionPreviewResponse(
            mask_png=preview.mask_png, observation=observation, scale=preview.scale
        )

    return router
