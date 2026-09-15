import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from core.allocator import PlannedTrip, SlotLedger
from core.cities import City
from sim.demand import SECONDS_PER_MINUTE, demand_draw
from sim.edges import EdgeProfile, load_profiles, offsets_for


@dataclass(frozen=True)
class Journey:
    """One routed traveller, with everything the allocator needs except adoption."""

    trip_id: str
    path: tuple[str, ...]
    offsets_s: tuple[int, ...]
    preferred_departure_s: int
    flexibility_minutes: int
    participation_draw: float

    def planned(self, adoption: float) -> PlannedTrip:
        """
        The same journey, seen at one adoption level.

        Adoption changes only whether the allocator may move this traveller, which is
        why the sweep builds journeys once and re-plans them per level rather than
        re-reading a 350 MB route file seven times.
        """
        slack = self.flexibility_minutes * SECONDS_PER_MINUTE

        return PlannedTrip(
            trip_id=self.trip_id,
            identity=self.trip_id,
            path=self.path,
            offsets_s=self.offsets_s,
            preferred_departure_s=self.preferred_departure_s,
            earliest_departure_s=self.preferred_departure_s - slack,
            latest_departure_s=self.preferred_departure_s + slack,
            movable=self.participation_draw < adoption and self.flexibility_minutes > 0,
        )


def hhmm(value: str) -> int:
    hours, _, minutes = value.partition(":")
    return int(hours) * 3600 + int(minutes or 0) * 60


def load_network(city: City, target: Path) -> dict[str, EdgeProfile]:
    return load_profiles(
        target / "city.net.xml", target / "edges.profile.json", city.fleet
    )


def load_journeys(
    target: Path, begin_s: int, end_s: int, share: float, profiles: dict
) -> list[Journey]:
    """
    Every routed traveller whose habitual departure falls in the window.

    Reads the full routed file rather than the cohort file a simulation writes, so this
    works before any simulation has been run - the point of measuring capacity directly
    is to find out whether a simulation is worth starting.
    """
    people = {
        person["trip_id"]: person
        for person in json.loads((target / "population.json").read_text())
        if begin_s <= person["habitual_departure_s"] < end_s
        and demand_draw(person["trip_id"]) < share
    }

    journeys: list[Journey] = []
    routed = 0

    for _, element in ET.iterparse(target / "baseline.rou.xml", events=("end",)):
        # Only vehicles are cleared, never their children. A <route>'s end event fires
        # before its parent vehicle's, so clearing it here strips the edges attribute
        # the vehicle is about to be asked for, and every journey comes back with an
        # empty path - silently, because an empty path is a valid thing to skip.
        if element.tag != "vehicle":
            continue

        routed += 1
        person = people.get(element.get("id", ""))
        route = element.find("route")

        if person is not None and route is not None:
            path = tuple(route.get("edges", "").split())
            if path:
                journeys.append(
                    Journey(
                        trip_id=person["trip_id"],
                        path=path,
                        offsets_s=offsets_for(list(path), profiles),
                        preferred_departure_s=person["habitual_departure_s"],
                        flexibility_minutes=person["flexibility_minutes"],
                        participation_draw=person["participation_draw"],
                    )
                )

        element.clear()

    if people and not journeys:
        raise ValueError(
            f"{len(people)} travellers depart in this window but none of the "
            f"{routed} routed vehicles matched one with a path. The population and "
            f"the route file are probably from different runs of build_demand."
        )

    return journeys


def load_ledger(
    trips: list[PlannedTrip], capacity: dict[str, int], departures: dict[str, int] | None
) -> SlotLedger:
    chosen = departures or {}
    ledger = SlotLedger(capacity)

    for trip in trips:
        ledger.commit(trip, chosen.get(trip.trip_id, trip.preferred_departure_s))

    return ledger
