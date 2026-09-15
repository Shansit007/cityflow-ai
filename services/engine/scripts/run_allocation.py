"""Allocate departure slots for a cohort and write the shifted scenario."""

import argparse
import json
import logging
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from app.logging import configure_logging
from core.allocator import PlannedTrip, SlotLedger, allocate, allocate_independently
from core.cities import get_city
from sim.demand import SECONDS_PER_MINUTE, demand_draw
from sim.edges import load_profiles, offsets_for
from sim.vehicles import write_vtypes

logger = logging.getLogger("run_allocation")


def hhmm(value: str) -> int:
    hours, _, minutes = value.partition(":")
    return int(hours) * 3600 + int(minutes or 0) * 60


def read_cohort(
    population_file: Path, begin_s: int, end_s: int, share: float, adoption: float
) -> dict[str, dict]:
    """The travellers this run plans for, and what the allocator may do with each."""
    people = json.loads(population_file.read_text())
    cohort: dict[str, dict] = {}

    for person in people:
        departure = person["habitual_departure_s"]
        if not begin_s <= departure < end_s:
            continue
        if demand_draw(person["trip_id"]) >= share:
            continue

        flexibility = person["flexibility_minutes"]
        cohort[person["trip_id"]] = {
            "preferred": departure,
            "flexibility": flexibility,
            "movable": person["participation_draw"] < adoption and flexibility > 0,
        }

    return cohort


def read_paths(routes: Path, wanted: set[str]) -> dict[str, tuple[str, ...]]:
    paths: dict[str, tuple[str, ...]] = {}

    for _, element in ET.iterparse(routes, events=("end",)):
        if element.tag != "vehicle":
            continue

        vehicle_id = element.get("id", "")
        if vehicle_id in wanted:
            route = element.find("route")
            if route is not None:
                paths[vehicle_id] = tuple(route.get("edges", "").split())

        element.clear()

    return paths


def build_trips(cohort: dict[str, dict], paths: dict, profiles: dict) -> list:
    trips = []

    for trip_id, facts in cohort.items():
        path = paths.get(trip_id)
        if not path:
            continue

        slack = facts["flexibility"] * SECONDS_PER_MINUTE
        preferred = facts["preferred"]
        trips.append(
            PlannedTrip(
                trip_id=trip_id,
                # One trip per traveller in the simulated population, so the traveller
                # is the trip. A deployment keys this on the City ID, which is what
                # makes the fairness term span days rather than a single morning.
                identity=trip_id,
                path=path,
                offsets_s=offsets_for(list(path), profiles),
                preferred_departure_s=preferred,
                earliest_departure_s=preferred - slack,
                latest_departure_s=preferred + slack,
                movable=facts["movable"],
            )
        )

    return trips


def measure(
    trips: list, capacity: dict[str, int], departures: dict[str, int] | None = None
) -> tuple[int, float]:
    """How oversubscribed the network is, at the given departures or the habitual ones."""
    chosen = departures or {}
    ledger = SlotLedger(capacity)
    for trip in trips:
        ledger.commit(trip, chosen.get(trip.trip_id, trip.preferred_departure_s))
    return ledger.overloaded()


def write_allocated(
    source: Path, destination: Path, departures: dict[str, int], fleet
) -> int:
    root = ET.Element("routes")
    write_vtypes(root, fleet)
    vehicles: list[tuple[int, ET.Element]] = []

    for _, element in ET.iterparse(source, events=("end",)):
        if element.tag != "vehicle":
            continue

        vehicle_id = element.get("id", "")
        departure = departures.get(vehicle_id)
        if departure is not None:
            clone = ET.Element("vehicle", dict(element.attrib))
            clone.set("depart", f"{departure}.00")
            for child in element:
                clone.append(ET.Element(child.tag, dict(child.attrib)))
            vehicles.append((departure, clone))

        element.clear()

    # SUMO reads route files in departure order and rejects one that goes backwards.
    for _, vehicle in sorted(vehicles, key=lambda pair: pair[0]):
        root.append(vehicle)

    destination.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(destination, encoding="utf-8", xml_declaration=True)
    return len(vehicles)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument("--begin", default="08:00")
    parser.add_argument("--end", default="10:00")
    parser.add_argument("--demand-share", type=float, default=1.0)
    parser.add_argument("--adoption", type=float, default=0.20)
    parser.add_argument("--out", default="scenarios", type=Path)
    parser.add_argument(
        "--results",
        default=Path("../../docs/results"),
        type=Path,
        help="Where the committed copy of the metrics goes, for the docs to cite",
    )
    arguments = parser.parse_args()

    configure_logging("INFO")

    city = get_city(arguments.city)
    target = arguments.out / city.code.lower()
    net_file = target / "city.net.xml"
    # The full routed population, not the cohort file run_baseline writes. Reading
    # that would make this script depend on a simulation having already happened,
    # when its whole value is answering whether one is worth starting.
    routed = target / "baseline.rou.xml"
    population_file = target / "population.json"

    for required in (net_file, routed, population_file):
        if not required.exists():
            logger.error("missing input", extra={"expected": str(required)})
            return 2

    profiles = load_profiles(net_file, target / "edges.profile.json", city.fleet)
    capacity = {edge: p.capacity_vph for edge, p in profiles.items()}
    logger.info("network profiled", extra={"edges": len(profiles)})

    cohort = read_cohort(
        population_file,
        hhmm(arguments.begin),
        hhmm(arguments.end),
        arguments.demand_share,
        arguments.adoption,
    )
    paths = read_paths(routed, set(cohort))
    trips = build_trips(cohort, paths, profiles)

    if not trips:
        logger.error("no trips to allocate")
        return 1

    movable = sum(1 for t in trips if t.movable)
    windows, excess = measure(trips, capacity)
    logger.info(
        "baseline saturation",
        extra={
            "trips": len(trips),
            "movable": movable,
            "adoption": arguments.adoption,
            "overloaded_windows": windows,
            "excess_vehicles": round(excess, 1),
        },
    )

    if windows == 0:
        # Not an error, and worth saying plainly rather than reporting a zero
        # improvement later: with no segment over capacity in any window there is
        # nothing for a departure-time allocator to relieve.
        logger.warning("no segment exceeds capacity; allocation cannot help here")

    allocation = allocate(trips, capacity)
    naive = allocate_independently(trips, capacity)

    after_windows, after_excess = measure(trips, capacity, allocation.departures)
    naive_windows, naive_excess = measure(trips, capacity, naive.departures)

    allocated_routes = target / "allocated.cohort.rou.xml"
    written = write_allocated(
        routed, allocated_routes, allocation.departures, city.fleet
    )

    summary = {
        "city": city.code,
        "cohort_window": [arguments.begin, arguments.end],
        "demand_share": arguments.demand_share,
        "adoption": arguments.adoption,
        "trips": len(trips),
        "movable": movable,
        "shifted": allocation.shifted,
        "mean_shift_minutes": round(allocation.mean_shift_minutes, 2),
        "overloaded_windows_before": windows,
        "overloaded_windows_after": after_windows,
        "excess_vehicles_before": round(excess, 1),
        "excess_vehicles_after": round(after_excess, 1),
        "overloaded_windows_naive": naive_windows,
        "excess_vehicles_naive": round(naive_excess, 1),
        "naive_shifted": naive.shifted,
        "naive_mean_shift_minutes": round(naive.mean_shift_minutes, 2),
        "unknown_edges": allocation.unknown_edges,
        "written": written,
    }
    rendered = json.dumps(summary, indent=2, sort_keys=True)

    # Two copies on purpose. scenarios/ is gitignored because it holds hundreds of
    # megabytes of routes and networks, so a result left only there is a number nobody
    # else can check. The second copy is small, committed, and is what docs/engine.md
    # quotes: every figure in the documentation should be reproducible by re-running
    # one command and diffing this file.
    (target / "allocation.metrics.json").write_text(rendered)

    arguments.results.mkdir(parents=True, exist_ok=True)
    (arguments.results / f"allocation-{city.code.lower()}.json").write_text(rendered)

    logger.info("allocation complete", extra=summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
