from collections.abc import Iterable
from dataclasses import dataclass

from core.capacity import ROAD_CLASSES, segment_capacity_vph
from core.fleet import FleetMix

# Lane counts when OSM does not tag them, which is the majority of edges in an Indian
# extract. Taking the class default is a guess; taking zero would drop the road.
DEFAULT_LANES: dict[str, int] = {
    "motorway": 3,
    "motorway_link": 1,
    "trunk": 3,
    "trunk_link": 1,
    "primary": 2,
    "primary_link": 1,
    "secondary": 2,
    "secondary_link": 1,
    "tertiary": 2,
    "tertiary_link": 1,
    "unclassified": 1,
    "residential": 1,
    "living_street": 1,
    "service": 1,
}


@dataclass(frozen=True)
class Segment:
    osm_way_id: int
    from_node: int
    to_node: int
    highway_class: str
    lanes: int
    length_m: float
    capacity_vph: int
    lanes_tagged: bool
    wkt: str


def first_value(value: object) -> object:
    """
    OSM tags arrive as a list whenever adjacent ways were merged into one edge. Taking
    the first is the convention osmnx itself documents; it is a simplification, and a
    merged edge spanning a class change is recorded as the class it starts in.
    """
    if isinstance(value, list):
        return value[0] if value else None
    return value


def resolve_lanes(raw: object, highway_class: str, *, oneway: bool) -> tuple[int, bool]:
    """Returns the per-direction lane count and whether OSM actually supplied it."""
    value = first_value(raw)
    lanes: int | None = None

    if value is not None:
        try:
            lanes = int(float(str(value)))
        except (TypeError, ValueError):
            lanes = None

    if lanes is None or lanes < 1:
        return DEFAULT_LANES.get(highway_class, 1), False

    # OSM records the lane count of the whole carriageway. A two-way street splits it.
    return (lanes if oneway else max(1, lanes // 2)), True


def coerce_highway(raw: object) -> str | None:
    value = first_value(raw)
    if not isinstance(value, str):
        return None
    return value if value in ROAD_CLASSES else None


def coerce_way_id(raw: object) -> int | None:
    value = first_value(raw)
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def build_segment(
    from_node: int,
    to_node: int,
    attributes: dict[str, object],
    coordinates: Iterable[tuple[float, float]],
    fleet: FleetMix,
) -> Segment | None:
    """Returns None for an edge the capacity model has no parameters for."""
    highway_class = coerce_highway(attributes.get("highway"))
    if highway_class is None:
        return None

    way_id = coerce_way_id(attributes.get("osmid"))
    if way_id is None:
        return None

    length = attributes.get("length")
    if not isinstance(length, int | float) or length <= 0:
        return None

    oneway = bool(first_value(attributes.get("oneway")))
    lanes, lanes_tagged = resolve_lanes(
        attributes.get("lanes"), highway_class, oneway=oneway
    )

    points = ", ".join(f"{lon} {lat}" for lon, lat in coordinates)
    if not points:
        return None

    return Segment(
        osm_way_id=way_id,
        from_node=from_node,
        to_node=to_node,
        highway_class=highway_class,
        lanes=lanes,
        length_m=round(float(length), 2),
        capacity_vph=segment_capacity_vph(highway_class, lanes, fleet),
        lanes_tagged=lanes_tagged,
        wkt=f"LINESTRING({points})",
    )
