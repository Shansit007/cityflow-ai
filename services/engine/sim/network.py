import subprocess
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

from core.capacity import ROAD_CLASSES

# Priority tells SUMO which approach wins at an unsignalised junction. Ordering the
# classes by importance is what stops a residential lane being given right of way over
# an arterial, which would make every junction behave nothing like the real one.
PRIORITY = {
    "motorway": 13,
    "motorway_link": 12,
    "trunk": 11,
    "trunk_link": 10,
    "primary": 9,
    "primary_link": 8,
    "secondary": 7,
    "secondary_link": 6,
    "tertiary": 5,
    "tertiary_link": 4,
    "unclassified": 3,
    "residential": 2,
    "living_street": 1,
    "service": 1,
}


@dataclass(frozen=True)
class PlainEdge:
    edge_id: str
    from_node: int
    to_node: int
    highway_class: str
    lanes: int
    length_m: float


@dataclass(frozen=True)
class PlainNode:
    node_id: int
    x: float
    y: float


def edge_id(osm_way_id: int, from_node: int, to_node: int) -> str:
    """Unique per directed edge: parallel ways between the same pair are distinct."""
    return f"{osm_way_id}#{from_node}-{to_node}"


def write_nodes(nodes: list[PlainNode], path: Path) -> None:
    root = ET.Element("nodes")
    for node in nodes:
        ET.SubElement(
            root,
            "node",
            id=str(node.node_id),
            x=f"{node.x:.2f}",
            y=f"{node.y:.2f}",
        )
    _write(root, path)


def write_edges(edges: list[PlainEdge], path: Path) -> None:
    root = ET.Element("edges")
    for edge in edges:
        road = ROAD_CLASSES[edge.highway_class]
        ET.SubElement(
            root,
            "edge",
            id=edge.edge_id,
            attrib={"from": str(edge.from_node), "to": str(edge.to_node)},
            numLanes=str(edge.lanes),
            speed=f"{road.free_flow_kph / 3.6:.2f}",
            priority=str(PRIORITY[edge.highway_class]),
            length=f"{edge.length_m:.2f}",
            type=edge.highway_class,
        )
    _write(root, path)


def _write(root: ET.Element, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)


class NetconvertFailed(RuntimeError):
    pass


def run_netconvert(nodes: Path, edges: Path, output: Path) -> str:
    """
    Builds the SUMO network. Junction joining matters more than it looks: an OSM
    intersection is often several nodes a few metres apart, and left as-is SUMO creates
    a cluster of tiny junctions that deadlock under load.
    """
    command = [
        "netconvert",
        f"--node-files={nodes}",
        f"--edge-files={edges}",
        f"--output-file={output}",
        "--junctions.join",
        "--junctions.join-dist=12",
        "--tls.guess",
        "--tls.guess.threshold=25",
        "--tls.join",
        "--tls.default-type=static",
        "--no-turnarounds",
        "--remove-edges.isolated",
        "--geometry.remove",
        "--no-warnings",
    ]

    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise NetconvertFailed(
            result.stderr.strip() or "netconvert failed without writing an error"
        )

    return result.stdout.strip()


@dataclass(frozen=True)
class NetworkSummary:
    edges: int
    junctions: int
    traffic_lights: int
    lane_metres: float


def summarise(net_file: Path) -> NetworkSummary:
    """
    Counts what netconvert actually produced, streaming rather than loading the file.

    Internal edges and junctions — the ones SUMO invents inside an intersection, whose
    ids begin with a colon — are excluded, because counting them would inflate the
    network by roughly the number of turning movements and make it look far larger than
    the road system it represents.
    """
    edges = junctions = traffic_lights = 0
    lane_metres = 0.0

    for _, element in ET.iterparse(net_file, events=("end",)):
        tag = element.tag
        if tag == "edge":
            if not element.get("id", "").startswith(":"):
                edges += 1
                for lane in element.findall("lane"):
                    lane_metres += float(lane.get("length", 0.0))
        elif tag == "junction":
            if not element.get("id", "").startswith(":"):
                junctions += 1
                if element.get("type") == "traffic_light":
                    traffic_lights += 1
        else:
            continue
        element.clear()

    return NetworkSummary(
        edges=edges,
        junctions=junctions,
        traffic_lights=traffic_lights,
        lane_metres=round(lane_metres, 1),
    )
