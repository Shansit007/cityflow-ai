"""Generate the synthetic travelling population and route it at habitual departures."""

import argparse
import json
import logging
import math
import sys
from dataclasses import asdict
from pathlib import Path

from app.logging import configure_logging
from core.cities import get_city
from sim.demand import Traveller, generate
from sim.trips import (
    DuarouterFailed,
    collect_endpoints,
    count_routes,
    run_duarouter,
    write_trips,
)

logger = logging.getLogger("build_demand")


def straight_line_stats(
    people: list[Traveller], positions: dict[str, tuple[float, float]]
) -> dict[str, float]:
    """
    Journey lengths as the crow flies, which the gravity model's decay controls
    directly. Network distance runs roughly 1.3 to 1.5 times this; both are reported
    in docs/engine.md so the calibration can be checked rather than taken on trust.
    """
    distances = sorted(
        math.dist(positions[p.origin_edge], positions[p.destination_edge])
        for p in people
    )
    return {
        "mean_km": round(sum(distances) / len(distances) / 1000, 2),
        "median_km": round(distances[len(distances) // 2] / 1000, 2),
        "p90_km": round(distances[int(len(distances) * 0.9)] / 1000, 2),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument("--trips", type=int, default=50000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default="scenarios", type=Path)
    arguments = parser.parse_args()

    configure_logging("INFO")

    city = get_city(arguments.city)
    target = arguments.out / city.code.lower()
    net_file = target / "city.net.xml"

    if not net_file.exists():
        logger.error(
            "no network: run build_scenario.py first",
            extra={"expected": str(net_file)},
        )
        return 2

    endpoints = collect_endpoints(net_file)
    logger.info("endpoints collected", extra={"candidate_edges": len(endpoints)})

    if len(endpoints) < 2:
        logger.error("too few candidate endpoints to build trips")
        return 1

    people = generate(
        endpoints, count=arguments.trips, seed=arguments.seed, fleet=city.fleet
    )

    positions = {e.edge_id: (e.x, e.y) for e in endpoints}
    drawn: dict[str, int] = {}
    for person in people:
        drawn[person.vehicle_type] = drawn.get(person.vehicle_type, 0) + 1
    logger.info(
        "population generated",
        extra={
            "trips": len(people),
            "fleet": {k: round(v / len(people), 3) for k, v in sorted(drawn.items())},
            **straight_line_stats(people, positions),
        },
    )

    population_file = target / "population.json"
    population_file.write_text(json.dumps([asdict(p) for p in people]))

    habitual = {p.trip_id: p.habitual_departure_s for p in people}
    trips_file = target / "baseline.trips.xml"
    routes_file = target / "baseline.rou.xml"

    write_trips(people, habitual, trips_file, city.fleet)
    logger.info("trips written", extra={"trips": len(people), "path": str(trips_file)})

    try:
        run_duarouter(net_file, trips_file, routes_file, seed=arguments.seed)
    except DuarouterFailed as error:
        logger.error("duarouter failed", extra={"reason": str(error)[:2000]})
        return 1

    routed = count_routes(routes_file)
    logger.info(
        "routed",
        extra={
            "requested": len(people),
            "routed": routed,
            "unroutable": len(people) - routed,
            "path": str(routes_file),
        },
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
