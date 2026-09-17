"""The routable network for a city, loaded once and kept for the process's life."""

import asyncio
import logging
from dataclasses import dataclass

from psycopg import AsyncConnection
from psycopg.rows import tuple_row

from core.capacity import ROAD_CLASSES
from core.geohash import decode
from core.liveplan import segment_key
from core.routing import RoadEdge, RoadGraph

logger = logging.getLogger(__name__)

SEGMENTS = """
SELECT id, from_node, to_node, length_m, highway_class, capacity_vph
FROM road_segments
WHERE city = %s AND highway_class = ANY(%s)
"""

NEAREST_NODE = """
SELECT from_node
FROM road_segments
WHERE city = %s
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(%s, %s), 4326)
LIMIT 1
"""


class UnknownCity(ValueError):
    pass


@dataclass(frozen=True)
class CityNetwork:
    graph: RoadGraph
    capacity_vph: dict[str, int]


class NetworkCache:
    """
    One graph per city, built on first use.

    Building it costs a full table scan and a hundred thousand objects, which is
    seconds — acceptable once, not per request. The lock is what stops two requests
    arriving together from both paying that cost.
    """

    def __init__(self) -> None:
        self._cities: dict[str, CityNetwork] = {}
        self._lock = asyncio.Lock()

    async def get(self, connection: AsyncConnection, city: str) -> CityNetwork:
        cached = self._cities.get(city)
        if cached is not None:
            return cached

        async with self._lock:
            # Another request may have built it while this one waited.
            cached = self._cities.get(city)
            if cached is not None:
                return cached

            network = await self._load(connection, city)
            self._cities[city] = network
            return network

    async def _load(self, connection: AsyncConnection, city: str) -> CityNetwork:
        async with connection.cursor(row_factory=tuple_row) as cursor:
            await cursor.execute(SEGMENTS, (city, list(ROAD_CLASSES)))
            rows = await cursor.fetchall()

        if not rows:
            raise UnknownCity(
                f"No road segments for city {city!r}. Run scripts/load_network.py first."
            )

        edges = []
        capacity: dict[str, int] = {}
        for segment_id, from_node, to_node, length_m, highway_class, capacity_vph in rows:
            edges.append(
                RoadEdge(
                    segment_id=segment_id,
                    from_node=from_node,
                    to_node=to_node,
                    length_m=float(length_m),
                    highway_class=highway_class,
                )
            )
            capacity[segment_key(segment_id)] = capacity_vph

        graph = RoadGraph(edges)
        logger.info(
            "network loaded",
            extra={"city": city, "segments": len(graph), "nodes": graph.node_count},
        )
        return CityNetwork(graph=graph, capacity_vph=capacity)


async def node_for_cell(connection: AsyncConnection, city: str, cell: str) -> int | None:
    """The network node nearest the middle of a cell, or None if the city has none."""
    longitude, latitude = decode(cell).centre

    async with connection.cursor(row_factory=tuple_row) as cursor:
        await cursor.execute(NEAREST_NODE, (city, longitude, latitude))
        row = await cursor.fetchone()

    return row[0] if row else None
