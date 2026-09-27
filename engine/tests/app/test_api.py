"""API integration tests: auth, library, frames, the full session/tracking workflow, batches."""

from __future__ import annotations

import time

from fastapi.testclient import TestClient

from tests.conftest import SyntheticVideo
from tramus_engine.domain import Template, utc_now
from tramus_engine.services.container import Services

from .conftest import AUTH_HEADERS


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
