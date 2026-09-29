"""analysis/crossings.py: rule-matched transitions and the from×to matrix.

Membership arrays are built by hand (not via `zone_fractions`/`zone_membership`) so each
scenario isolates exactly the crossing semantics described in architecture.md §4/§5, independent
of the hysteresis state machine.
"""

from __future__ import annotations

import numpy as np

from tramus_engine.analysis.crossings import compute_crossings
from tramus_engine.analysis.exclusions import analysed_intervals
from tramus_engine.domain import CrossingRule, Exclusion, Zone
from tramus_engine.domain.shapes import RectShape

_DT = 1.0


def _zone(zone_id: str, name: str | None = None) -> Zone:
    return Zone(
        id=zone_id,
        name=name or zone_id,
        color_index=0,
        shape=RectShape(x=0, y=0, width=1, height=1),
    )


def _col(n: int, ranges: list[tuple[int, int]]) -> np.ndarray:
    """A bool column, `True` for frames in the inclusive `ranges`."""
    column = np.zeros(n, dtype=bool)
    for start, end in ranges:
        column[start : end + 1] = True
    return column


def _run(
    zones: list[Zone],
    columns: dict[str, list[tuple[int, int]]],
    *,
    n: int,
    visible: np.ndarray | None = None,
    exclusions: list[Exclusion] | None = None,
    rules: list[CrossingRule] | None = None,
):
    membership = np.stack([_col(n, columns.get(zone.id, [])) for zone in zones], axis=1)
    t = np.arange(n, dtype=np.float64) * _DT
    frame_end_times = t + _DT
    vis = visible if visible is not None else np.ones(n, dtype=bool)
    intervals = analysed_intervals(0.0, n * _DT, exclusions or [])
    return compute_crossings(
        t=t,
        frame_end_times=frame_end_times,
        membership=membership,
        visible=vis,
        zones=zones,
        intervals=intervals,
        rules=rules or [],
        recorded_at=None,
    )


def test_chamber_sequence_left_center_right() -> None:
    left, center, right = _zone("l", "Left"), _zone("c", "Center"), _zone("r", "Right")
    rules = [
        CrossingRule(id="lc", from_zone_id="l", to_zone_id="c"),
        CrossingRule(id="cr", from_zone_id="c", to_zone_id="r"),
    ]
    results, matrix = _run(
        [left, center, right],
        {"l": [(0, 2)], "c": [(3, 5)], "r": [(6, 8)]},
        n=9,
        rules=rules,
    )
    by_id = {r.rule_id: r for r in results}
    assert by_id["lc"].count == 1
    assert by_id["lc"].events[0].frame == 3
    assert by_id["cr"].count == 1
    assert by_id["cr"].events[0].frame == 6
    # The first stay (Left, at frame 0) never appears as a "to" — it has no "from".
    total_events = sum(r.count for r in results)
    assert total_events == 2
    cell = {(c.from_zone_id, c.to_zone_id): c.count for c in matrix}
    assert cell[("l", "c")] == 1
    assert cell[("c", "r")] == 1
    assert cell[("l", "r")] == 0


def test_crossing_via_unzoned_floor_counts() -> None:
    left, right = _zone("l"), _zone("r")
    results, matrix = _run(
        [left, right],
        {"l": [(0, 2)], "r": [(6, 8)]},  # frames 3-5 are visible, unzoned floor
        n=9,
        rules=[CrossingRule(id="lr", from_zone_id="l", to_zone_id="r")],
    )
    assert results[0].count == 1
    assert results[0].events[0].from_zone_id == "l"
    assert results[0].events[0].to_zone_id == "r"
    cell = {(c.from_zone_id, c.to_zone_id): c.count for c in matrix}
    assert cell[("l", "r")] == 1


def test_crossing_through_not_visible_gap_counts() -> None:
    left, right = _zone("l"), _zone("r")
    visible = _col(9, [(0, 2), (6, 8)])  # frames 3-5 not visible
    results, _ = _run(
        [left, right],
        {"l": [(0, 2)], "r": [(6, 8)]},
        n=9,
        visible=visible,
        rules=[CrossingRule(id="lr", from_zone_id="l", to_zone_id="r")],
    )
    assert results[0].count == 1
    assert results[0].events[0].frame == 6


def test_same_zone_reentry_via_unzoned_floor_counts_as_crossing() -> None:
    x = _zone("x")
    results, matrix = _run(
        [x],
        {"x": [(0, 2), (6, 8)]},  # frames 3-5 visible, unzoned (no merge)
        n=9,
        rules=[CrossingRule(id="xx", from_zone_id="x", to_zone_id="x")],
    )
    assert results[0].count == 1
    assert results[0].events[0].frame == 6
    cell = {(c.from_zone_id, c.to_zone_id): c.count for c in matrix}
    assert cell[("x", "x")] == 1


def test_same_zone_across_not_visible_gap_merges_no_crossing() -> None:
    x = _zone("x")
    visible = _col(9, [(0, 2), (6, 8)])  # frames 3-5 not visible -> transparent merge
    results, matrix = _run(
        [x],
        {"x": [(0, 2), (6, 8)]},
        n=9,
        visible=visible,
        rules=[CrossingRule(id="xx", from_zone_id="x", to_zone_id="x")],
    )
    assert results[0].count == 0
    cell = {(c.from_zone_id, c.to_zone_id): c.count for c in matrix}
    assert cell[("x", "x")] == 0


def test_crossing_across_an_exclusion_is_not_counted() -> None:
    left, right = _zone("l"), _zone("r")
    exclusions = [Exclusion(id="e1", start_s=3.0, end_s=6.0)]
    results, matrix = _run(
        [left, right],
        {"l": [(0, 2)], "r": [(6, 8)]},
        n=9,
        exclusions=exclusions,
        rules=[CrossingRule(id="lr", from_zone_id="l", to_zone_id="r")],
    )
    # Right's stay is the first entry of the post-exclusion segment: no "from".
    assert results[0].count == 0
    assert sum(c.count for c in matrix) == 0


def test_any_zone_rules_match_either_side() -> None:
    left, center, right = _zone("l"), _zone("c"), _zone("r")
    rules = [
        CrossingRule(id="to_r", from_zone_id=None, to_zone_id="r"),
        CrossingRule(id="from_l", from_zone_id="l", to_zone_id=None),
    ]
    results, _ = _run(
        [left, center, right],
        {"l": [(0, 2)], "c": [(3, 5)], "r": [(6, 8)]},
        n=9,
        rules=rules,
    )
    by_id = {r.rule_id: r for r in results}
    assert by_id["to_r"].count == 1  # Center -> Right
    assert by_id["to_r"].events[0].from_zone_id == "c"
    assert by_id["from_l"].count == 1  # Left -> Center
    assert by_id["from_l"].events[0].to_zone_id == "c"


def test_nested_zone_still_occupied_is_never_a_from() -> None:
    # A covers the whole segment (never exits); B is nested inside A for frames 0-2; C is
    # entered at frame 4. C's "from" must be B (already exited), never A (still occupied).
    outer, inner, third = _zone("a"), _zone("b"), _zone("c")
    results, _ = _run(
        [outer, inner, third],
        {"a": [(0, 8)], "b": [(0, 2)], "c": [(4, 6)]},
        n=9,
        rules=[
            CrossingRule(id="to_c", from_zone_id=None, to_zone_id="c"),
        ],
    )
    assert results[0].count == 1
    assert results[0].events[0].from_zone_id == "b"


def test_tie_break_prefers_the_stay_that_started_later() -> None:
    # D and E both start at frame 0 and both end at frame 2 (a tie on exit time). F starts at
    # frame 4. The documented tie-break picks the stay that appears later among the zones.
    d, e, f = _zone("d"), _zone("e"), _zone("f")
    results, _ = _run(
        [d, e, f],
        {"d": [(0, 2)], "e": [(0, 2)], "f": [(4, 6)]},
        n=9,
        rules=[CrossingRule(id="to_f", from_zone_id=None, to_zone_id="f")],
    )
    assert results[0].count == 1
    assert results[0].events[0].from_zone_id == "e"


def test_matrix_totals_match_event_count_across_multiple_crossings() -> None:
    left, right = _zone("l"), _zone("r")
    # L -> R -> L -> R: three crossings.
    results, matrix = _run(
        [left, right],
        {"l": [(0, 1), (4, 5)], "r": [(2, 3), (6, 7)]},
        n=9,
        rules=[
            CrossingRule(id="lr", from_zone_id="l", to_zone_id="r"),
            CrossingRule(id="rl", from_zone_id="r", to_zone_id="l"),
        ],
    )
    assert sum(r.count for r in results) == 3
    assert sum(c.count for c in matrix) == 3
    cell = {(c.from_zone_id, c.to_zone_id): c.count for c in matrix}
    assert cell[("l", "r")] == 2
    assert cell[("r", "l")] == 1
    assert cell[("l", "l")] == 0
    assert cell[("r", "r")] == 0
    # The matrix always has every ordered pair, including the diagonal.
    assert {(c.from_zone_id, c.to_zone_id) for c in matrix} == {
        ("l", "l"),
        ("l", "r"),
        ("r", "l"),
        ("r", "r"),
    }
