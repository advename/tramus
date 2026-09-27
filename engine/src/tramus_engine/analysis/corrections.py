"""Applying the ordered correction log on top of the raw track (§5.3)."""

from __future__ import annotations

from collections.abc import Sequence

from ..domain import (
    VISIBLE_STATUSES,
    AcceptFlag,
    Correction,
    Flag,
    FlagStatus,
    FrameStatus,
    Interpolate,
    MarkHidden,
    SetPosition,
    Track,
)


def apply_corrections(raw: Track, corrections: Sequence[Correction]) -> Track:
    """Replay `corrections` in order on a copy of `raw`, producing the effective track."""
    t = raw.t
    n = raw.frame_count
    x, y = list(raw.x), list(raw.y)
    semi_major, semi_minor = list(raw.semi_major), list(raw.semi_minor)
    angle_deg, area_px = list(raw.angle_deg), list(raw.area_px)
    status = list(raw.status)

    def nearest_with_status(frame: int, wanted: FrameStatus) -> int | None:
        if status[frame] == wanted:
            return frame
        for offset in range(1, n):
            before, after = frame - offset, frame + offset
            if 0 <= before < n and status[before] == wanted:
                return before
            if 0 <= after < n and status[after] == wanted:
                return after
            if before < 0 and after >= n:
                return None
        return None

    def nearest_visible(frame: int, *, direction: int) -> int | None:
        i = frame
        while 0 <= i < n:
            if status[i] in VISIBLE_STATUSES:
                return i
            i += direction
        return None

    for correction in corrections:
        if isinstance(correction, SetPosition):
            frame = correction.frame
            source = nearest_with_status(frame, FrameStatus.DETECTED)
            x[frame] = correction.x
            y[frame] = correction.y
            if source is not None:
                semi_major[frame] = semi_major[source]
                semi_minor[frame] = semi_minor[source]
                angle_deg[frame] = angle_deg[source]
                area_px[frame] = area_px[source]
            status[frame] = FrameStatus.MANUAL

        elif isinstance(correction, MarkHidden):
            for frame in range(correction.frame_start, correction.frame_end + 1):
                x[frame] = y[frame] = None
                semi_major[frame] = semi_minor[frame] = None
                angle_deg[frame] = area_px[frame] = None
                status[frame] = FrameStatus.HIDDEN

        elif isinstance(correction, Interpolate):
            before = nearest_visible(correction.frame_start - 1, direction=-1)
            after = nearest_visible(correction.frame_end + 1, direction=1)
            if before is None and after is None:
                continue  # nothing visible anywhere in the track; leave frames as they are
            anchor_before = before if before is not None else after
            anchor_after = after if after is not None else before
            span = t[anchor_after] - t[anchor_before]
            for frame in range(correction.frame_start, correction.frame_end + 1):
                ratio = (t[frame] - t[anchor_before]) / span if span else 0.0
                x[frame] = x[anchor_before] + (x[anchor_after] - x[anchor_before]) * ratio
                y[frame] = y[anchor_before] + (y[anchor_after] - y[anchor_before]) * ratio
                nearer = (
                    anchor_before
                    if (t[frame] - t[anchor_before]) <= (t[anchor_after] - t[frame])
                    else anchor_after
                )
                semi_major[frame] = semi_major[nearer]
                semi_minor[frame] = semi_minor[nearer]
                angle_deg[frame] = angle_deg[nearer]
                area_px[frame] = area_px[nearer]
                status[frame] = FrameStatus.INTERPOLATED

        elif isinstance(correction, AcceptFlag):
            continue  # no track change; only affects the flag's status

    return raw.model_copy(
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


def flag_statuses(
    flags: Sequence[Flag], corrections: Sequence[Correction]
) -> dict[str, FlagStatus]:
    """`accepted` if an `accept_flag` correction targets it; else `fixed` if any other
    correction's frame range overlaps the flag's range; else `unresolved`."""
    accepted_ids = {c.flag_id for c in corrections if isinstance(c, AcceptFlag)}
    ranges: list[tuple[int, int]] = []
    for correction in corrections:
        if isinstance(correction, SetPosition):
            ranges.append((correction.frame, correction.frame))
        elif isinstance(correction, (MarkHidden, Interpolate)):
            ranges.append((correction.frame_start, correction.frame_end))

    statuses: dict[str, FlagStatus] = {}
    for flag in flags:
        if flag.id in accepted_ids:
            statuses[flag.id] = FlagStatus.ACCEPTED
        elif any(start <= flag.frame_end and end >= flag.frame_start for start, end in ranges):
            statuses[flag.id] = FlagStatus.FIXED
        else:
            statuses[flag.id] = FlagStatus.UNRESOLVED
    return statuses
