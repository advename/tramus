"""Helpers for building small in-memory `Track`/`AnalysisDocument` fixtures for analysis tests,
so those tests don't need to decode a video."""

from __future__ import annotations

from datetime import UTC, datetime

from tramus_engine.domain import (
    AnalysisDocument,
    FrameStatus,
    Setup,
    Track,
    VideoInfo,
    utc_now,
)


def make_track(
    *,
    n: int,
    dt: float = 0.1,
    x: list[float | None] | None = None,
    y: list[float | None] | None = None,
    semi_major: float = 2.0,
    semi_minor: float = 1.0,
    status: list[FrameStatus] | None = None,
) -> Track:
    """A track with `n` frames, `dt` seconds apart, defaulting to a stationary detected mouse."""
    t = [round(i * dt, 6) for i in range(n)]
    default_status = status or [FrameStatus.DETECTED] * n
    xs = x if x is not None else [5.0] * n
    ys = y if y is not None else [5.0] * n
    visible = {FrameStatus.DETECTED, FrameStatus.INTERPOLATED, FrameStatus.MANUAL}

    def masked(values: list[float]) -> list[float | None]:
        return [v if s in visible else None for v, s in zip(values, default_status, strict=True)]

    return Track(
        tracker="test",
        tracker_version="0.0.0",
        tracked_at=utc_now(),
        t=t,
        x=masked(xs),
        y=masked(ys),
        semi_major=masked([semi_major] * n),
        semi_minor=masked([semi_minor] * n),
        angle_deg=masked([0.0] * n),
        area_px=masked([10.0] * n),
        status=default_status,
    )


def make_document(
    *,
    track: Track | None,
    setup: Setup | None = None,
    width: int = 100,
    height: int = 100,
    duration_s: float = 10.0,
    recorded_at: datetime | None = None,
    **kwargs: object,
) -> AnalysisDocument:
    video = VideoInfo(
        file_name="v.mp4",
        fingerprint="sha256:0" * 8,
        size_bytes=1,
        width=width,
        height=height,
        codec="h264",
        frame_count=track.frame_count if track is not None else 0,
        duration_s=duration_s,
        nominal_fps=10.0,
        recorded_at=recorded_at or datetime(2026, 1, 1, tzinfo=UTC),
        recorded_at_source="container_metadata",
    )
    return AnalysisDocument(
        app_version="0.0.0",
        created_at=utc_now(),
        updated_at=utc_now(),
        video=video,
        setup=setup or Setup(),
        track=track,
        **kwargs,
    )
