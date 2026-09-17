"""Download a city's drivable road network from OSM and load it into PostGIS."""

import argparse
import logging
import sys

import osmnx as ox
import psycopg

from app.logging import configure_logging
from app.settings import configured_database_url
from core.cities import City, get_city
from core.osm import Segment, build_segment

logger = logging.getLogger("load_network")

BATCH = 2000

UPSERT = """
INSERT INTO road_segments (
    city, osm_way_id, from_node, to_node, geom,
    lanes, length_m, highway_class, capacity_vph, lanes_tagged
) VALUES (
    %s, %s, %s, %s, ST_GeomFromText(%s, 4326),
    %s, %s, %s, %s, %s
)
ON CONFLICT (city, osm_way_id, from_node, to_node) DO UPDATE SET
    geom = EXCLUDED.geom,
    lanes = EXCLUDED.lanes,
    length_m = EXCLUDED.length_m,
    highway_class = EXCLUDED.highway_class,
    capacity_vph = EXCLUDED.capacity_vph,
    lanes_tagged = EXCLUDED.lanes_tagged
"""


def edge_coordinates(graph, u: int, v: int, data: dict) -> list[tuple[float, float]]:
    geometry = data.get("geometry")
    if geometry is not None:
        return [(float(x), float(y)) for x, y in geometry.coords]

    # osmnx omits geometry for an edge that is a straight line between its endpoints.
    start, end = graph.nodes[u], graph.nodes[v]
    return [
        (float(start["x"]), float(start["y"])),
        (float(end["x"]), float(end["y"])),
    ]


def check_database(database_url: str) -> None:
    """Fails before the download rather than after several minutes of it."""
    with (
        psycopg.connect(database_url, connect_timeout=5) as connection,
        connection.cursor() as cursor,
    ):
        cursor.execute("SELECT to_regclass('public.road_segments')")
        row = cursor.fetchone()
        if row is None or row[0] is None:
            raise RuntimeError(
                "road_segments is missing. Apply infra/migrations in order first."
            )
        cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'postgis'")
        if cursor.fetchone() is None:
            raise RuntimeError("PostGIS is not installed in this database.")


def extract_segments(city: City) -> list[Segment]:
    box = city.bbox
    logger.info(
        "downloading network",
        extra={"city": city.code, "bbox": [box.west, box.south, box.east, box.north]},
    )

    graph = ox.graph_from_bbox(
        bbox=(box.west, box.south, box.east, box.north), network_type="drive"
    )

    segments: list[Segment] = []
    skipped = 0
    for u, v, data in graph.edges(data=True):
        segment = build_segment(
            u, v, data, edge_coordinates(graph, u, v, data), city.fleet
        )
        if segment is None:
            skipped += 1
            continue
        segments.append(segment)

    logger.info(
        "network extracted",
        extra={
            "kept": len(segments),
            "skipped": skipped,
            "nodes": graph.number_of_nodes(),
        },
    )
    return segments


def load(city: City, segments: list[Segment], database_url: str) -> None:
    with (
        psycopg.connect(database_url) as connection,
        connection.cursor() as cursor,
    ):
        cursor.execute(
            """
            INSERT INTO cities (code, name, centroid, timezone)
            VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
            """,
            (
                city.code,
                city.name,
                city.centroid_lon,
                city.centroid_lat,
                city.timezone,
            ),
        )

        for start in range(0, len(segments), BATCH):
            chunk = segments[start : start + BATCH]
            cursor.executemany(
                UPSERT,
                [
                    (
                        city.code,
                        s.osm_way_id,
                        s.from_node,
                        s.to_node,
                        s.wkt,
                        s.lanes,
                        s.length_m,
                        s.highway_class,
                        s.capacity_vph,
                        s.lanes_tagged,
                    )
                    for s in chunk
                ],
            )
            logger.info("loaded batch", extra={"written": start + len(chunk)})

        connection.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR", help="City code, e.g. BLR")
    parser.add_argument(
        "--database-url",
        default=configured_database_url(),
        help="Defaults to ENGINE_DATABASE_URL",
    )
    arguments = parser.parse_args()

    configure_logging("INFO")

    if not arguments.database_url:
        logger.error("no database url: pass --database-url or set ENGINE_DATABASE_URL")
        return 2

    city = get_city(arguments.city)

    try:
        check_database(arguments.database_url)
    except (psycopg.Error, RuntimeError) as error:
        logger.error("database is not ready", extra={"reason": str(error).strip()})
        return 2

    segments = extract_segments(city)

    if not segments:
        logger.error("extract produced no usable segments", extra={"city": city.code})
        return 1

    load(city, segments, arguments.database_url)

    capacities = sorted(s.capacity_vph for s in segments)
    tagged = sum(1 for s in segments if s.lanes_tagged)
    logger.info(
        "done",
        extra={
            "city": city.code,
            "segments": len(segments),
            "capacity_vph_median": capacities[len(capacities) // 2],
            "capacity_vph_min": capacities[0],
            "capacity_vph_max": capacities[-1],
            "lanes_from_osm": tagged,
            "lanes_from_default": len(segments) - tagged,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
