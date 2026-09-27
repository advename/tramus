"""video/probe.py and video/fingerprint.py."""

from __future__ import annotations

from datetime import UTC, datetime

from tests.conftest import SyntheticVideo
from tramus_engine.video import compute_fingerprint, probe_video, read_frame_times


def test_probe_video_reads_container_facts(synthetic_video: SyntheticVideo) -> None:
    info = probe_video(synthetic_video.path)
    assert info.file_name == synthetic_video.path.name
    assert info.width == synthetic_video.width
    assert info.height == synthetic_video.height
    assert info.frame_count == synthetic_video.frame_count
    assert info.size_bytes == synthetic_video.path.stat().st_size
    assert info.duration_s > 0
    assert 20 < info.nominal_fps < 30


def test_probe_video_parses_recorded_at(synthetic_video: SyntheticVideo) -> None:
    info = probe_video(synthetic_video.path)
    assert info.recorded_at_source == "container_metadata"
    assert info.recorded_at == datetime(2026, 9, 25, 7, 5, 18, tzinfo=UTC)


def test_fingerprint_is_stable_and_content_sensitive(
    synthetic_video: SyntheticVideo, tmp_path
) -> None:
    first = compute_fingerprint(synthetic_video.path)
    second = compute_fingerprint(synthetic_video.path)
    assert first == second
    assert first.startswith("sha256:")

    other = tmp_path / "copy.mp4"
    other.write_bytes(synthetic_video.path.read_bytes() + b"\x00")
    assert compute_fingerprint(other) != first


def test_read_frame_times_matches_probe(synthetic_video: SyntheticVideo) -> None:
    times = read_frame_times(synthetic_video.path)
    info = probe_video(synthetic_video.path)
    assert len(times) == info.frame_count
    assert times[0] == 0.0
