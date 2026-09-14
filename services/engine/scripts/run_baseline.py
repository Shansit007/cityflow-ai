"""Simulate a fixed cohort of travellers at their habitual departure times."""

import argparse
import json
import logging
import sys
from pathlib import Path

from app.logging import configure_logging
from core.cities import get_city
from sim.demand import demand_draw
from sim.runner import (
    MAX_TELEPORT_SHARE,
    SumoFailed,
    read_metrics,
    run_sumo,
)
from sim.trips import filter_routes

logger = logging.getLogger("run_baseline")

# The simulation starts before the cohort does, so a vehicle departing at the first
# minute meets traffic already on the road rather than an empty city.
WARMUP_S = 30 * 60


def hhmm(value: str) -> int:
    hours, _, minutes = value.partition(":")
    return int(hours) * 3600 + int(minutes or 0) * 60


def cohort_ids(
    population_file: Path, begin_s: int, end_s: int, share: float
) -> set[str]:
    """Travellers whose habitual departure falls in the window, fixed for every run."""
    people = json.loads(population_file.read_text())
    return {
        person["trip_id"]
        for person in people
        if begin_s <= person["habitual_departure_s"] < end_s
        and demand_draw(person["trip_id"]) < share
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument("--begin", default="08:00", help="Cohort window start, HH:MM")
    parser.add_argument("--end", default="10:00", help="Cohort window end, HH:MM")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--demand-share",
        type=float,
        default=1.0,
        help="Fraction of the routed population to simulate, for calibrating load",
    )
    parser.add_argument("--out", default="scenarios", type=Path)
    arguments = parser.parse_args()

    configure_logging("INFO")

    city = get_city(arguments.city)
    target = arguments.out / city.code.lower()
    net_file = target / "city.net.xml"
    all_routes = target / "baseline.rou.xml"
    population_file = target / "population.json"

    for required in (net_file, all_routes, population_file):
        if not required.exists():
            logger.error("missing input", extra={"expected": str(required)})
            return 2

    begin_s = hhmm(arguments.begin)
    end_s = hhmm(arguments.end)
    if end_s <= begin_s:
        logger.error("window ends before it begins", extra={"begin": arguments.begin})
        return 2

    if not 0.0 < arguments.demand_share <= 1.0:
        logger.error(
            "demand share must be in (0, 1]", extra={"given": arguments.demand_share}
        )
        return 2

    keep = cohort_ids(population_file, begin_s, end_s, arguments.demand_share)
    if not keep:
        logger.error("no travellers depart in this window")
        return 1

    cohort_routes = target / "baseline.cohort.rou.xml"
    written = filter_routes(all_routes, cohort_routes, keep, city.fleet)
    logger.info(
        "cohort selected",
        extra={
            "in_window": len(keep),
            "routed": written,
            "window": arguments.begin,
            "demand_share": arguments.demand_share,
        },
    )

    tripinfo = target / "baseline.tripinfo.xml"
    statistics = target / "baseline.stats.xml"
    collisions = target / "baseline.collisions.xml"

    # No end time: the run continues until every vehicle in the cohort has arrived, so
    # the measurement covers whole journeys rather than whatever fitted in a fixed clock.
    try:
        run_sumo(
            net_file,
            cohort_routes,
            tripinfo,
            statistics,
            arguments.seed,
            begin_s=max(0, begin_s - WARMUP_S),
            collisions=collisions,
        )
    except SumoFailed as error:
        logger.error("sumo failed", extra={"reason": str(error)})
        return 1

    metrics = read_metrics(tripinfo, statistics)
    if metrics.completed < written:
        logger.warning(
            "some trips did not complete",
            extra={"routed": written, "completed": metrics.completed},
        )

    if not metrics.valid:
        # Reported as a failure rather than a warning. A gridlocked run still writes
        # plausible-looking averages, and a number that looks fine is the one that ends
        # up in a README.
        logger.error(
            "run is not a valid measurement: too many vehicles were teleported",
            extra={
                "teleport_share": round(metrics.teleport_share, 4),
                "limit": MAX_TELEPORT_SHARE,
                "by_cause": metrics.teleports_by_cause,
                "collisions_written_to": str(collisions),
            },
        )

    results = target / "baseline.metrics.json"
    results.write_text(
        json.dumps(
            {
                "city": city.code,
                "cohort_window": [arguments.begin, arguments.end],
                "cohort_size": written,
                "demand_share": arguments.demand_share,
                "seed": arguments.seed,
                **metrics.as_dict(),
                "departures_by_slot": metrics.departures_by_slot,
            },
            indent=2,
            sort_keys=True,
        )
    )

    logger.info("baseline complete", extra=metrics.as_dict())
    return 0 if metrics.valid else 1


if __name__ == "__main__":
    sys.exit(main())
