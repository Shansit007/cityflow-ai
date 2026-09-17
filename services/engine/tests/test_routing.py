import pytest

from core.capacity import UnknownRoadClass
from core.routing import RoadEdge, RoadGraph


def edge(segment_id: int, source: int, target: int, length_m: float, klass: str):
    return RoadEdge(
        segment_id=segment_id,
        from_node=source,
        to_node=target,
        length_m=length_m,
        highway_class=klass,
    )


def test_quicker_route_wins_over_shorter_one() -> None:
    """A longer road at a higher class beats a short slow one, which is the point."""
    graph = RoadGraph(
        [
            edge(1, 10, 20, 1000.0, "residential"),
            edge(2, 20, 40, 1000.0, "residential"),
            edge(3, 10, 30, 1200.0, "primary"),
            edge(4, 30, 40, 1200.0, "primary"),
        ]
    )

    route = graph.route(10, 40)

    assert route is not None
    assert route.segment_ids == (3, 4)
    assert route.distance_m == 2400.0


def test_offsets_say_when_each_segment_is_reached() -> None:
    graph = RoadGraph(
        [edge(1, 1, 2, 1000.0, "primary"), edge(2, 2, 3, 1000.0, "primary")]
    )

    route = graph.route(1, 3)

    assert route is not None
    assert route.offsets_s[0] == 0
    assert route.offsets_s[1] == pytest.approx(route.duration_s / 2, abs=1)
    assert len(route.offsets_s) == len(route.segment_ids)


def test_segments_are_one_way() -> None:
    graph = RoadGraph([edge(9, 1, 2, 500.0, "tertiary")])

    assert graph.route(1, 2) is not None
    assert graph.route(2, 1) is None


def test_unreachable_and_unknown_nodes_return_nothing() -> None:
    graph = RoadGraph([edge(1, 1, 2, 500.0, "tertiary")])

    assert graph.route(2, 1) is None
    assert graph.route(1, 404) is None


def test_a_class_with_no_speed_is_refused_rather_than_guessed() -> None:
    unusable = edge(1, 1, 2, 100.0, "runway")

    with pytest.raises(UnknownRoadClass):
        _ = unusable.traversal_s
