"""Fixtures for the application layer (storage, export, services, API)."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.conftest import SyntheticVideo
from tramus_engine.api.app import create_app
from tramus_engine.domain import (
    AnalysisDocument,
    DetectionSettings,
    EllipseShape,
    FrameStatus,
    RectShape,
    Setup,
    Track,
    VideoInfo,
    Zone,
    new_id,
    utc_now,
)
from tramus_engine.services.container import Services, create_services

TEST_TOKEN = "test-token"
AUTH_HEADERS = {"X-Tramus-Token": TEST_TOKEN}


def make_video_info(
    *,
    file_name: str = "mouse.mp4",
    width: int = 320,
    height: int = 240,
    duration_s: float = 4.0,
    frame_count: int = 100,
    fingerprint: str = "sha256:deadbeef",
    recorded_at: datetime | None = datetime(2026, 9, 25, 7, 5, 18, tzinfo=UTC),
) -> VideoInfo:
    return VideoInfo(
        file_name=file_name,
        fingerprint=fingerprint,
        size_bytes=1_000_000,
        width=width,
        height=height,
        codec="mpeg4",
        frame_count=frame_count,
        duration_s=duration_s,
        nominal_fps=25.0,
        recorded_at=recorded_at,
        recorded_at_source="container_metadata" if recorded_at else None,
    )


def make_track(frame_count: int = 10) -> Track:
    return Track(
        tracker="background_subtraction",
        tracker_version="1.0",
        parameters={"sensitivity": 60},
        tracked_at=utc_now(),
        t=[i * 0.04 for i in range(frame_count)],
        x=[10.0 + i for i in range(frame_count)],
        y=[20.0 + i for i in range(frame_count)],
        semi_major=[14.0] * frame_count,
        semi_minor=[7.0] * frame_count,
        angle_deg=[0.0] * frame_count,
        area_px=[300.0] * frame_count,
        status=[FrameStatus.DETECTED] * frame_count,
    )


def make_zone(name: str = "Center", color_index: int = 0) -> Zone:
    return Zone(
        id=new_id(),
        name=name,
        color_index=color_index,
        shape=EllipseShape(cx=160, cy=120, rx=50, ry=50),
    )


def make_setup(*, with_zones: bool = False) -> Setup:
    zones = [make_zone()] if with_zones else []
    return Setup(
        arena=RectShape(x=0, y=0, width=320, height=240),
        zones=zones,
        detection=DetectionSettings(),
    )


def make_document(
    *,
    video: VideoInfo | None = None,
    setup: Setup | None = None,
    track: Track | None = None,
) -> AnalysisDocument:
    now = utc_now()
    return AnalysisDocument(
        app_version="0.1.0",
        created_at=now,
        updated_at=now,
        video=video or make_video_info(),
        setup=setup if setup is not None else make_setup(),
        track=track,
    )


@pytest.fixture
def tmp_video_dir(tmp_path: Path) -> Path:
    folder = tmp_path / "videos"
    folder.mkdir()
    return folder


@pytest.fixture
def services(config_dir: Path) -> Iterator[Services]:
    """A fresh `Services` instance, backed by the isolated `config_dir`."""
    services = create_services()
    try:
        yield services
    finally:
        services.jobs.shutdown()


@pytest.fixture
def client(services: Services) -> Iterator[TestClient]:
    """A `TestClient` for the app built from `services`. Callers must pass `AUTH_HEADERS`."""
    app = create_app(services, TEST_TOKEN)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def video_id(client: TestClient, synthetic_video: SyntheticVideo) -> str:
    """Opens the library on the synthetic video's folder and returns its video id."""
    resp = client.post(
        "/api/library/open", headers=AUTH_HEADERS, json={"path": str(synthetic_video.path.parent)}
    )
    assert resp.status_code == 200, resp.text
    videos = resp.json()["videos"]
    match = next(v for v in videos if v["file_name"] == synthetic_video.path.name)
    return match["id"]
