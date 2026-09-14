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
class City:
    code: str
    name: str
    bbox: BoundingBox
    centroid_lon: float
    centroid_lat: float
    fleet: FleetMix = INDIAN_URBAN_PEAK
    timezone: str = "Asia/Kolkata"


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
