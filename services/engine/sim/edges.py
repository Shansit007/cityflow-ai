import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from core.capacity import ROAD_CLASSES, segment_capacity_vph
from core.fleet import FleetMix


@dataclass(frozen=True)
class EdgeProfile:
    """What the allocator needs to know about one segment of the built network."""

    length_m: float
    speed_ms: float
    lanes: int
    highway_class: str
    capacity_vph: int

    @property
    def free_flow_s(self) -> float:
        return self.length_m / self.speed_ms


def read_profiles(net_file: Path, fleet: FleetMix) -> dict[str, EdgeProfile]:
    """
    Capacity and free-flow traversal time for every segment, read from the network.

    Taken from the built network rather than the database on purpose: these have to be
    the lane counts and classes netconvert actually produced, not the ones it was
    offered. It drops edges during junction joining, and a capacity table that still
    describes them would have the allocator budgeting for roads that do not exist.
    """
    profiles: dict[str, EdgeProfile] = {}

    for _, element in ET.iterparse(net_file, events=("end",)):
        if element.tag != "edge":
            continue

        edge_id = element.get("id", "")
        highway_class = element.get("type", "")
        lanes = element.findall("lane")

        if not edge_id.startswith(":") and highway_class in ROAD_CLASSES and lanes:
            speed = float(lanes[0].get("speed", 0.0))
            length = float(lanes[0].get("length", 0.0))
            if speed > 0 and length > 0:
                profiles[edge_id] = EdgeProfile(
                    length_m=length,
                    speed_ms=speed,
                    lanes=len(lanes),
                    highway_class=highway_class,
                    capacity_vph=segment_capacity_vph(highway_class, len(lanes), fleet),
                )

        element.clear()

    if not profiles:
        raise ValueError(f"{net_file} yielded no usable edges.")

    return profiles


def load_profiles(net_file: Path, cache: Path, fleet: FleetMix) -> dict[str, EdgeProfile]:
    """
    Reads the cache, building it from the network first if it is not there.

    Streaming a 200 MB network costs a minute and the answer only changes when the
    network or the capacity model does, which is rarely and never mid-experiment.
    """
    if cache.exists():
        raw = json.loads(cache.read_text())
        return {edge: EdgeProfile(**values) for edge, values in raw.items()}

    profiles = read_profiles(net_file, fleet)
    cache.write_text(
        json.dumps(
            {
                edge: {
                    "length_m": p.length_m,
                    "speed_ms": p.speed_ms,
                    "lanes": p.lanes,
                    "highway_class": p.highway_class,
                    "capacity_vph": p.capacity_vph,
                }
                for edge, p in profiles.items()
            }
        )
    )
    return profiles


def offsets_for(path: list[str], profiles: dict[str, EdgeProfile]) -> tuple[int, ...]:
    """
    Seconds from departure to entering each edge of a route, at free-flow speed.

    Free flow is an approximation and it errs in a known direction: under congestion a
    vehicle reaches a downstream segment later than this says, so the allocator's view
    of when a trip loads the far end of its route is optimistic. It is the right
    starting point anyway, because the alternative is circular — how long the journey
    takes depends on the departure times being chosen. docs/engine.md records the bias
    and what replacing it with measured per-interval speeds would take.
    """
    offsets: list[int] = []
    elapsed = 0.0

    for edge in path:
        offsets.append(int(elapsed))
        profile = profiles.get(edge)
        if profile is not None:
            elapsed += profile.free_flow_s

    return tuple(offsets)
