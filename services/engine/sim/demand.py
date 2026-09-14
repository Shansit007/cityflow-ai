import hashlib
import math
import random
from bisect import bisect_right
from dataclasses import dataclass
from itertools import accumulate

from core.fleet import FleetMix
from sim.vehicles import sample_type

SECONDS_PER_MINUTE = 60
DAY_SECONDS = 24 * 60 * 60


def demand_draw(trip_id: str) -> float:
    """
    A stable number in [0, 1) per traveller, used to thin the population to a chosen
    demand level without routing it again.

    Routing 100,000 journeys takes four minutes and does not depend on how many of
    them are simulated, so the level at which the network congests is found by
    dropping travellers at run time rather than by regenerating. Derived from the trip
    id by hashing rather than from an RNG so that the same share always keeps the same
    people, across processes and across Python versions: a baseline and the allocator
    run it is compared against must contain exactly the same population.

    Deliberately independent of participation_draw. Whether a journey happens and
    whether its traveller uses the app are different questions, and tying them would
    make the adoption sweep vary demand as a side effect.
    """
    digest = hashlib.blake2b(trip_id.encode(), digest_size=8).digest()
    return int.from_bytes(digest, "big") / 2**64


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

# How far an employment district's pull reaches, in metres. Offices are not a point: a
# commercial district is a couple of kilometres across and the streets around it absorb
# its arrivals. Too tight and every journey ends on the same few edges; too loose and
# the centre stops being a centre.
CENTRE_RADIUS_M = 1200.0


@dataclass(frozen=True)
class Centre:
    """An employment district, in the same projected metres as the endpoints."""

    x: float
    y: float
    weight: float



@dataclass(frozen=True)
class Traveller:
    trip_id: str
    origin_edge: str
    destination_edge: str
    habitual_departure_s: int
    flexibility_minutes: int
    vehicle_type: str
    to_work: bool
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


def _sample_departure(rng: random.Random) -> tuple[int, bool]:
    """Returns the departure second and whether this is a journey towards work."""
    to_work = rng.random() < MORNING.share
    peak = MORNING if to_work else EVENING
    drawn = int(rng.gauss(peak.centre_s, peak.spread_s))
    return max(0, min(DAY_SECONDS - 1, drawn)), to_work


def _sample_flexibility(rng: random.Random) -> int:
    minutes = list(FLEXIBILITY_MINUTES)
    weights = [FLEXIBILITY_MINUTES[m] for m in minutes]
    return rng.choices(minutes, weights=weights, k=1)[0]


@dataclass(frozen=True)
class _Cell:
    key: tuple[int, int]
    centre_x: float
    centre_y: float
    # Where people live: street length, as a proxy for built-up density.
    residential: float
    # Where people work: street length weighted by nearby employment districts.
    employment: float
    edges: list[str]
    cumulative_length: list[float]


class _Geography:
    """
    Endpoints bucketed by location, with a cached gravity distribution per origin cell.

    Every trip starting in the same cell and heading the same way faces the same
    distribution over destinations, so it is built once per cell and direction rather
    than once per trip. With a few hundred occupied cells that turns the dominant cost
    of generation into a binary search.
    """

    def __init__(self, endpoints: list[Endpoint], centres: list[Centre]) -> None:
        grouped: dict[tuple[int, int], list[Endpoint]] = {}
        for endpoint in endpoints:
            key = (int(endpoint.x // CELL_M), int(endpoint.y // CELL_M))
            grouped.setdefault(key, []).append(endpoint)

        self.cells: list[_Cell] = []
        for key, members in sorted(grouped.items()):
            lengths = [m.length_m for m in members]
            total = sum(lengths)
            centre_x = (key[0] + 0.5) * CELL_M
            centre_y = (key[1] + 0.5) * CELL_M

            self.cells.append(
                _Cell(
                    key=key,
                    centre_x=centre_x,
                    centre_y=centre_y,
                    residential=total,
                    employment=total * _pull(centre_x, centre_y, centres),
                    edges=[m.edge_id for m in members],
                    cumulative_length=list(accumulate(lengths)),
                )
            )

        self._origin: dict[bool, list[float]] = {}
        self._destination: dict[tuple[int, bool], list[float]] = {}

    def _mass(self, cell: _Cell, employment: bool) -> float:
        return cell.employment if employment else cell.residential

    def origin_cumulative(self, to_work: bool) -> list[float]:
        """Morning journeys start where people live, evening ones where they work."""
        cached = self._origin.get(to_work)
        if cached is None:
            cached = list(
                accumulate(self._mass(cell, not to_work) for cell in self.cells)
            )
            self._origin[to_work] = cached
        return cached

    def destination_cumulative(self, origin_index: int, to_work: bool) -> list[float]:
        cached = self._destination.get((origin_index, to_work))
        if cached is not None:
            return cached

        origin = self.cells[origin_index]
        weights: list[float] = []
        for cell in self.cells:
            distance = math.hypot(
                cell.centre_x - origin.centre_x, cell.centre_y - origin.centre_y
            )
            weights.append(
                self._mass(cell, to_work) * math.exp(-distance / DECAY_M)
            )

        cumulative = list(accumulate(weights))
        self._destination[(origin_index, to_work)] = cumulative
        return cumulative


def _pull(x: float, y: float, centres: list[Centre]) -> float:
    """
    How much employment reaches this point, as a multiplier on its street length.

    Returns 1.0 when no centres are given, which makes employment identical to
    residential and the model directionless. That is the fallback for a city whose
    districts have not been placed, and it is the reason such a city never congests:
    journeys scatter evenly and no segment fills.
    """
    if not centres:
        return 1.0

    return sum(
        centre.weight
        * math.exp(-math.hypot(x - centre.x, y - centre.y) / CENTRE_RADIUS_M)
        for centre in centres
    )


def _pick(rng: random.Random, cumulative: list[float]) -> int:
    return bisect_right(cumulative, rng.random() * cumulative[-1])


def generate(
    endpoints: list[Endpoint],
    count: int,
    seed: int,
    fleet: FleetMix,
    centres: list[Centre] | None = None,
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

    geography = _Geography(endpoints, centres or [])
    if len(geography.cells) < 2:
        raise ValueError("All endpoints fall in one cell; no journeys to model.")

    rng = random.Random(seed)
    travellers: list[Traveller] = []

    for index in range(count):
        departure, to_work = _sample_departure(rng)
        origin, destination = _distinct_pair(rng, geography, to_work)
        travellers.append(
            Traveller(
                trip_id=f"t{index}",
                origin_edge=origin,
                destination_edge=destination,
                habitual_departure_s=departure,
                flexibility_minutes=_sample_flexibility(rng),
                vehicle_type=sample_type(rng, fleet),
                to_work=to_work,
                participation_draw=rng.random(),
            )
        )

    return travellers


def _distinct_pair(
    rng: random.Random, geography: _Geography, to_work: bool
) -> tuple[str, str]:
    origin_index = _pick(rng, geography.origin_cumulative(to_work))
    origin_cell = geography.cells[origin_index]
    origin = origin_cell.edges[_pick(rng, origin_cell.cumulative_length)]

    destinations = geography.destination_cumulative(origin_index, to_work)
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
