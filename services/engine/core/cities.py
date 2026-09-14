from dataclasses import dataclass

from core.fleet import INDIAN_URBAN_PEAK, FleetMix


@dataclass(frozen=True)
class BoundingBox:
    west: float
    south: float
    east: float
    north: float

    def __post_init__(self) -> None:
        if self.west >= self.east or self.south >= self.north:
            raise ValueError(f"Degenerate bounding box: {self}.")


@dataclass(frozen=True)
class Attractor:
    """A place people travel to in the morning and away from in the evening."""

    name: str
    lon: float
    lat: float
    # Relative pull, not jobs. The ratios say which district draws more of the peak
    # than which, which is what shapes the flow; absolute employment would need a
    # census and would not change the allocation.
    weight: float


# Approximate centroids of Bengaluru's main commercial and office districts, placed
# from their well-known locations rather than from an employment survey, and limited
# to the ones inside the extract: Whitefield and Electronic City are the city's two
# largest employment centres and both fall outside this bounding box, so the morning
# tide modelled here is the one into the central districts only.
BENGALURU_ATTRACTORS = (
    Attractor("MG Road and central business district", 77.6100, 12.9750, 1.00),
    Attractor("Koramangala", 77.6220, 12.9350, 0.90),
    Attractor("Indiranagar", 77.6400, 12.9720, 0.70),
    Attractor("Domlur and Old Airport Road", 77.6380, 12.9620, 0.60),
    Attractor("Rajajinagar and Malleswaram", 77.5700, 12.9950, 0.50),
    Attractor("Jayanagar", 77.5830, 12.9250, 0.50),
)


@dataclass(frozen=True)
class City:
    code: str
    name: str
    bbox: BoundingBox
    centroid_lon: float
    centroid_lat: float
    fleet: FleetMix = INDIAN_URBAN_PEAK
    timezone: str = "Asia/Kolkata"
    # Empty for every city but Bengaluru, which is the one this project simulates.
    # Without attractors the demand model spreads destinations by street length alone,
    # which produces a city with no centre: journeys scatter, no segment ever reaches
    # capacity, and there is nothing for a departure-time allocator to relieve. That is
    # not a hypothetical - it is what the first three baselines measured.
    attractors: tuple[Attractor, ...] = ()


# Boxes cover the dense core of each city rather than its municipal boundary. A whole
# metropolitan extract is mostly low-demand periphery that slows every simulation run
# without changing the peak, which is the thing being measured.
CITIES: dict[str, City] = {
    "BLR": City(
        code="BLR",
        name="Bengaluru",
        bbox=BoundingBox(west=77.54, south=12.91, east=77.68, north=13.03),
        centroid_lon=77.5946,
        centroid_lat=12.9716,
        attractors=BENGALURU_ATTRACTORS,
    ),
    "PNQ": City(
        code="PNQ",
        name="Pune",
        bbox=BoundingBox(west=73.80, south=18.46, east=73.93, north=18.57),
        centroid_lon=73.8567,
        centroid_lat=18.5204,
    ),
    "HYD": City(
        code="HYD",
        name="Hyderabad",
        bbox=BoundingBox(west=78.38, south=17.36, east=78.52, north=17.47),
        centroid_lon=78.4867,
        centroid_lat=17.3850,
    ),
    "DEL": City(
        code="DEL",
        name="Delhi",
        bbox=BoundingBox(west=77.16, south=28.55, east=77.30, north=28.67),
        centroid_lon=77.2090,
        centroid_lat=28.6139,
    ),
}


def get_city(code: str) -> City:
    city = CITIES.get(code.upper())
    if city is None:
        known = ", ".join(sorted(CITIES))
        raise KeyError(f"Unknown city {code!r}. Known cities: {known}.")
    return city
