"""Shortest paths over the segments the capacity model and the ledger are keyed on."""

import heapq
from collections.abc import Iterable
from dataclasses import dataclass

from core.capacity import ROAD_CLASSES, UnknownRoadClass

KPH_TO_MS = 1000 / 3600


@dataclass(frozen=True)
class RoadEdge:
    """One directed segment, as road_segments stores it."""

    segment_id: int
    from_node: int
    to_node: int
    length_m: float
    highway_class: str

    @property
    def traversal_s(self) -> float:
        road = ROAD_CLASSES.get(self.highway_class)
        if road is None:
            raise UnknownRoadClass(
                f"Segment {self.segment_id} has class {self.highway_class!r}, which has "
                f"no free-flow speed in core.capacity.ROAD_CLASSES."
            )
        return self.length_m / (road.free_flow_kph * KPH_TO_MS)


@dataclass(frozen=True)
class Route:
    """A path, and when the vehicle reaches each segment of it."""

    segment_ids: tuple[int, ...]
    # Seconds after departure that the vehicle enters each segment. Parallel to
    # segment_ids, so offsets_s[i] belongs to segment_ids[i] and the first is always 0.
    offsets_s: tuple[int, ...]
    duration_s: int
    distance_m: float


class RoadGraph:
    """
    The drivable network as an adjacency list, built once and queried per request.

    Edge weights are free-flow traversal times. That is the same optimistic assumption
    the offline allocator makes about path offsets, and it is wrong in the same known
    direction: under load a journey takes longer than this says. Replacing it needs
    measured per-interval speeds, and using the congested time here would be circular,
    because how congested a segment is depends on the departure times being chosen.
    """

    def __init__(self, edges: Iterable[RoadEdge]) -> None:
        self._out: dict[int, list[RoadEdge]] = {}
        self._count = 0

        for edge in edges:
            self._out.setdefault(edge.from_node, []).append(edge)
            self._out.setdefault(edge.to_node, [])
            self._count += 1

    def __len__(self) -> int:
        return self._count

    @property
    def node_count(self) -> int:
        return len(self._out)

    def has_node(self, node: int) -> bool:
        return node in self._out

    def route(self, origin_node: int, destination_node: int) -> Route | None:
        """The quickest path, or None when the destination is unreachable."""
        if origin_node not in self._out or destination_node not in self._out:
            return None
        if origin_node == destination_node:
            return Route(segment_ids=(), offsets_s=(), duration_s=0, distance_m=0.0)

        best: dict[int, float] = {origin_node: 0.0}
        arrived_by: dict[int, RoadEdge] = {}
        settled: set[int] = set()
        queue: list[tuple[float, int]] = [(0.0, origin_node)]

        while queue:
            cost, node = heapq.heappop(queue)
            if node in settled:
                continue
            settled.add(node)

            if node == destination_node:
                return self._reconstruct(origin_node, destination_node, arrived_by, cost)

            for edge in self._out[node]:
                if edge.to_node in settled:
                    continue
                candidate = cost + edge.traversal_s
                if candidate < best.get(edge.to_node, float("inf")):
                    best[edge.to_node] = candidate
                    arrived_by[edge.to_node] = edge
                    heapq.heappush(queue, (candidate, edge.to_node))

        return None

    def _reconstruct(
        self,
        origin_node: int,
        destination_node: int,
        arrived_by: dict[int, RoadEdge],
        duration_s: float,
    ) -> Route:
        path: list[RoadEdge] = []
        node = destination_node
        while node != origin_node:
            edge = arrived_by[node]
            path.append(edge)
            node = edge.from_node
        path.reverse()

        offsets: list[int] = []
        elapsed = 0.0
        for edge in path:
            offsets.append(int(elapsed))
            elapsed += edge.traversal_s

        return Route(
            segment_ids=tuple(edge.segment_id for edge in path),
            offsets_s=tuple(offsets),
            duration_s=int(round(duration_s)),
            distance_m=sum(edge.length_m for edge in path),
        )
