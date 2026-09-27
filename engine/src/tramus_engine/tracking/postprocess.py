"""Fills short gaps in a raw track by linear interpolation (§5.1 step 8).

Runs of `missing` frames no longer than `MAX_GAP_SECONDS` between two detected frames are
filled in; longer runs are left `missing` (they become a `not_found` flag instead).
"""

from __future__ import annotations

from ..domain import FrameStatus, Track

MAX_GAP_SECONDS = 0.5


def fill_short_gaps(track: Track) -> Track:
    status = list(track.status)
    x, y = list(track.x), list(track.y)
    semi_major, semi_minor = list(track.semi_major), list(track.semi_minor)
    angle_deg, area_px = list(track.angle_deg), list(track.area_px)
    t = track.t
    n = len(status)

    i = 0
    while i < n:
        if status[i] != FrameStatus.MISSING:
            i += 1
            continue
        start = i
        while i < n and status[i] == FrameStatus.MISSING:
            i += 1
        end = i  # exclusive
        before, after = start - 1, end
        if before < 0 or after >= n:
            continue  # gap touches an edge of the track; nothing to interpolate from
        if t[after] - t[before] > MAX_GAP_SECONDS:
            continue

        x0, y0 = x[before], y[before]
        x1, y1 = x[after], y[after]
        span = t[after] - t[before]
        for frame in range(start, end):
            ratio = (t[frame] - t[before]) / span if span else 0.0
            x[frame] = round(x0 + (x1 - x0) * ratio, 2)
            y[frame] = round(y0 + (y1 - y0) * ratio, 2)
            nearer = before if (t[frame] - t[before]) <= (t[after] - t[frame]) else after
            semi_major[frame] = semi_major[nearer]
            semi_minor[frame] = semi_minor[nearer]
            angle_deg[frame] = angle_deg[nearer]
            area_px[frame] = area_px[nearer]
            status[frame] = FrameStatus.INTERPOLATED

    return track.model_copy(
        update={
            "x": x,
            "y": y,
            "semi_major": semi_major,
            "semi_minor": semi_minor,
            "angle_deg": angle_deg,
            "area_px": area_px,
            "status": status,
        }
    )
