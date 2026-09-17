"""Draw a city's arterial road network as a static SVG, for the apps to use as a backdrop.

Every city looks like itself: Delhi has its ring roads, Bengaluru its radials. A stock
photograph of a monument says nothing about the road network the engine plans on, needs
a licence, and fights with the text in front of it. This is the same geometry the
allocator budgets capacity for, drawn faintly.

Generated once and committed, not built per request: it changes only when the network is
reloaded, and a page should not run a PostGIS query to draw its own background.
"""

import argparse
import logging
import math
import sys
from pathlib import Path
from xml.sax.saxutils import escape

import psycopg

from app.logging import configure_logging
from app.settings import configured_database_url
from core.cities import get_city

logger = logging.getLogger("build_city_map")

# Arterials only. Every residential street would be a megabyte of noise at the opacity
# this is drawn at, and the shape a person recognises is the big roads.
CLASSES = ("motorway", "trunk", "primary")

WIDTH = 1600

GEOMETRY = """
SELECT ST_AsText(ST_Simplify(geom, %s))
FROM road_segments
WHERE city = %s AND highway_class = ANY(%s)
"""


def parse_linestring(wkt: str) -> list[tuple[float, float]]:
    inner = wkt[wkt.index("(") + 1 : wkt.rindex(")")]
    points = []
    for pair in inner.split(","):
        lon, _, lat = pair.strip().partition(" ")
        points.append((float(lon), float(lat)))
    return points


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.0004,
        help="Douglas-Peucker tolerance in degrees, about 45 m",
    )
    parser.add_argument("--out", type=Path, default=Path("../../apps"))
    parser.add_argument("--database-url", default=configured_database_url())
    arguments = parser.parse_args()

    configure_logging("INFO")

    if not arguments.database_url:
        logger.error("no database url: pass --database-url or set ENGINE_DATABASE_URL")
        return 2

    city = get_city(arguments.city)
    box = city.bbox

    with (
        psycopg.connect(arguments.database_url) as connection,
        connection.cursor() as cursor,
    ):
        cursor.execute(GEOMETRY, (arguments.tolerance, city.code, list(CLASSES)))
        rows = cursor.fetchall()

    if not rows:
        logger.error("no arterial segments for this city; run load_network.py first")
        return 1

    # Equirectangular with a cosine correction, which is accurate enough across a city
    # and avoids a projection dependency for what is a decorative drawing.
    scale = math.cos(math.radians((box.south + box.north) / 2))
    span_x = (box.east - box.west) * scale
    span_y = box.north - box.south
    height = round(WIDTH * span_y / span_x)

    paths = []
    for (wkt,) in rows:
        points = parse_linestring(wkt)
        if len(points) < 2:
            continue
        drawn = " ".join(
            f"{(lon - box.west) * scale / span_x * WIDTH:.1f},"
            f"{(box.north - lat) / span_y * height:.1f}"
            for lon, lat in points
        )
        paths.append(f'<polyline points="{drawn}"/>')

    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {height}" '
        f'role="img" aria-label="{escape(city.name)} arterial road network">'
        f"<title>{escape(city.name)} arterial road network</title>"
        '<g fill="none" stroke="currentColor" stroke-width="1.2" '
        'stroke-linecap="round" stroke-linejoin="round">'
        + "".join(paths)
        + "</g></svg>"
    )

    written = []
    for app in ("traveller", "municipal"):
        target = arguments.out / app / "public" / "networks"
        target.mkdir(parents=True, exist_ok=True)
        path = target / f"{city.code.lower()}.svg"
        path.write_text(svg)
        written.append(str(path))

    logger.info(
        "city map drawn",
        extra={
            "city": city.code,
            "segments": len(paths),
            "kilobytes": round(len(svg) / 1024),
            "files": written,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
