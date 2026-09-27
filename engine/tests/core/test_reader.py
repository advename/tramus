"""video/reader.py: frame-accurate, thread-safe random access."""

from __future__ import annotations

import numpy as np
import pytest

from tests.conftest import SyntheticVideo
from tramus_engine.video import FrameReader


def test_frame_times_strictly_increasing_and_count_matches(synthetic_video: SyntheticVideo) -> None:
    with FrameReader(synthetic_video.path) as reader:
        assert reader.frame_count == synthetic_video.frame_count
        assert np.all(np.diff(reader.frame_times) > 0)
        assert len(reader.frame_times) == reader.frame_count


def test_random_and_sequential_reads_are_pixel_identical(synthetic_video: SyntheticVideo) -> None:
    with FrameReader(synthetic_video.path) as reader:
        # Sequential warm-up so the decoder's internal position is somewhere in the middle.
        for i in range(10):
            reader.read(i)

        random_frame = reader.read(70)

        with FrameReader(synthetic_video.path) as sequential_reader:
            sequential_frame = None
            for index, frame in sequential_reader.iter_frames(0, 71, gray=False):
                if index == 70:
                    sequential_frame = frame
        assert sequential_frame is not None
        assert np.array_equal(random_frame, sequential_frame)


def test_backward_seek_matches_original_frame(synthetic_video: SyntheticVideo) -> None:
    with FrameReader(synthetic_video.path) as reader:
        first_pass = reader.read(80, gray=True)
        reader.read(85, gray=True)  # move forward
        second_pass = reader.read(80, gray=True)  # jump backward
        assert np.array_equal(first_pass, second_pass)


def test_gray_and_color_reads_have_expected_shapes(synthetic_video: SyntheticVideo) -> None:
    with FrameReader(synthetic_video.path) as reader:
        gray = reader.read(0, gray=True)
        color = reader.read(0, gray=False)
        assert gray.shape == (synthetic_video.height, synthetic_video.width)
        assert color.shape == (synthetic_video.height, synthetic_video.width, 3)


def test_index_at_time_finds_nearest_frame(synthetic_video: SyntheticVideo) -> None:
    with FrameReader(synthetic_video.path) as reader:
        for target in (0, 10, 50, synthetic_video.frame_count - 1):
            t = reader.frame_times[target]
            assert reader.index_at_time(float(t)) == target
        assert reader.index_at_time(-10.0) == 0
        assert reader.index_at_time(1e9) == reader.frame_count - 1


def test_out_of_range_index_raises(synthetic_video: SyntheticVideo) -> None:
    with FrameReader(synthetic_video.path) as reader:
        with pytest.raises(IndexError):
            reader.read(-1)
        with pytest.raises(IndexError):
            reader.read(reader.frame_count)


def test_iter_frames_covers_requested_range(synthetic_video: SyntheticVideo) -> None:
    with FrameReader(synthetic_video.path) as reader:
        indices = [index for index, _frame in reader.iter_frames(5, 15)]
        assert indices == list(range(5, 15))
