import math
import random
from bisect import bisect_right
from dataclasses import dataclass
from itertools import accumulate

from core.fleet import FleetMix
from sim.vehicles import sample_type

SECONDS_PER_MINUTE = 60
DAY_SECONDS = 24 * 60 * 60


@dataclass(frozen=True)
class Endpoint:
    """A place a journey can start or finish: one street edge and where it sits."""

    edge_id: str
    x: float
    y: float
    length_m: float


@dataclass(frozen=True)
class PeakShape:
    """One travel purpose: when people want to leave, and how spread out they are."""

    centre_s: int
    spread_s: int
    share: float


# Indian metro commuting is sharply bimodal, with the evening peak flatter than the
# morning one because departure home is less tightly bound to a fixed start time.
# Centres and spreads are modelling choices, not counts; docs/engine.md says so and
# the parameter sweep varies them.
MORNING = PeakShape(
    centre_s=8 * 3600 + 45 * 60,
    spread_s=50 * SECONDS_PER_MINUTE,
    share=0.55,
)
EVENING = PeakShape(
    centre_s=18 * 3600 + 30 * 60,
    spread_s=70 * SECONDS_PER_MINUTE,
    share=0.45,
)

# How much slack travellers have. The share with none is the ceiling on what any
# departure-shifting system can achieve, which makes it the most consequential
# assumption in the whole model.
FLEXIBILITY_MINUTES: dict[int, float] = {
    0: 0.25,
    15: 0.35,
    30: 0.25,
    45: 0.15,
}

# Origin-destination sampling. Endpoints are bucketed into square cells and a journey
# picks a destination cell, then an edge inside it. The cell is the unit because a
# per-edge gravity draw over ~95k candidates costs 95k operations per trip; a per-cell
# draw costs a few hundred and the distribution it approximates is the same one.
CELL_M = 500.0

# Deterrence parameter of the gravity model, in metres: the distance over which the
# attractiveness of a destination falls by a factor of e. 4.5 km reproduces a mean
# network trip length in the 7-8 km range for a city core of this size, which is the
# order of magnitude Indian metro commute surveys report. Sampling destinations
# uniformly instead — as this model first did — produced 11.6 km mean journeys and a
# baseline that gridlocked on vehicle-kilometres rather than on peaking.
DECAY_M = 4500.0


@dataclass(frozen=True)
class Traveller:
    trip_id: str
    origin_edge: str
    destination_edge: str
    habitual_departure_s: int
    flexibility_minutes: int
    vehicle_type: str
    # A fixed draw in [0, 1) rather than a yes/no flag. Whether this person uses the
    # app is then `draw < adoption`, which makes the 5% cohort a strict subset of the
    # 20% cohort. Re-drawing per level would change who participates as well as how
    # many, and the sweep could no longer attribute a difference to adoption alone.
    participation_draw: float

    @property
    def earliest_departure_s(self) -> int:
        return self.habitual_departure_s - self.flexibility_minutes * SECONDS_PER_MINUTE

    @property
    def latest_departure_s(self) -> int:
        return self.habitual_departure_s + self.flexibility_minutes * SECONDS_PER_MINUTE

    def participates(self, adoption: float) -> bool:
        return self.participation_draw < adoption

    def movable(self, adoption: float) -> bool:
        """A trip the allocator is allowed to shift at this adoption level."""
        return self.participates(adoption) and self.flexibility_minutes > 0


def _sample_departure(rng: random.Random) -> int:
    peak = MORNING if rng.random() < MORNING.share else EVENING
    drawn = int(rng.gauss(peak.centre_s, peak.spread_s))
    return max(0, min(DAY_SECONDS - 1, drawn))


def _sample_flexibility(rng: random.Random) -> int:
    minutes = list(FLEXIBILITY_MINUTES)
    weights = [FLEXIBILITY_MINUTES[m] for m in minutes]
    return rng.choices(minutes, weights=weights, k=1)[0]


@dataclass(frozen=True)
class _Cell:
    key: tuple[int, int]
    centre_x: float
    centre_y: float
    attraction: float
    edges: list[str]
    cumulative_length: list[float]


class _Geography:
    """
    Endpoints bucketed by location, with a cached gravity distribution per origin cell.

    Every trip starting in the same cell faces the same distribution over destinations,
    so it is built once per origin cell rather than once per trip. With a few hundred
    occupied cells that turns the dominant cost of generation into a binary search.
    """

    def __init__(self, endpoints: list[Endpoint]) -> None:
        grouped: dict[tuple[int, int], list[Endpoint]] = {}
        for endpoint in endpoints:
            key = (int(endpoint.x // CELL_M), int(endpoint.y // CELL_M))
            grouped.setdefault(key, []).append(endpoint)

        self.cells: list[_Cell] = []
        for key, members in sorted(grouped.items()):
            lengths = [m.length_m for m in members]
            total = sum(lengths)
            self.cells.append(
                _Cell(
                    key=key,
                    centre_x=(key[0] + 0.5) * CELL_M,
                    centre_y=(key[1] + 0.5) * CELL_M,
                    # Street length in a cell stands in for how many journeys begin or
                    # end there. It is a proxy for built-up density, not a land-use
                    # model: a residential grid and an equally dense office district
                    # are indistinguishable to it.
                    attraction=total,
                    edges=[m.edge_id for m in members],
                    cumulative_length=list(accumulate(lengths)),
                )
            )

        self.origin_cumulative = list(accumulate(c.attraction for c in self.cells))
        self._destinations: dict[int, list[float]] = {}

    def destination_cumulative(self, origin_index: int) -> list[float]:
        cached = self._destinations.get(origin_index)
        if cached is not None:
            return cached

        origin = self.cells[origin_index]
        weights: list[float] = []
        for cell in self.cells:
            dx = cell.centre_x - origin.centre_x
            dy = cell.centre_y - origin.centre_y
            distance = math.hypot(dx, dy)
            weights.append(cell.attraction * math.exp(-distance / DECAY_M))

        cumulative = list(accumulate(weights))
        self._destinations[origin_index] = cumulative
        return cumulative


def _pick(rng: random.Random, cumulative: list[float]) -> int:
    return bisect_right(cumulative, rng.random() * cumulative[-1])


def generate(
    endpoints: list[Endpoint],
    count: int,
    seed: int,
    fleet: FleetMix,
) -> list[Traveller]:
    """
    Builds a synthetic travelling population, independent of adoption level.

    One population serves the whole sweep. Non-participants keep their habitual
    departure and form background load the allocator plans around rather than
    controls, which is the difference between a believable result and one that assumes
    the system owns the whole road.
    """
    if len(endpoints) < 2:
        raise ValueError("Need at least two candidate endpoints to build trips.")
    if count < 1:
        raise ValueError(f"Trip count must be positive, got {count}.")

    geography = _Geography(endpoints)
    if len(geography.cells) < 2:
        raise ValueError("All endpoints fall in one cell; no journeys to model.")

    rng = random.Random(seed)
    travellers: list[Traveller] = []

    for index in range(count):
        origin, destination = _distinct_pair(rng, geography)
        travellers.append(
            Traveller(
                trip_id=f"t{index}",
                origin_edge=origin,
                destination_edge=destination,
                habitual_departure_s=_sample_departure(rng),
                flexibility_minutes=_sample_flexibility(rng),
                vehicle_type=sample_type(rng, fleet),
                participation_draw=rng.random(),
            )
        )

    return travellers


def _distinct_pair(rng: random.Random, geography: _Geography) -> tuple[str, str]:
    origin_index = _pick(rng, geography.origin_cumulative)
    origin_cell = geography.cells[origin_index]
    origin = origin_cell.edges[_pick(rng, origin_cell.cumulative_length)]

    destinations = geography.destination_cumulative(origin_index)
    for _ in range(8):
        cell = geography.cells[_pick(rng, destinations)]
        destination = cell.edges[_pick(rng, cell.cumulative_length)]
        if destination != origin:
            return origin, destination

    # Only reachable when the draw keeps landing on a cell holding one edge, which is
    # the origin's own. Any other endpoint is a valid journey.
    for cell in geography.cells:
        for edge in cell.edges:
            if edge != origin:
                return origin, edge

    raise ValueError("Only one distinct endpoint exists in the whole network.")
