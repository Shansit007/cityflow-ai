"""Generate the synthetic travelling population and route it at habitual departures."""

import argparse
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path

from app.logging import configure_logging
from core.cities import get_city
from sim.demand import generate
from sim.trips import (
    DuarouterFailed,
    collect_endpoints,
    count_routes,
    run_duarouter,
    write_trips,
)

logger = logging.getLogger("build_demand")


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

    endpoints, weights = collect_endpoints(net_file)
    logger.info("endpoints collected", extra={"candidate_edges": len(endpoints)})

    if len(endpoints) < 2:
        logger.error("too few candidate endpoints to build trips")
        return 1

    people = generate(endpoints, weights, count=arguments.trips, seed=arguments.seed)

    population_file = target / "population.json"
    population_file.write_text(json.dumps([asdict(p) for p in people]))

    habitual = {p.trip_id: p.habitual_departure_s for p in people}
    trips_file = target / "baseline.trips.xml"
    routes_file = target / "baseline.rou.xml"

    write_trips(people, habitual, trips_file)
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
