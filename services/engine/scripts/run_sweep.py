"""Measure what the allocator achieves at each adoption level.

Runs over one routed population, so every level sees the same travellers making the
same journeys and the only thing that changes is how many of them the allocator is
allowed to move. Writes one JSON the documentation and the charts both read.
"""

import argparse
import json
import logging
import statistics
import sys
from pathlib import Path

from app.logging import configure_logging
from core.allocator import SLOT_SECONDS, allocate, allocate_independently
from core.cities import get_city
from sim.cohort import hhmm, load_journeys, load_ledger, load_network

logger = logging.getLogger("run_sweep")

# The levels the project claims to say something about. 1% is here because "useless
# below some threshold" is the first objection anybody raises, and it deserves a
# measured answer rather than an argument.
ADOPTION_LEVELS = [0.0, 0.01, 0.05, 0.10, 0.20, 0.35, 0.50]

SHIFT_BUCKETS = [5, 10, 15, 20, 30, 45]


def shift_histogram(shifts: list[float]) -> list[dict]:
    """
    How far people were actually asked to move, in minutes.

    A list of ordered buckets rather than a keyed object. The results file is written
    with sorted keys so it diffs cleanly, and "<= 5" sorts after "<= 45" as a string:
    an object here would come back from JSON in an order no reader expects and the
    chart would draw the buckets out of sequence.
    """
    counts = dict.fromkeys(SHIFT_BUCKETS, 0)
    beyond = 0

    for shift in shifts:
        for edge in SHIFT_BUCKETS:
            if shift <= edge:
                counts[edge] += 1
                break
        else:
            beyond += 1

    buckets = [
        {"upto_minutes": edge, "travellers": count} for edge, count in counts.items()
    ]
    buckets.append({"upto_minutes": None, "travellers": beyond})
    return buckets


def busiest_edge(ledger, capacity: dict[str, int]) -> tuple[str, float]:
    """The segment-window furthest over capacity, and by what ratio."""
    worst_edge = ""
    worst_ratio = 0.0

    for (edge, _), load in ledger.loads():
        window_capacity = capacity[edge] / 4
        ratio = load / window_capacity
        if ratio > worst_ratio:
            worst_edge, worst_ratio = edge, ratio

    return worst_edge, worst_ratio


def inflow(ledger, edge: str) -> dict[str, int]:
    """Vehicles entering one segment in each quarter hour, keyed by clock time."""
    return {
        f"{(window * SLOT_SECONDS) // 3600:02d}:"
        f"{((window * SLOT_SECONDS) % 3600) // 60:02d}": count
        for window, count in sorted(ledger.entries_by_window(edge).items())
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--city", default="BLR")
    parser.add_argument("--begin", default="08:00")
    parser.add_argument("--end", default="10:00")
    parser.add_argument("--demand-share", type=float, default=1.0)
    parser.add_argument("--out", default="scenarios", type=Path)
    parser.add_argument("--results", default=Path("../../docs/results"), type=Path)
    arguments = parser.parse_args()

    configure_logging("INFO")

    city = get_city(arguments.city)
    target = arguments.out / city.code.lower()

    profiles = load_network(city, target)
    capacity = {edge: p.capacity_vph for edge, p in profiles.items()}
    logger.info("network profiled", extra={"edges": len(profiles)})

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

    logger.info("cohort loaded", extra={"journeys": len(journeys)})

    # The segment to show a before-and-after inflow histogram for. Chosen once, from the
    # untouched departures, so the chart is not quietly picking whichever segment the
    # allocator happened to do best on.
    baseline_trips = [journey.planned(0.0) for journey in journeys]
    baseline = load_ledger(baseline_trips, capacity, None)
    watched, worst_ratio = busiest_edge(baseline, capacity)
    baseline_windows, baseline_excess = baseline.overloaded()

    logger.info(
        "baseline",
        extra={
            "overloaded_windows": baseline_windows,
            "excess_vehicles": round(baseline_excess, 1),
            "busiest_segment": watched,
            "busiest_load_over_capacity": round(worst_ratio, 2),
        },
    )

    levels = []
    for adoption in ADOPTION_LEVELS:
        trips = [journey.planned(adoption) for journey in journeys]
        movable = sum(1 for trip in trips if trip.movable)

        coordinated = allocate(trips, capacity)
        naive = allocate_independently(trips, capacity)

        after = load_ledger(trips, capacity, coordinated.departures)
        naive_after = load_ledger(trips, capacity, naive.departures)

        windows, excess = after.overloaded()
        naive_windows, naive_excess = naive_after.overloaded()

        shifts = [
            abs(coordinated.departures[trip.trip_id] - trip.preferred_departure_s) / 60
            for trip in trips
            if coordinated.departures[trip.trip_id] != trip.preferred_departure_s
        ]

        levels.append(
            {
                "adoption": adoption,
                "movable": movable,
                "shifted": coordinated.shifted,
                "mean_shift_minutes": round(coordinated.mean_shift_minutes, 2),
                "median_shift_minutes": round(statistics.median(shifts), 2)
                if shifts
                else 0.0,
                "shift_histogram": shift_histogram(shifts),
                "overloaded_windows": windows,
                "excess_vehicles": round(excess, 1),
                "naive_overloaded_windows": naive_windows,
                "naive_excess_vehicles": round(naive_excess, 1),
                "naive_shifted": naive.shifted,
                "excess_removed_share": round(
                    (baseline_excess - excess) / baseline_excess, 4
                )
                if baseline_excess
                else 0.0,
                "naive_excess_removed_share": round(
                    (baseline_excess - naive_excess) / baseline_excess, 4
                )
                if baseline_excess
                else 0.0,
                "inflow_at_busiest": inflow(after, watched),
            }
        )

        logger.info("level complete", extra=levels[-1] | {"shift_histogram": "omitted"})

    summary = {
        "city": city.code,
        "cohort_window": [arguments.begin, arguments.end],
        "demand_share": arguments.demand_share,
        "journeys": len(journeys),
        "baseline_overloaded_windows": baseline_windows,
        "baseline_excess_vehicles": round(baseline_excess, 1),
        "busiest_segment": watched,
        "busiest_load_over_capacity": round(worst_ratio, 2),
        # What the chart draws its capacity line at. Per quarter hour, which is a
        # quarter of the hourly figure the capacity model produces.
        "busiest_capacity_per_window": round(capacity[watched] / 4, 1),
        "baseline_inflow_at_busiest": inflow(baseline, watched),
        "levels": levels,
    }

    rendered = json.dumps(summary, indent=2, sort_keys=True) + "\n"
    (target / "sweep.metrics.json").write_text(rendered)
    arguments.results.mkdir(parents=True, exist_ok=True)
    (arguments.results / f"sweep-{city.code.lower()}.json").write_text(rendered)

    logger.info(
        "sweep complete",
        extra={"levels": len(levels), "journeys": len(journeys)},
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
