from datetime import UTC, datetime

import pytest

from core.liveplan import Unroutable, plan, segment_key, window_index
from core.routing import RoadEdge, RoadGraph

ARRIVE_BY = datetime(2026, 9, 17, 9, 30, tzinfo=UTC)
SEGMENTS = 4
# Four vehicles a quarter hour, so a background of sixty is comfortably over.
CAPACITY = {segment_key(i): 40 for i in range(1, SEGMENTS + 1)}


def route():
    graph = RoadGraph(
        [
            RoadEdge(i, i * 10, (i + 1) * 10, 1000.0, "primary")
            for i in range(1, SEGMENTS + 1)
        ]
    )
    found = graph.route(10, (SEGMENTS + 1) * 10)
    assert found is not None
    return found


def jam(segments: int, window: int) -> dict[tuple[str, int], int]:
    return {(segment_key(i), window): 60 for i in range(1, segments + 1)}


def usual_window() -> int:
    quiet = plan(route(), ARRIVE_BY, 30, CAPACITY, background={})
    return window_index(quiet.usual_depart_at)


def test_a_clear_road_leaves_the_traveller_alone() -> None:
    made = plan(route(), ARRIVE_BY, 30, CAPACITY, background={})

    assert made.shift_minutes == 0
    assert made.depart_at == made.usual_depart_at
    assert made.roads_over_at_usual == 0


def test_a_congested_usual_time_moves_the_traveller_earlier() -> None:
    made = plan(route(), ARRIVE_BY, 30, CAPACITY, background=jam(2, usual_window()))

    assert made.shift_minutes > 0
    assert made.depart_at < made.usual_depart_at
    assert made.roads_over_at_usual == 2
    assert made.roads_over_at_plan == 0


def test_nobody_is_ever_moved_later() -> None:
    """Arriving late is worse than arriving early, so the window is one-sided."""
    jammed = jam(SEGMENTS, usual_window())
    made = plan(route(), ARRIVE_BY, 45, CAPACITY, background=jammed)

    assert made.depart_at <= made.usual_depart_at


def test_a_traveller_with_no_slack_is_not_moved() -> None:
    made = plan(route(), ARRIVE_BY, 0, CAPACITY, background=jam(SEGMENTS, usual_window()))

    assert made.shift_minutes == 0


def test_the_plan_dodges_what_the_naive_answer_cannot_see() -> None:
    """The whole argument of the project, in the live path rather than the sweep."""
    background = jam(2, usual_window())
    quiet = window_index(
        plan(route(), ARRIVE_BY, 30, CAPACITY, background=background).depart_at
    )

    made = plan(
        route(),
        ARRIVE_BY,
        30,
        CAPACITY,
        background=background,
        committed=jam(SEGMENTS, quiet),
    )

    assert made.depart_at != made.naive_depart_at


def test_charges_cover_every_segment_of_the_path() -> None:
    made = plan(route(), ARRIVE_BY, 30, CAPACITY, background={})

    assert len(made.charges) == SEGMENTS
    assert [charge.segment_id for charge in made.charges] == list(range(1, SEGMENTS + 1))
    assert all(charge.window_start.minute in (0, 15, 30, 45) for charge in made.charges)


def test_road_counts_stay_inside_the_path() -> None:
    everywhere = {
        (segment_key(i), window): 999
        for i in range(1, SEGMENTS + 1)
        for window in range(usual_window() - 8, usual_window() + 4)
    }

    made = plan(route(), ARRIVE_BY, 30, CAPACITY, background=everywhere)

    assert 0 <= made.roads_over_at_plan <= SEGMENTS
    assert 0 <= made.roads_over_at_usual <= SEGMENTS


def test_a_journey_with_no_path_is_refused() -> None:
    graph = RoadGraph([RoadEdge(1, 10, 20, 100.0, "primary")])
    empty = graph.route(10, 10)
    assert empty is not None

    with pytest.raises(Unroutable):
        plan(empty, ARRIVE_BY, 30, CAPACITY, background={})
