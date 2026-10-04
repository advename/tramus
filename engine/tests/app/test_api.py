"""API integration tests: auth, library, frames, the full session/tracking workflow, batches."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.conftest import SyntheticVideo
from tramus_engine import __version__
from tramus_engine.domain import (
    BatchItemRecord,
    BatchRecord,
    JobState,
    ProcessingDevice,
    RectShape,
    Template,
    VideoStatus,
    utc_now,
)
from tramus_engine.services import batch as batch_service
from tramus_engine.services.container import Services, create_services
from tramus_engine.services.system import app_version
from tramus_engine.services.templates import setup_from_template
from tramus_engine.storage.paths import batches_dir

from .conftest import AUTH_HEADERS

_TERMINAL_JOB_STATES = ("succeeded", "failed", "cancelled")


def _wait_for_job(client: TestClient, job_id: str, *, timeout_s: float = 60.0) -> dict:
    deadline = time.monotonic() + timeout_s
    job: dict = {}
    while time.monotonic() < deadline:
        resp = client.get(f"/api/jobs/{job_id}", headers=AUTH_HEADERS)
        assert resp.status_code == 200
        job = resp.json()
        if job["state"] in _TERMINAL_JOB_STATES:
            return job
        time.sleep(0.25)
    return job


def test_health_requires_token(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Invalid or missing token."}

    resp = client.get("/api/health", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"

    # The token also works as a query parameter (for <img src> and the WebSocket URL).
    resp = client.get("/api/health", params={"token": AUTH_HEADERS["X-Tramus-Token"]})
    assert resp.status_code == 200


def test_system_info(client: TestClient) -> None:
    resp = client.get("/api/system", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["cpu_count"] >= 1
    assert isinstance(body["trackers"], list)
    assert body["version"] == body["engine_version"] == __version__


def test_app_version_comes_from_the_desktop_app(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("TRAMUS_APP_VERSION", "1.2.3 (build 45)")
    assert app_version() == "1.2.3 (build 45)"
    body = client.get("/api/system", headers=AUTH_HEADERS).json()
    assert body["version"] == "1.2.3 (build 45)"
    assert body["engine_version"] == __version__

    monkeypatch.setenv("TRAMUS_APP_VERSION", "")
    assert app_version() == __version__


def test_settings_round_trip(client: TestClient) -> None:
    resp = client.get("/api/settings", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    settings = resp.json()

    settings["parallel_jobs"] = 3
    resp = client.put("/api/settings", headers=AUTH_HEADERS, json=settings)
    assert resp.status_code == 200
    assert resp.json()["parallel_jobs"] == 3

    resp = client.get("/api/settings", headers=AUTH_HEADERS)
    assert resp.json()["parallel_jobs"] == 3


def test_library_open_lists_synthetic_video(
    client: TestClient, synthetic_video: SyntheticVideo
) -> None:
    resp = client.post(
        "/api/library/open", headers=AUTH_HEADERS, json={"path": str(synthetic_video.path.parent)}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["folder"]["video_count"] >= 1
    video = next(v for v in body["videos"] if v["file_name"] == synthetic_video.path.name)
    assert video["status"] == "new"
    assert video["width"] == synthetic_video.width
    assert video["height"] == synthetic_video.height
    assert video["has_analysis"] is False

    # Recorded in recent folders.
    resp = client.get("/api/library/recent", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    recent_paths = [f["path"] for f in resp.json()]
    assert str(synthetic_video.path.parent.resolve()) in recent_paths


def test_library_open_unknown_folder_is_400(client: TestClient, tmp_path) -> None:
    resp = client.post(
        "/api/library/open", headers=AUTH_HEADERS, json={"path": str(tmp_path / "not-a-folder")}
    )
    assert resp.status_code == 400


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX permission bits only")
def test_library_open_permission_denied_is_403(client: TestClient, tmp_path: Path) -> None:
    """Mirrors macOS's folder-access denial (protected folder + "Don't Allow"): the OS refuses
    to list the directory, which the app must show as a dedicated access-help state, not a
    generic error."""
    folder = tmp_path / "locked"
    folder.mkdir()
    (folder / "video.mp4").touch()
    os.chmod(folder, 0o000)
    try:
        resp = client.post("/api/library/open", headers=AUTH_HEADERS, json={"path": str(folder)})
        assert resp.status_code == 403
        assert resp.json()["detail"]
    finally:
        os.chmod(folder, 0o755)


def test_get_video_unknown_id_is_404(client: TestClient) -> None:
    resp = client.get("/api/videos/deadbeefdeadbeef", headers=AUTH_HEADERS)
    assert resp.status_code == 404


def test_frame_and_thumbnail(client: TestClient, video_id: str) -> None:
    resp = client.get(f"/api/videos/{video_id}/frames/0", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"
    assert resp.content[:2] == b"\xff\xd8"  # JPEG magic bytes

    resp = client.get(
        f"/api/videos/{video_id}/thumbnail", headers=AUTH_HEADERS, params={"max_side": 100}
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/jpeg"

    # Cached: a second request for the same key returns the same bytes.
    resp2 = client.get(
        f"/api/videos/{video_id}/thumbnail", headers=AUTH_HEADERS, params={"max_side": 100}
    )
    assert resp2.content == resp.content


def test_frame_times(client: TestClient, video_id: str) -> None:
    resp = client.get(f"/api/videos/{video_id}/frame-times", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    times = resp.json()["t"]
    assert len(times) > 0
    assert times[0] == 0.0


def test_session_workflow_track_review_save_and_coalescing(
    client: TestClient, video_id: str, synthetic_video: SyntheticVideo
) -> None:
    # Open a session for a video that's never been analysed.
    resp = client.post(f"/api/videos/{video_id}/session", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    state = resp.json()
    assert state["loaded_from_disk"] is False
    assert state["dirty"] is False
    assert state["document"]["track_summary"] is None

    # Set up an arena and two zones.
    width, height = synthetic_video.width, synthetic_video.height
    setup = {
        "arena": {"kind": "rect", "x": 0, "y": 0, "width": width, "height": height},
        "zones": [
            {
                "id": "zoneA",
                "name": "Zone A",
                "color_index": 0,
                "shape": {"kind": "rect", "x": 0, "y": 0, "width": width / 2, "height": height},
            },
            {
                "id": "zoneB",
                "name": "Zone B",
                "color_index": 1,
                "shape": {
                    "kind": "rect",
                    "x": width / 2,
                    "y": 0,
                    "width": width / 2,
                    "height": height,
                },
            },
        ],
        "image": {"brightness": 0, "contrast": 0},
        "detection": {
            "tracker": "background_subtraction",
            "sensitivity": 60,
            "polarity": "darker",
            "min_mouse_area_px": 50,
        },
        "analysis": {"in_zone_threshold": 0.5},
        "trial": None,
        "template": None,
    }
    resp = client.put(f"/api/videos/{video_id}/session/setup", headers=AUTH_HEADERS, json=setup)
    assert resp.status_code == 200
    state = resp.json()
    assert state["dirty"] is True
    assert len(state["document"]["setup"]["zones"]) == 2
    assert state["document"]["setup_changes"] == []  # no track yet: nothing to log

    # Start tracking.
    resp = client.post(f"/api/videos/{video_id}/session/track", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    job = resp.json()
    job_id = job["id"]

    # A second concurrent tracking request is a conflict.
    resp = client.post(f"/api/videos/{video_id}/session/track", headers=AUTH_HEADERS)
    assert resp.status_code == 409

    # Poll until done.
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        resp = client.get(f"/api/jobs/{job_id}", headers=AUTH_HEADERS)
        assert resp.status_code == 200
        job = resp.json()
        if job["state"] in ("succeeded", "failed", "cancelled"):
            break
        time.sleep(0.25)
    assert job["state"] == "succeeded", job

    # Flags, track, results, history are all available.
    resp = client.get(f"/api/videos/{video_id}/session/flags", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

    resp = client.get(f"/api/videos/{video_id}/session/track", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    track = resp.json()
    assert len(track["t"]) == synthetic_video.frame_count

    resp = client.get(f"/api/videos/{video_id}/session/results", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    results = resp.json()
    assert results is not None
    assert {row["name"] for row in results["summary"]} >= {"Zone A", "Zone B"}

    resp = client.get(f"/api/videos/{video_id}/session/history", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    history = resp.json()
    assert any(entry["kind"] == "tracked" for entry in history)

    # Coalescing: three quick edits to the same zone collapse into one setup-change entry.
    for dx in (1.0, 2.0, 3.0):
        setup["zones"][0]["shape"]["x"] = dx
        resp = client.put(f"/api/videos/{video_id}/session/setup", headers=AUTH_HEADERS, json=setup)
        assert resp.status_code == 200
    state = resp.json()
    zone_a_changes = [c for c in state["document"]["setup_changes"] if "Zone A" in c["title"]]
    assert len(zone_a_changes) == 1

    # Save.
    resp = client.post(f"/api/videos/{video_id}/session/save", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    state = resp.json()
    assert state["dirty"] is False
    assert state["saved_at"] is not None

    sidecar = synthetic_video.path.with_name(synthetic_video.path.name + ".tramus.json")
    assert sidecar.exists()

    # A fresh session (as if the video were reopened) loads it from disk.
    services: Services = client.app.state.services
    services.sessions.close(video_id)
    resp = client.post(f"/api/videos/{video_id}/session", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    state = resp.json()
    assert state["loaded_from_disk"] is True
    assert state["document"]["track_summary"] is not None
    assert state["document"]["track_summary"]["frame_count"] == synthetic_video.frame_count


def test_batch_check_warnings(
    client: TestClient, services: Services, video_id: str, synthetic_video: SyntheticVideo
) -> None:
    now = utc_now()
    template = Template(
        id="tpl-warn",
        name="Different size, longer trial",
        created_at=now,
        updated_at=now,
        created_by="tester",
        reference_width=synthetic_video.width * 2,
        reference_height=synthetic_video.height * 2,
        trial_duration_s=synthetic_video.frame_count / synthetic_video.fps + 100.0,
    )
    services.templates.save(template)

    resp = client.post(
        "/api/batches/check",
        headers=AUTH_HEADERS,
        json={"template_id": "tpl-warn", "video_ids": [video_id]},
    )
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    item = items[0]
    assert len(item["warnings"]) == 2
    assert "Different resolution" in item["warnings"][0]
    assert "shorter than the" in item["warnings"][1]
    assert item["scale_x"] == 0.5
    assert item["scale_y"] == 0.5


def test_batch_check_unknown_template_is_404(client: TestClient, video_id: str) -> None:
    resp = client.post(
        "/api/batches/check",
        headers=AUTH_HEADERS,
        json={"template_id": "nope", "video_ids": [video_id]},
    )
    assert resp.status_code == 404


def _save_template_for_batch(
    services: Services, template_id: str, synthetic_video: SyntheticVideo
) -> Template:
    """An arena is required — an empty setup (`Setup.is_empty`) keeps `video_status` at "new"
    forever, even once a track exists, so a batch template needs one for status to progress."""
    now = utc_now()
    template = Template(
        id=template_id,
        name=f"Batch template {template_id}",
        created_at=now,
        updated_at=now,
        created_by="tester",
        reference_width=synthetic_video.width,
        reference_height=synthetic_video.height,
        arena=RectShape(x=0, y=0, width=synthetic_video.width, height=synthetic_video.height),
    )
    services.templates.save(template)
    return template


def test_create_batch_persists_record(
    client: TestClient, services: Services, video_id: str, synthetic_video: SyntheticVideo
) -> None:
    _save_template_for_batch(services, "tpl-persist", synthetic_video)

    resp = client.post(
        "/api/batches",
        headers=AUTH_HEADERS,
        json={
            "template_id": "tpl-persist",
            "items": [
                {"video_id": video_id, "trial": [0.0, 2.0], "offset_x": 3.0, "offset_y": -1.0}
            ],
        },
    )
    assert resp.status_code == 200
    batch = resp.json()
    batch_id = batch["id"]
    assert len(batch["jobs"]) == 1
    # A job reports its size from the moment it is queued, before any progress arrives.
    assert batch["jobs"][0]["frames_total"] == synthetic_video.frame_count

    # Listed, newest first, item summary built from the record.
    resp = client.get("/api/batches", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["broken"] == []
    assert body["batches"][0]["id"] == batch_id
    assert body["batches"][0]["template_name"] == "Batch template tpl-persist"
    item = body["batches"][0]["items"][0]
    assert item["video_id"] == video_id
    assert item["file_name"] == synthetic_video.path.name
    assert item["trial"] == [0.0, 2.0]
    assert item["offset_x"] == 3.0
    assert item["offset_y"] == -1.0
    # Status before the job finishes is either "new" (no sidecar yet) or already past that if
    # tracking raced ahead of this request — either is fine, it's asserted properly below.
    assert item["status"] in ("new", "tracked", "reviewed")

    # Fetched individually too.
    resp = client.get(f"/api/batches/{batch_id}", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    assert resp.json()["folder"] == str(synthetic_video.path.parent)

    job = _wait_for_job(client, batch["jobs"][0]["id"])
    assert job["state"] == "succeeded", job

    resp = client.get(f"/api/batches/{batch_id}", headers=AUTH_HEADERS)
    item = resp.json()["items"][0]
    assert item["status"] in ("tracked", "reviewed")
    assert item["job"] is None  # terminal jobs aren't reported as "running"


def test_get_batch_unknown_id_is_404(client: TestClient) -> None:
    resp = client.get("/api/batches/unknown", headers=AUTH_HEADERS)
    assert resp.status_code == 404


def test_delete_batch_removes_record_but_keeps_sidecar(
    client: TestClient, services: Services, video_id: str, synthetic_video: SyntheticVideo
) -> None:
    _save_template_for_batch(services, "tpl-reset", synthetic_video)
    resp = client.post(
        "/api/batches",
        headers=AUTH_HEADERS,
        json={"template_id": "tpl-reset", "items": [{"video_id": video_id}]},
    )
    batch_id = resp.json()["id"]
    job = _wait_for_job(client, resp.json()["jobs"][0]["id"])
    assert job["state"] == "succeeded", job

    sidecar = synthetic_video.path.with_name(synthetic_video.path.name + ".tramus.json")
    assert sidecar.exists()

    resp = client.delete(f"/api/batches/{batch_id}", headers=AUTH_HEADERS)
    assert resp.status_code == 204
    assert sidecar.exists()  # reset never touches sidecars or videos

    assert client.get(f"/api/batches/{batch_id}", headers=AUTH_HEADERS).status_code == 404
    assert client.delete(f"/api/batches/{batch_id}", headers=AUTH_HEADERS).status_code == 404


def test_delete_unknown_batch_is_404(client: TestClient) -> None:
    resp = client.delete("/api/batches/unknown", headers=AUTH_HEADERS)
    assert resp.status_code == 404


def test_list_batches_reports_broken_file_without_breaking_the_list(
    client: TestClient, services: Services, video_id: str, synthetic_video: SyntheticVideo
) -> None:
    _save_template_for_batch(services, "tpl-broken", synthetic_video)
    client.post(
        "/api/batches",
        headers=AUTH_HEADERS,
        json={"template_id": "tpl-broken", "items": [{"video_id": video_id}]},
    )
    (batches_dir() / "not-json.json").write_text("{this is not valid json", encoding="utf-8")

    resp = client.get("/api/batches", headers=AUTH_HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["batches"]) == 1  # the good batch is still listed
    assert [b["id"] for b in body["broken"]] == ["not-json"]
    assert body["broken"][0]["error"]


def test_batch_summary_survives_restart_with_a_fresh_services_instance(
    config_dir: Path, synthetic_video: SyntheticVideo
) -> None:
    """No `TestClient`/app here on purpose: a fresh `Services()` is exactly what happens on an
    app restart — an empty in-memory library registry and no jobs, with everything about the
    batch's status coming back from disk (the saved record + the video's sidecar)."""
    services1 = create_services()
    try:
        video_id = services1.library.register(synthetic_video.path)
        template = _save_template_for_batch(services1, "tpl-restart", synthetic_video)
        video_info = services1.library.probe(synthetic_video.path)
        setup = setup_from_template(template, video_info.width, video_info.height)
        job = batch_service.submit_batch_job(
            job_manager=services1.jobs,
            sessions=services1.sessions,
            video_id=video_id,
            video_path=synthetic_video.path,
            video_info=video_info,
            setup=setup,
            requested_device=ProcessingDevice.CPU,
            batch_id="batch-restart",
            app_version=services1.app_version,
        )
        deadline = time.monotonic() + 60
        finished = services1.jobs.get(job.id)
        while time.monotonic() < deadline:
            finished = services1.jobs.get(job.id)
            if finished and finished.state in (
                JobState.SUCCEEDED,
                JobState.FAILED,
                JobState.CANCELLED,
            ):
                break
            time.sleep(0.1)
        assert finished is not None and finished.state == JobState.SUCCEEDED

        services1.batches.save(
            BatchRecord(
                id="batch-restart",
                created_at=utc_now(),
                template_id=template.id,
                template_name=template.name,
                folder=str(synthetic_video.path.parent),
                items=[
                    BatchItemRecord(
                        video_id=video_id,
                        video_path=str(synthetic_video.path),
                        file_name=synthetic_video.path.name,
                    )
                ],
            )
        )
    finally:
        services1.shutdown()

    services2 = create_services()
    try:
        assert services2.library.path_for(video_id) is None  # nothing registered yet

        records, broken = services2.batches.list_all()
        assert broken == []
        record = next(r for r in records if r.id == "batch-restart")

        summary = batch_service.summarize_batch(
            record, library=services2.library, jobs=services2.jobs
        )
        assert summary.items[0].job is None  # the job manager forgot everything on "restart"
        assert summary.items[0].status in (VideoStatus.TRACKED, VideoStatus.REVIEWED)
        assert services2.library.path_for(video_id) is not None  # now resolvable again
    finally:
        services2.shutdown()
