import os
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

import networkx as nx

from core.fleet import FleetMix
from sim.demand import Endpoint, Traveller
from sim.vehicles import write_vtypes

# Trips begin and end where people are, which is not on a motorway shoulder. Limiting
# endpoints to street classes keeps the demand plausible; arterials still carry the
# traffic, they just are not where a journey starts.
ENDPOINT_CLASSES = frozenset(
    {
        "residential",
        "living_street",
        "unclassified",
        "tertiary",
        "secondary",
    }
)

# Very short edges are usually junction stubs. Starting a trip on one produces vehicles
# that teleport or fail to insert, which shows up later as missing trips in the results.
MIN_ENDPOINT_LENGTH_M = 30.0


class DuarouterFailed(RuntimeError):
    pass


def collect_endpoints(net_file: Path) -> list[Endpoint]:
    """
    Candidate trip endpoints, each with its position on the network.

    Restricted to the largest strongly connected component. Without that, 13% of a
    50,000-trip population was unroutable and silently dropped, leaving a baseline
    that claimed 50,000 trips while measuring the well-connected subset of them. A
    trip is only meaningful if a vehicle can actually drive it both ways round the
    network, which is what strong connectivity means here.
    """
    reachable = _largest_component(net_file)
    endpoints: list[Endpoint] = []

    for _, element in ET.iterparse(net_file, events=("end",)):
        if element.tag != "edge":
            continue

        edge_id = element.get("id", "")
        if (
            not edge_id.startswith(":")
            and edge_id in reachable
            and element.get("type") in ENDPOINT_CLASSES
        ):
            lanes = element.findall("lane")
            length = sum(float(lane.get("length", 0.0)) for lane in lanes)
            position = _midpoint(lanes)
            if length >= MIN_ENDPOINT_LENGTH_M and position is not None:
                endpoints.append(
                    Endpoint(
                        edge_id=edge_id,
                        x=position[0],
                        y=position[1],
                        length_m=length,
                    )
                )

        element.clear()

    return endpoints


def _midpoint(lanes: list[ET.Element]) -> tuple[float, float] | None:
    """
    Where an edge sits, as the midpoint of its first lane's end-to-end line.

    A gravity model buckets endpoints into 500 m cells, so following the lane's real
    geometry would change nothing and cost a parse of every shape point.
    """
    for lane in lanes:
        shape = lane.get("shape", "").split()
        if len(shape) < 2:
            continue
        try:
            start_x, start_y = (float(v) for v in shape[0].split(",")[:2])
            end_x, end_y = (float(v) for v in shape[-1].split(",")[:2])
        except ValueError:
            continue
        return (start_x + end_x) / 2, (start_y + end_y) / 2
    return None


def _largest_component(net_file: Path) -> set[str]:
    """
    The biggest set of edges mutually reachable by road.

    Built from the network's connection elements, which say which edge a vehicle may
    move onto from which. One-way streets make this a directed problem: two edges on
    opposite sides of a divided road are metres apart and may still be an hour apart
    by car.
    """
    graph = nx.DiGraph()

    for _, element in ET.iterparse(net_file, events=("end",)):
        if element.tag == "connection":
            source = element.get("from", "")
            target = element.get("to", "")
            if source and target and not source.startswith(":"):
                graph.add_edge(source, target)
        element.clear()

    if graph.number_of_nodes() == 0:
        raise ValueError(f"{net_file} contains no edge connections.")

    return max(nx.strongly_connected_components(graph), key=len)


def write_trips(
    travellers: list[Traveller],
    departures: dict[str, int],
    path: Path,
    fleet: FleetMix,
) -> None:
    """
    Writes SUMO trip definitions, preceded by the vehicle types they refer to.

    `departures` maps trip id to departure second, so the same population can be written
    once at its habitual times and again at whatever the allocator chose. Everything
    else about the trip is identical between the two runs, which is what makes the
    comparison a controlled experiment rather than two different simulations.
    """
    root = ET.Element("routes")
    write_vtypes(root, fleet)

    ordered = sorted(travellers, key=lambda t: departures[t.trip_id])
    for traveller in ordered:
        ET.SubElement(
            root,
            "trip",
            id=traveller.trip_id,
            type=traveller.vehicle_type,
            depart=f"{departures[traveller.trip_id]}.00",
            attrib={"from": traveller.origin_edge, "to": traveller.destination_edge},
            departLane="best",
            departSpeed="max",
        )

    path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)


def run_duarouter(
    net_file: Path, trips: Path, routes: Path, seed: int, threads: int | None = None
) -> None:
    """
    Turns origin-destination pairs into routes.

    ignore-errors stays on as a safety net, but endpoints are already restricted to the
    strongly connected component, so a large unroutable count now means something is
    wrong rather than something is expected. The surviving count is always reported.

    Routing 50k pairs is the slowest step in the pipeline and is embarrassingly parallel
    across trips, so it uses the machine's cores rather than one of them.
    """
    command = [
        "duarouter",
        f"--net-file={net_file}",
        f"--route-files={trips}",
        f"--output-file={routes}",
        f"--seed={seed}",
        f"--routing-threads={threads or max(1, (os.cpu_count() or 2) - 1)}",
        "--ignore-errors",
        "--repair",
        "--no-warnings",
        # Without progress output a slow run and a hung one look identical, so step
        # logging stays on and is streamed.
        "--verbose",
    ]

    result = subprocess.run(command, check=False)
    if result.returncode != 0:
        raise DuarouterFailed(f"duarouter exited with status {result.returncode}")


def count_routes(routes: Path) -> int:
    total = 0
    for _, element in ET.iterparse(routes, events=("end",)):
        if element.tag == "vehicle":
            total += 1
        element.clear()
    return total


def filter_routes(
    source: Path, destination: Path, keep: set[str], fleet: FleetMix
) -> int:
    """
    Writes out only the vehicles in `keep`, preserving their routes.

    The measured cohort is fixed by habitual departure and stays the same in every run
    of a comparison. Selecting instead by whether a trip happened to finish inside a
    simulated window would let the allocator change the cohort by moving people across
    the boundary, and the runs would no longer be measuring the same population.

    Vehicle types are re-emitted from the current definitions rather than copied from
    the routed file. Routing takes four minutes and only depends on a type's vClass,
    so inheriting the rest would mean re-routing 50,000 journeys to change a braking
    parameter. The cohort file is rebuilt on every run anyway.
    """
    root = ET.Element("routes")
    write_vtypes(root, fleet)
    written = 0

    for _, element in ET.iterparse(source, events=("end",)):
        if element.tag == "vehicle":
            if element.get("id", "") in keep:
                root.append(_copy(element))
                written += 1
            element.clear()

    destination.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(destination, encoding="utf-8", xml_declaration=True)
    return written


def _copy(element: ET.Element) -> ET.Element:
    clone = ET.Element(element.tag, dict(element.attrib))
    for child in element:
        clone.append(ET.Element(child.tag, dict(child.attrib)))
    return clone
