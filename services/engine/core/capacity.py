from dataclasses import dataclass

from core.fleet import FleetMix


# Saturation flow is the rate vehicles discharge from a standing queue when the
# signal is green, in PCU per hour per lane. Green ratio is effective green over
# cycle length: a road is only usable for the share of time its signals let traffic
# through, and that is what separates an arterial's raw discharge rate from the flow
# it can actually carry. Values follow Indo-HCM (CSIR-CRRI, 2017) for Indian urban
# roads; the green ratios are class-typical, not measured at any specific junction.
@dataclass(frozen=True)
class RoadClass:
    saturation_flow: int
    green_ratio: float


ROAD_CLASSES: dict[str, RoadClass] = {
    "motorway": RoadClass(saturation_flow=2000, green_ratio=1.00),
    "motorway_link": RoadClass(saturation_flow=1800, green_ratio=1.00),
    "trunk": RoadClass(saturation_flow=1900, green_ratio=0.85),
    "trunk_link": RoadClass(saturation_flow=1700, green_ratio=0.85),
    "primary": RoadClass(saturation_flow=1800, green_ratio=0.45),
    "primary_link": RoadClass(saturation_flow=1600, green_ratio=0.45),
    "secondary": RoadClass(saturation_flow=1700, green_ratio=0.45),
    "secondary_link": RoadClass(saturation_flow=1500, green_ratio=0.45),
    "tertiary": RoadClass(saturation_flow=1600, green_ratio=0.40),
    "tertiary_link": RoadClass(saturation_flow=1400, green_ratio=0.40),
    "unclassified": RoadClass(saturation_flow=1400, green_ratio=0.35),
    "residential": RoadClass(saturation_flow=1400, green_ratio=0.35),
    "living_street": RoadClass(saturation_flow=900, green_ratio=0.30),
    "service": RoadClass(saturation_flow=800, green_ratio=0.30),
}

STANDARD_LANE_WIDTH_M = 3.658

# HCM 6th edition lane-width adjustment, converted from feet. Clamped because the
# linear form stops being meaningful outside the range it was fitted over, and OSM
# width tags include both typos and genuinely unusual geometry.
MIN_WIDTH_FACTOR = 0.85
MAX_WIDTH_FACTOR = 1.10


class UnknownRoadClass(ValueError):
    pass


def lane_width_factor(width_m: float) -> float:
    if width_m <= 0:
        raise ValueError(f"Lane width must be positive, got {width_m}.")
    factor = 1.0 + (width_m - STANDARD_LANE_WIDTH_M) / 9.144
    return min(max(factor, MIN_WIDTH_FACTOR), MAX_WIDTH_FACTOR)


def segment_capacity_pcu(
    highway_class: str,
    lanes: int,
    lane_width_m: float = STANDARD_LANE_WIDTH_M,
) -> float:
    """Capacity in PCU per hour: lanes x saturation flow x width factor x green ratio."""
    if lanes < 1:
        raise ValueError(f"A segment must have at least one lane, got {lanes}.")

    road = ROAD_CLASSES.get(highway_class)
    if road is None:
        raise UnknownRoadClass(
            f"No capacity parameters for highway class {highway_class!r}."
        )

    return (
        lanes * road.saturation_flow * lane_width_factor(lane_width_m) * road.green_ratio
    )


def segment_capacity_vph(
    highway_class: str,
    lanes: int,
    fleet: FleetMix,
    lane_width_m: float = STANDARD_LANE_WIDTH_M,
) -> int:
    """
    Capacity in vehicles per hour, which is what the allocator counts.

    The PCU figure is divided by the average vehicle's PCU. In a stream that is mostly
    two-wheelers the average vehicle is well under one PCU, so a road carries more
    vehicles per hour than its PCU capacity — ignoring this understates Indian urban
    capacity by roughly a third, and would make the allocator shift people who did not
    need to move.
    """
    pcu = segment_capacity_pcu(highway_class, lanes, lane_width_m)
    return round(pcu / fleet.mean_pcu())
