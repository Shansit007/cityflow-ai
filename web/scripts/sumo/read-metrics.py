#!/usr/bin/env python3
"""
Read the five numbers the Admin Portal asks for out of SUMO's output.

Run after `sumo` finishes. It prints the metrics for each scenario side by side,
labelled exactly as the form on Admin Portal → Simulation labels them, so there
is nothing to work out or convert by hand.

WHERE EACH NUMBER COMES FROM
  summary.xml   <step running="..." ended="..."/>   per simulation step
  tripinfo.xml  <tripinfo duration waitingTime timeLoss/>  per vehicle

  Vehicles departed      final `ended`, or `inserted` if the run was cut short
  Busiest 15-min slot    the largest `running` value in any 900-second window
  Mean travel time       mean of `duration`
  Mean waiting time      mean of `waitingTime`
  Total delay            sum of `timeLoss`
"""

import statistics
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

SLOT_SECONDS = 900  # 15 minutes, the same slot the whole product uses


def read_summary(path):
    """Vehicles that completed, and the peak 15-minute vehicle count."""
    root = ET.parse(path).getroot()

    ended = 0
    inserted = 0
    peak_slot = 0
    slot_max = 0
    slot_end = SLOT_SECONDS

    for step in root.iter("step"):
        time = float(step.get("time", 0))
        running = int(float(step.get("running", 0)))

        ended = max(ended, int(float(step.get("ended", 0))))
        inserted = max(inserted, int(float(step.get("inserted", 0))))

        # Walk forward one window at a time, keeping the busiest.
        while time >= slot_end:
            peak_slot = max(peak_slot, slot_max)
            slot_max = 0
            slot_end += SLOT_SECONDS

        slot_max = max(slot_max, running)

    peak_slot = max(peak_slot, slot_max)

    return {"departed": ended or inserted, "peak": peak_slot}


def read_tripinfo(path):
    """Mean travel time, mean waiting time, total delay."""
    root = ET.parse(path).getroot()
    trips = list(root.iter("tripinfo"))

    if not trips:
        return None

    durations = [float(trip.get("duration", 0)) for trip in trips]
    waiting = [float(trip.get("waitingTime", 0)) for trip in trips]
    loss = [float(trip.get("timeLoss", 0)) for trip in trips]

    return {
        "vehicles": len(trips),
        "mean_travel": round(statistics.mean(durations)),
        "mean_waiting": round(statistics.mean(waiting)),
        "total_delay": round(sum(loss)),
    }


def read_departures(scenario):
    """
    Departures per 15-minute window, straight from the trip file.

    ========================= WHY THIS IS THE PRIMARY METRIC ==================
    CityFlow AI's claim is about how many vehicles ENTER the network at once —
    "how do we prevent too many vehicles entering the road network at the same
    time?". That is departures per window. It is the quantity the product
    actually manipulates.

    The busiest-15-minute-slot figure below measures something different: how
    many vehicles are inside the network simultaneously. On a lightly loaded
    network with short journeys, that number is diluted — a trip lasting four
    minutes is only present for a quarter of the window it started in — so it
    systematically understates what the engine did.

    A note on honesty, since adding a metric late always deserves one: this was
    added AFTER a first run, and it does not flatter the result. It is reported
    because it is the measurement that matches the claim, not because of which
    way it points.
    ==========================================================================
    """
    path = Path(f"{scenario}.trips.xml")
    if not path.exists():
        return None

    root = ET.parse(path).getroot()
    departures = [float(trip.get("depart", 0)) for trip in root.iter("trip")]
    if not departures:
        return None

    per_window = Counter(int(d // SLOT_SECONDS) for d in departures)

    # How concentrated the day is: the share of all trips sitting in the four
    # busiest windows. A spread that genuinely works moves this down, even when
    # the single tallest window is unchanged.
    busiest_four = sorted(per_window.values(), reverse=True)[:4]

    return {
        "per_window": per_window,
        "peak": max(per_window.values()),
        "top4_share": sum(busiest_four) / len(departures),
        "total": len(departures),
    }


def show_windows(baseline, cityflow):
    """A window-by-window comparison, so the shape of the change is visible."""
    if not baseline or not cityflow:
        return

    windows = sorted(set(baseline["per_window"]) | set(cityflow["per_window"]))

    print("\n" + "-" * 62)
    print("  DEPARTURES PER 15 MINUTES  (windows with 8 or more)")
    print("-" * 62)
    print(f"    {'time':<8}{'baseline':>10}{'cityflow':>10}{'change':>9}")

    for window in windows:
        before = baseline["per_window"].get(window, 0)
        after = cityflow["per_window"].get(window, 0)
        if max(before, after) < 8:
            continue

        hours, minutes = divmod(window * 15, 60)
        marker = "  <-- peak" if before == baseline["peak"] else ""
        print(f"    {hours:02d}:{minutes:02d}   {before:>10}{after:>10}{after - before:>+9}{marker}")


def collect(scenario):
    summary_path = Path(f"{scenario}.summary.xml")
    tripinfo_path = Path(f"{scenario}.tripinfo.xml")
    trips_path = Path(f"{scenario}.trips.xml")

    for path in (summary_path, tripinfo_path):
        if not path.exists():
            sys.exit(f"✖ {path} not found. Did `sumo` finish for the {scenario} run?")

    """
    STALENESS GUARD.

    A simulation that is interrupted part-way leaves the previous run's output
    sitting on disk. The metrics then silently compare a fresh baseline against
    a stale CityFlow run — two different populations — and the result looks
    plausible while being meaningless. That happened once and was only caught by
    checking file timestamps by hand.
    """
    if trips_path.exists():
        trips_age = trips_path.stat().st_mtime
        for path in (summary_path, tripinfo_path):
            if path.stat().st_mtime < trips_age - 1:
                sys.exit(
                    f"\n✖ {path} is OLDER than {trips_path}.\n"
                    f"  The {scenario} simulation did not finish after the last export,\n"
                    "  so this file is left over from a previous run. Comparing it would\n"
                    "  be meaningless.\n\n"
                    "  Re-run:  ./run-comparison.sh city.osm.xml baseline.trips.xml cityflow.trips.xml\n"
                )

    summary = read_summary(summary_path)
    trips = read_tripinfo(tripinfo_path)

    if trips is None:
        sys.exit(
            f"✖ {tripinfo_path} contains no completed trips.\n"
            "  Usually this means duarouter skipped every trip because the origin and\n"
            "  destination zones were not connected. Try a larger OpenStreetMap extract."
        )

    return {**summary, **trips}


def show(label, metrics):
    print(f"\n  {label}")
    print(f"    Vehicles departed        {metrics['departed']}")
    print(f"    Mean travel time         {metrics['mean_travel']} s")
    print(f"    Mean waiting time        {metrics['mean_waiting']} s")
    print(f"    Total delay              {metrics['total_delay']} s")
    print(f"    Busiest 15-minute slot   {metrics['peak']} vehicles")


def change(before, after):
    """Percentage change, negative meaning CityFlow AI's day was better."""
    if before == 0:
        return "—"
    return f"{((after - before) / before) * 100:+.1f}%"


def main():
    baseline = collect("baseline")
    cityflow = collect("cityflow")

    print("\n" + "=" * 62)
    print("  SUMO RESULTS — type these into Admin Portal → Simulation")
    print("=" * 62)

    show("BASELINE  (everyone at their usual time)", baseline)
    show("CITYFLOW  (everyone at the recommended time)", cityflow)

    dep_baseline = read_departures("baseline")
    dep_cityflow = read_departures("cityflow")

    if dep_baseline and dep_cityflow:
        print("\n" + "-" * 62)
        print("  PEAK DEPARTURES  — the metric that matches the claim")
        print("-" * 62)
        print(f"    Busiest 15-min window, baseline   {dep_baseline['peak']} departures")
        print(f"    Busiest 15-min window, CityFlow   {dep_cityflow['peak']} departures")
        print(f"    Change                            {change(dep_baseline['peak'], dep_cityflow['peak'])}")
        print()
        print(f"    Share of trips in the 4 busiest windows")
        print(f"      baseline  {dep_baseline['top4_share'] * 100:.1f}%")
        print(f"      CityFlow  {dep_cityflow['top4_share'] * 100:.1f}%")

        show_windows(dep_baseline, dep_cityflow)

    print("\n" + "-" * 62)
    print("  NETWORK EFFECTS  (negative = CityFlow AI's day was better)")
    print("-" * 62)
    print(f"    Vehicles in network at once  {change(baseline['peak'], cityflow['peak'])}")
    print(f"    Mean travel time         {change(baseline['mean_travel'], cityflow['mean_travel'])}")
    print(f"    Mean waiting time        {change(baseline['mean_waiting'], cityflow['mean_waiting'])}")
    print(f"    Total delay              {change(baseline['total_delay'], cityflow['total_delay'])}")

    # The comparison only means anything if both runs carried the same traffic.
    if baseline["vehicles"] != cityflow["vehicles"]:
        print("\n  ⚠️  The two runs completed DIFFERENT numbers of trips")
        print(f"      ({baseline['vehicles']} vs {cityflow['vehicles']}).")
        print("      The comparison is weakened — the runs are not like for like.")
        print("      Usually duarouter skipped different trips in each scenario.")
    else:
        print(f"\n  ✔ Both runs carried the same {baseline['vehicles']} trips.")
        print("    Same travellers, same origins and destinations.")
        print("    The only difference was departure time.")

    print("\n" + "-" * 62)
    print("  HOW TO READ THIS")
    print("-" * 62)
    print("    Zone positions were arbitrary, so ABSOLUTE times mean nothing.")
    print("    Report the change, as a percentage, never the raw seconds.")
    print()
    print("    A change of one or two vehicles is not a result, whatever it")
    print("    looks like as a percentage. Check the raw counts above before")
    print("    quoting any figure.")
    print()
    print("    One simulated day is not a general finding. Repeat it across")
    print("    several days and demand levels before claiming anything.")

    if dep_baseline and dep_cityflow:
        peak_change = dep_cityflow["peak"] - dep_baseline["peak"]
        if peak_change == 0:
            print()
            print("    ⚠ THE PEAK WINDOW DID NOT MOVE.")
            print("      The engine shifted people, but not out of the busiest")
            print("      window. Look at the table above: if the change is")
            print("      happening on the shoulders instead, the likely reasons")
            print("      are that too many people in the peak have already")
            print("      committed to a time (the optimiser never moves those),")
            print("      or their flexibility window does not reach a quieter")
            print("      slot. Both are real findings worth reporting.")

    print()


if __name__ == "__main__":
    main()
