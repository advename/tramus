"""tracking/flags.py: the configurable unusual-size rule (§5.2)."""

from __future__ import annotations

from tests.core.conftest import make_track
from tramus_engine.domain import FlagReason, Track, UnusualSizeRule
from tramus_engine.tracking.flags import detect_flags


def _track(areas: list[float], t: list[float] | None = None) -> Track:
    track = make_track(n=len(areas))
    update: dict = {"area_px": areas}
    if t is not None:
        update["t"] = t
    return track.model_copy(update=update)


def _size_flags(track: Track, rule: UnusualSizeRule):
    return [f for f in detect_flags(track, rule) if f.reason == FlagReason.UNUSUAL_SIZE]


def _areas() -> list[float]:
    # median 10: frames 5-6 are 0.3x, frame 20 is 3x, frames 30-31 are 0.5x
    areas = [10.0] * 40
    areas[5] = areas[6] = 3.0
    areas[20] = 30.0
    areas[30] = areas[31] = 5.0
    return areas


def test_defaults_flag_below_0_4_and_above_2_5_of_the_median() -> None:
    flags = _size_flags(_track(_areas()), UnusualSizeRule())
    assert [(f.id, f.frame_start, f.frame_end) for f in flags] == [
        ("unusual_size-5", 5, 6),
        ("unusual_size-20", 20, 20),
    ]
    assert flags[0].detail == "0.3× typical body size"
    assert flags[1].metric == 3.0


def test_thresholds_change_which_frames_are_flagged() -> None:
    track = _track(_areas())
    assert [f.frame_start for f in _size_flags(track, UnusualSizeRule(smaller_than=0.2))] == [20]
    wide = UnusualSizeRule(smaller_than=0.6, larger_than=4.0)
    assert [f.frame_start for f in _size_flags(track, wide)] == [5, 30]


def test_disabled_rule_gives_no_unusual_size_flags() -> None:
    assert _size_flags(_track(_areas()), UnusualSizeRule(enabled=False)) == []


def test_min_duration_drops_short_runs_using_frame_timestamps() -> None:
    # Variable frame rate: frames 5-6 span 0.2 s, the single frame 20 spans 0.04 s.
    t = [i * 0.04 for i in range(40)]
    for i in range(7, 40):
        t[i] += 0.12
    track = _track(_areas(), t)
    rule = UnusualSizeRule(min_duration_s=0.1)
    assert [f.frame_start for f in _size_flags(track, rule)] == [5]
    assert [f.frame_start for f in _size_flags(track, UnusualSizeRule())] == [5, 20]
