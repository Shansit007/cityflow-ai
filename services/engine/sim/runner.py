import subprocess
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

SLOT_SECONDS = 15 * 60


class SumoFailed(RuntimeError):
    pass


@dataclass(frozen=True)
class RunMetrics:
    completed: int
    teleported: int
    mean_duration_s: float
    mean_delay_s: float
    total_delay_hours: float
    peak_departures: int
    departures_by_slot: dict[int, int]

    def as_dict(self) -> dict[str, object]:
        return {
            "completed": self.completed,
            "teleported": self.teleported,
            "mean_duration_s": round(self.mean_duration_s, 1),
            "mean_delay_s": round(self.mean_delay_s, 1),
            "total_delay_hours": round(self.total_delay_hours, 1),
            "peak_departures": self.peak_departures,
        }


def run_sumo(
    net_file: Path, routes: Path, tripinfo: Path, statistics: Path, seed: int
) -> None:
    """
    Runs one scenario to completion.

    time-to-teleport is left at SUMO's default rather than disabled. A vehicle stuck for
    five minutes is removed and counted, which keeps a gridlocked run from never ending;
    the teleport count is reported because a run with many of them is describing
    breakdown rather than congestion and its averages cannot be compared to a run
    without them.
    """
    command = [
        "sumo",
        f"--net-file={net_file}",
        f"--route-files={routes}",
        f"--tripinfo-output={tripinfo}",
        f"--statistic-output={statistics}",
        f"--seed={seed}",
        "--ignore-route-errors",
        "--no-warnings",
        "--duration-log.statistics",
        "--verbose",
    ]

    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        raise SumoFailed(f"sumo exited with status {result.returncode}")


def read_teleports(statistics: Path) -> int:
    """
    Vehicles SUMO removed because they were stuck.

    Reported separately from the trip output because it is a validity check, not a
    result: a run with many teleports has broken down rather than congested, and its
    averages are not comparable with a run that has none.
    """
    root = ET.parse(statistics).getroot()
    element = root.find("teleports")
    return int(element.get("total", 0)) if element is not None else 0


def read_metrics(tripinfo: Path, statistics: Path) -> RunMetrics:
    """
    Reads the per-trip output.

    Delay is timeLoss: the seconds a vehicle lost relative to travelling its own route
    unobstructed. It is the right measure here because trips differ in length, so raw
    duration would mostly reflect how far people went rather than how badly they were
    held up.
    """
    completed = 0
    duration_total = 0.0
    delay_total = 0.0
    departures: dict[int, int] = {}

    for _, element in ET.iterparse(tripinfo, events=("end",)):
        if element.tag != "tripinfo":
            continue

        completed += 1
        duration_total += float(element.get("duration", 0.0))
        delay_total += float(element.get("timeLoss", 0.0))

        slot = int(float(element.get("depart", 0.0))) // SLOT_SECONDS
        departures[slot] = departures.get(slot, 0) + 1

        element.clear()

    if completed == 0:
        raise ValueError(f"{tripinfo} contains no completed trips.")

    return RunMetrics(
        completed=completed,
        teleported=read_teleports(statistics),
        mean_duration_s=duration_total / completed,
        mean_delay_s=delay_total / completed,
        total_delay_hours=delay_total / 3600.0,
        peak_departures=max(departures.values()),
        departures_by_slot=departures,
    )
