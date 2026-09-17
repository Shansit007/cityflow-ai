"""Load the measured baseline into departure_slots, as the background the app plans on.

The same measured morning is written to each of several days, because one day of load
goes stale overnight: tomorrow the engine plans against an empty road and truthfully but
uselessly tells everyone their usual time is fine. Repeating it is honest about what it
is — one morning, not a forecast — and keeps the thing demonstrable.

Without this the first traveller to ask for a recommendation sees an empty road and is
told to leave at their usual time, which is correct and useless. The background here is
the same cohort the README's result is measured on, so what the app avoids and what the
documentation claims are the same congestion.
"""

import argparse
import logging
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import psycopg

from app.logging import configure_logging
from app.settings import configured_database_url
from core.allocator import SLOT_SECONDS
from core.cities import City, get_city
from sim.cohort import hhmm, load_journeys, load_ledger, load_network
from sim.network import edge_id

logger = logging.getLogger("seed_slots")

SEGMENTS = """
SELECT osm_way_id, from_node, to_node, id, capacity_vph
FROM road_segments
WHERE city = %s
"""

CLEAR = "DELETE FROM departure_slots WHERE window_start >= %s AND window_start < %s"

UPSERT = """
INSERT INTO departure_slots (
    segment_id, window_start, allocated, background_load, capacity
)
VALUES (%s, %s, 0, %s, %s)
ON CONFLICT (segment_id, window_start)
DO UPDATE SET background_load = EXCLUDED.background_load, capacity = EXCLUDED.capacity
"""


def segment_ids(connection, city: str) -> dict[str, tuple[int, int]]:
    """SUMO edge name to the road_segments row it was built from, and its capacity."""
    with connection.cursor() as cursor:
        cursor.execute(SEGMENTS, (city,))
        return {
            edge_id(way, source, target): (segment_id, capacity)
            for way, source, target, segment_id, capacity in cursor.fetchall()
        }


def window_at(day: date, index: int, zone: ZoneInfo) -> datetime:
    """
    The real instant a scenario window falls on.

    Scenario clocks run in seconds since local midnight. The traveller's browser sends
    a real timestamp, so seeding in UTC-of-the-day would put the background two peaks
    away from anyone asking for a plan and quietly make all of this do nothing.
    """
    midnight = datetime.combine(day, time.min, tzinfo=zone)
    return (midnight + timedelta(seconds=index * SLOT_SECONDS)).astimezone(
        ZoneInfo("UTC")
    )


def seed(connection, city: City, day: date, loads, lookup) -> tuple[int, int]:
    zone = ZoneInfo(city.timezone)
    rows = []
    unmatched = 0

    for (edge, window), count in loads:
        matched = lookup.get(edge)
        if matched is None:
            unmatched += 1
            continue
        segment_id, capacity = matched
        rows.append((segment_id, window_at(day, window, zone), count, capacity))

    if not rows:
        return 0, unmatched

    starts = [row[1] for row in rows]
    with connection.cursor() as cursor:
        last = max(starts) + timedelta(seconds=SLOT_SECONDS)
        cursor.execute(CLEAR, (min(starts), last))
        cursor.executemany(UPSERT, rows)

    return len(rows), unmatched


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument("--date", type=date.fromisoformat, default=date.today())
    parser.add_argument(
        "--days",
        type=int,
        default=7,
        help="How many days from --date to seed. One measured morning, repeated.",
    )
    parser.add_argument("--begin", default="08:00")
    parser.add_argument("--end", default="10:00")
    parser.add_argument("--demand-share", type=float, default=1.0)
    parser.add_argument("--out", default="scenarios", type=Path)
    parser.add_argument("--database-url", default=configured_database_url())
    arguments = parser.parse_args()

    configure_logging("INFO")

    if not arguments.database_url:
        logger.error("no database url: pass --database-url or set ENGINE_DATABASE_URL")
        return 2

    city = get_city(arguments.city)
    target = arguments.out / city.code.lower()

    profiles = load_network(city, target)
    capacity = {edge: profile.capacity_vph for edge, profile in profiles.items()}

    journeys = load_journeys(
        target,
        hhmm(arguments.begin),
        hhmm(arguments.end),
        arguments.demand_share,
        profiles,
    )
    if not journeys:
        logger.error("no journeys in this window")
        return 1

    ledger = load_ledger([journey.planned(0.0) for journey in journeys], capacity, None)
    windows, excess = ledger.overloaded()
    logger.info(
        "baseline loaded",
        extra={
            "journeys": len(journeys),
            "overloaded_windows": windows,
            "excess_vehicles": round(excess, 1),
        },
    )

    with psycopg.connect(arguments.database_url) as connection:
        lookup = segment_ids(connection, city.code)
        if not lookup:
            logger.error("no road segments; run scripts/load_network.py first")
            return 1

        loads = list(ledger.loads())
        written = 0
        unmatched = 0
        for offset in range(arguments.days):
            day = arguments.date + timedelta(days=offset)
            rows, missing = seed(connection, city, day, loads, lookup)
            written += rows
            unmatched = missing
        connection.commit()

    logger.info(
        "departure_slots seeded",
        extra={
            "from": arguments.date.isoformat(),
            "days": arguments.days,
            "rows": written,
            # Junction joining drops edges, so some the simulation used have no row in
            # road_segments. Reported rather than ignored: a large share here means the
            # scenario and the database have drifted apart.
            "unmatched_edges": unmatched,
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
