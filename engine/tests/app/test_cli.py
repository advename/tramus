"""CLI: `openapi` output and a `serve` subprocess smoke test."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest


def test_openapi_cli_contains_key_paths(tmp_path: Path, config_dir: Path) -> None:
    out = tmp_path / "openapi.json"
    result = subprocess.run(
        [sys.executable, "-m", "tramus_engine", "openapi", "--out", str(out)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    data = json.loads(out.read_text(encoding="utf-8"))

    expected_paths = [
        "/api/health",
        "/api/system",
        "/api/settings",
        "/api/library/open",
        "/api/library/recent",
        "/api/videos/{video_id}",
        "/api/videos/{video_id}/frames/{index}",
        "/api/videos/{video_id}/session",
        "/api/videos/{video_id}/session/setup",
        "/api/videos/{video_id}/session/track",
        "/api/jobs",
        "/api/jobs/{job_id}",
        "/api/batches/check",
        "/api/batches",
        "/api/templates",
        "/api/templates/{template_id}",
        "/api/templates/{template_id}/apply",
        "/api/export",
    ]
    for path in expected_paths:
        assert path in data["paths"], path

    # Sanity check the operation ids the frontend's client generator will key on.
    open_library_op = data["paths"]["/api/library/open"]["post"]["operationId"]
    assert open_library_op == "open_library"
    get_frame_op = data["paths"]["/api/videos/{video_id}/frames/{index}"]["get"]["operationId"]
    assert get_frame_op == "get_frame"


def test_openapi_cli_prints_to_stdout_without_out(config_dir: Path) -> None:
    result = subprocess.run(
        [sys.executable, "-m", "tramus_engine", "openapi"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    assert "/api/health" in data["paths"]


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_serve_smoke(config_dir: Path) -> None:
    env = {**os.environ, "TRAMUS_CONFIG_DIR": str(config_dir)}
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "tramus_engine",
            "serve",
            "--port",
            "0",
            "--token",
            "smoke-token",
            "--no-stdin-watch",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )
    try:
        line = proc.stdout.readline()
        assert line, proc.stderr.read()
        message = json.loads(line)
        assert message["event"] == "ready"
        port = message["port"]
        assert isinstance(port, int) and port > 0

        deadline = time.monotonic() + 10
        last_error: Exception | None = None
        while time.monotonic() < deadline:
            try:
                resp = httpx.get(
                    f"http://127.0.0.1:{port}/api/health",
                    headers={"X-Tramus-Token": "smoke-token"},
                    timeout=2,
                )
                assert resp.status_code == 200
                assert resp.json()["status"] == "ok"
                break
            except httpx.TransportError as exc:
                last_error = exc
                time.sleep(0.2)
        else:
            raise AssertionError(f"engine never became reachable: {last_error}")

        # No token: 401.
        resp = httpx.get(f"http://127.0.0.1:{port}/api/health", timeout=2)
        assert resp.status_code == 401
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_serve_exits_with_the_app(config_dir: Path) -> None:
    """The engine quits when the app goes: stdin EOF, or on Windows the `--parent-pid` exiting
    (it must not read stdin there — that hangs its tracking workers)."""
    env = {**os.environ, "TRAMUS_CONFIG_DIR": str(config_dir)}
    app = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])
    engine = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "tramus_engine",
            "serve",
            "--port",
            "0",
            "--token",
            "exit-token",
            "--parent-pid",
            str(app.pid),
        ],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        env=env,
    )
    try:
        assert json.loads(engine.stdout.readline())["event"] == "ready"
        if sys.platform == "win32":
            app.kill()
        else:
            engine.stdin.close()
        assert engine.wait(timeout=20) == 0
    finally:
        for proc in (engine, app):
            if proc.poll() is None:
                proc.kill()
                proc.wait()
