"""Turn the loaded road segments into a SUMO network."""

import argparse
import logging
import os
import sys
from pathlib import Path

import psycopg
from pyproj import Transformer

from app.logging import configure_logging
from core.cities import get_city
from sim.network import (
    NetconvertFailed,
    PlainEdge,
    PlainNode,
    edge_id,
    run_netconvert,
    summarise,
    utm_epsg,
    write_edges,
    write_nodes,
)

logger = logging.getLogger("build_scenario")

SEGMENTS = """
SELECT osm_way_id, from_node, to_node, lanes, highway_class, length_m,
       ST_X(ST_StartPoint(geom)) AS from_lon, ST_Y(ST_StartPoint(geom)) AS from_lat,
       ST_X(ST_EndPoint(geom))   AS to_lon,   ST_Y(ST_EndPoint(geom))   AS to_lat
FROM road_segments
WHERE city = %s
"""


def read_segments(
    database_url: str, city_code: str, transformer: Transformer
) -> tuple[list[PlainNode], list[PlainEdge]]:
    nodes: dict[int, PlainNode] = {}
    edges: list[PlainEdge] = []

    with (
        psycopg.connect(database_url) as connection,
        connection.cursor() as cursor,
    ):
        cursor.execute(SEGMENTS, (city_code,))
        for row in cursor:
            (
                way_id,
                from_node,
                to_node,
                lanes,
                highway_class,
                length_m,
                from_lon,
                from_lat,
                to_lon,
                to_lat,
            ) = row

            for node_id, lon, lat in (
                (from_node, from_lon, from_lat),
                (to_node, to_lon, to_lat),
            ):
                if node_id not in nodes:
                    x, y = transformer.transform(lon, lat)
                    nodes[node_id] = PlainNode(node_id=node_id, x=x, y=y)

            edges.append(
                PlainEdge(
                    edge_id=edge_id(way_id, from_node, to_node),
                    from_node=from_node,
                    to_node=to_node,
                    highway_class=highway_class,
                    lanes=lanes,
                    length_m=float(length_m),
                )
            )

    return list(nodes.values()), edges


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument("--out", default="scenarios", type=Path)
    parser.add_argument("--database-url", default=os.environ.get("ENGINE_DATABASE_URL"))
    arguments = parser.parse_args()

    configure_logging("INFO")

    if not arguments.database_url:
        logger.error("no database url: pass --database-url or set ENGINE_DATABASE_URL")
        return 2

    city = get_city(arguments.city)
    target = arguments.out / city.code.lower()
    target.mkdir(parents=True, exist_ok=True)

    epsg = utm_epsg(city.centroid_lon, city.centroid_lat)
    transformer = Transformer.from_crs("EPSG:4326", epsg, always_xy=True)
    logger.info("projecting", extra={"city": city.code, "epsg": epsg})

    nodes, edges = read_segments(arguments.database_url, city.code, transformer)
    if not edges:
        logger.error("no segments loaded for this city", extra={"city": city.code})
        return 1

    node_file = target / "nodes.nod.xml"
    edge_file = target / "edges.edg.xml"
    net_file = target / "city.net.xml"

    write_nodes(nodes, node_file)
    write_edges(edges, edge_file)
    logger.info("plain xml written", extra={"nodes": len(nodes), "edges": len(edges)})

    try:
        run_netconvert(node_file, edge_file, net_file)
    except NetconvertFailed as error:
        logger.error("netconvert failed", extra={"reason": str(error)[:2000]})
        return 1

    built = summarise(net_file)
    logger.info(
        "network built",
        extra={
            "path": str(net_file),
            "megabytes": round(net_file.stat().st_size / 1e6, 1),
            "edges": built.edges,
            "edges_dropped": len(edges) - built.edges,
            "junctions": built.junctions,
            "traffic_lights": built.traffic_lights,
            "signal_share": round(built.traffic_lights / max(built.junctions, 1), 3),
            "lane_km": round(built.lane_metres / 1000, 1),
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
