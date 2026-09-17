from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from heapq import heappop, heappush

SLOT_SECONDS = 15 * 60
SLOTS_PER_HOUR = 3600 // SLOT_SECONDS

# Recommendations are made to the nearest five minutes, finer than the fifteen-minute
# windows capacity is counted in. Quantising departures to the window boundary instead
# would pile every shifted traveller onto four instants an hour, which is a peak of the
# allocator's own making, and "leave at 08:45" is a worse recommendation than "leave at
# 08:42" for a reason that has nothing to do with traffic: it is obviously generated.
SHIFT_GRANULARITY_S = 5 * 60

# What the first vehicle over a segment's capacity is worth, in minutes of somebody's
# time. The two terms of the objective are otherwise incommensurable and the ratio
# between them is the whole design: at zero the allocator ignores congestion and nobody
# moves, and at a large value it will shift someone half an hour to spare one junction
# one vehicle. Ten minutes means a traveller is asked to move five minutes to keep two
# segments inside capacity, which is the trade the product is offering.
CONGESTION_WEIGHT_MINUTES = 10.0

# How much being shifted before counts against being shifted again. At 1.0 a traveller
# carrying an hour of accumulated shift finds every further minute twice as expensive
# as a traveller who has never been moved. Without this the allocator converges on the
# same flexible people every day: individually optimal, collectively the reason they
# would stop using it.
FAIRNESS_WEIGHT = 1.0
FAIRNESS_REFERENCE_MINUTES = 60.0


@dataclass(frozen=True)
class PlannedTrip:
    """
    A journey the allocator may place, and everything placing it depends on.

    `offsets_s` is how long after departure the vehicle enters each edge of `path`, so
    a departure time determines which fifteen-minute window this trip loads on every
    segment it uses. The two tuples are parallel and the same length.
    """

    trip_id: str
    identity: str
    path: tuple[str, ...]
    offsets_s: tuple[int, ...]
    preferred_departure_s: int
    earliest_departure_s: int
    latest_departure_s: int
    movable: bool

    def __post_init__(self) -> None:
        if len(self.path) != len(self.offsets_s):
            raise ValueError(f"{self.trip_id}: each edge needs one offset.")
        if not self.earliest_departure_s <= self.preferred_departure_s:
            raise ValueError(f"{self.trip_id}: preferred departure is before earliest.")
        if not self.preferred_departure_s <= self.latest_departure_s:
            raise ValueError(f"{self.trip_id}: preferred departure is after latest.")

    def candidate_departures(self) -> list[int]:
        """
        Departure times on offer, at five-minute steps either side of the habitual one.

        An immovable trip has exactly one candidate, so background traffic and
        inflexible travellers go through the same code path as everybody else rather
        than a special case that can drift out of step with it.
        """
        if not self.movable:
            return [self.preferred_departure_s]

        earliest = self.earliest_departure_s
        latest = self.latest_departure_s
        preferred = self.preferred_departure_s

        steps_back = (preferred - earliest) // SHIFT_GRANULARITY_S
        steps_forward = (latest - preferred) // SHIFT_GRANULARITY_S

        return [
            preferred + step * SHIFT_GRANULARITY_S
            for step in range(-steps_back, steps_forward + 1)
        ]


class SlotLedger:
    """
    Vehicles entering each segment in each fifteen-minute window, against capacity.

    Capacity is per hour, so a window holds a quarter of it. Segments the capacity
    model has no figure for are counted as unconstrained rather than as zero-capacity,
    and tallied: treating a missing number as no room would make the allocator refuse
    to route anyone down a road it simply knows nothing about.
    """

    def __init__(
        self,
        capacity_vph: Mapping[str, int],
        load: Mapping[tuple[str, int], int] | None = None,
    ) -> None:
        self._capacity_vph = capacity_vph
        # Load already on the road before this allocator runs. Offline that is empty
        # and every vehicle is placed here; serving one live traveller it is the rest
        # of the city, read from departure_slots. The distinction matters nowhere else
        # in this class, which is why one ledger serves both.
        self._load: dict[tuple[str, int], int] = dict(load) if load else {}
        self.unknown_edges: set[str] = set()

    def window_capacity(self, edge: str) -> float | None:
        capacity = self._capacity_vph.get(edge)
        if capacity is None:
            self.unknown_edges.add(edge)
            return None
        return capacity / SLOTS_PER_HOUR

    def marginal_overflow(self, trip: PlannedTrip, departure_s: int) -> float:
        """
        What adding this trip would cost in excess over capacity, squared and marginal.

        Marginal, because a segment already twenty vehicles over its limit is equally
        over it whichever slot this traveller picks: charging the total would make every
        candidate look the same.

        Squared, because a linear penalty is flat above the threshold — every vehicle
        past capacity costs exactly one, so once all the windows a traveller can reach
        are full the congestion term stops distinguishing between them and deviation
        alone decides. That sends everyone back to their preferred time and rebuilds the
        peak. Squaring gives the cost a gradient: the fuller a window already is, the
        more the next vehicle costs, so travellers keep spilling into whichever window
        is least oversubscribed rather than piling onto the one they wanted.
        """
        excess = 0.0

        for edge, offset in zip(trip.path, trip.offsets_s, strict=True):
            capacity = self.window_capacity(edge)
            if capacity is None:
                continue

            window = (departure_s + offset) // SLOT_SECONDS
            load = self._load.get((edge, window), 0)
            before = max(0.0, load - capacity)
            after = max(0.0, load + 1 - capacity)
            excess += after * after - before * before

        return excess

    def commit(self, trip: PlannedTrip, departure_s: int) -> None:
        for edge, offset in zip(trip.path, trip.offsets_s, strict=True):
            window = (departure_s + offset) // SLOT_SECONDS
            key = (edge, window)
            self._load[key] = self._load.get(key, 0) + 1

    def segments_over_capacity(self, trip: PlannedTrip, departure_s: int) -> int:
        """
        How many segments of this trip's path are already full when it reaches them.

        The objective this class optimises is squared excess, which is comparable
        between candidate times and meaningless to a person. A count of roads is the
        same fact in units a traveller can argue with.
        """
        count = 0

        for edge, offset in zip(trip.path, trip.offsets_s, strict=True):
            capacity = self.window_capacity(edge)
            if capacity is None:
                continue
            window = (departure_s + offset) // SLOT_SECONDS
            if self._load.get((edge, window), 0) + 1 > capacity:
                count += 1

        return count

    def loads(self) -> Iterable[tuple[tuple[str, int], int]]:
        """Every (segment, window) that carries at least one vehicle, and how many."""
        return self._load.items()

    def entries_by_window(self, edge: str) -> dict[int, int]:
        return {w: n for (e, w), n in self._load.items() if e == edge}

    def overloaded(self) -> tuple[int, float]:
        """How many segment-windows are over capacity, and by how many vehicles.

        The allocator has nothing to do when this is zero: every trip can depart when
        its traveller wants. Measuring it against the untouched departures is the
        cheapest way to find out whether a scenario is worth simulating at all.
        """
        windows = 0
        excess = 0.0

        for (edge, _), load in self._load.items():
            capacity = self.window_capacity(edge)
            if capacity is not None and load > capacity:
                windows += 1
                excess += load - capacity

        return windows, excess


@dataclass
class Allocation:
    departures: dict[str, int] = field(default_factory=dict)
    shifted: int = 0
    total_shift_minutes: float = 0.0
    unknown_edges: int = 0

    @property
    def mean_shift_minutes(self) -> float:
        return self.total_shift_minutes / self.shifted if self.shifted else 0.0


def _cost(
    trip: PlannedTrip,
    departure_s: int,
    ledger: SlotLedger,
    cumulative_shift_minutes: float,
    congestion_weight: float,
    fairness_weight: float,
) -> float:
    """
    What it costs to send this traveller at this time.

    deviation x (1 + fairness) + congestion_weight x marginal overflow

    The fairness term multiplies the deviation rather than adding to it, so it changes
    who gets moved without ever making it attractive to move somebody who does not need
    to move: a traveller with no deviation pays nothing however often they have been
    shifted before.
    """
    deviation_minutes = abs(departure_s - trip.preferred_departure_s) / 60
    fairness = fairness_weight * (cumulative_shift_minutes / FAIRNESS_REFERENCE_MINUTES)
    overflow = ledger.marginal_overflow(trip, departure_s)

    return deviation_minutes * (1 + fairness) + congestion_weight * overflow


def _best_two(
    trip: PlannedTrip,
    ledger: SlotLedger,
    cumulative_shift_minutes: float,
    congestion_weight: float,
    fairness_weight: float,
) -> tuple[int, float, float]:
    """Cheapest departure, its cost, and the cost of the next best — that is regret."""
    best_departure = trip.preferred_departure_s
    best = second = float("inf")

    for departure in trip.candidate_departures():
        cost = _cost(
            trip,
            departure,
            ledger,
            cumulative_shift_minutes,
            congestion_weight,
            fairness_weight,
        )
        if cost < best:
            second = best
            best, best_departure = cost, departure
        elif cost < second:
            second = cost

    return best_departure, best, second


def allocate(
    trips: Iterable[PlannedTrip],
    capacity_vph: Mapping[str, int],
    cumulative_shift_minutes: Mapping[str, float] | None = None,
    congestion_weight: float = CONGESTION_WEIGHT_MINUTES,
    fairness_weight: float = FAIRNESS_WEIGHT,
    ledger: SlotLedger | None = None,
) -> Allocation:
    """
    Places every trip in a departure slot, keeping segment inflow within capacity.

    Immovable trips are committed first and in full. They are the background: people
    who do not use the app, and people who have no slack in their morning. The
    allocator does not control them, cannot shift them, and has to plan around them —
    which is the difference between a result that could happen and one that assumes the
    system owns the road.

    Movable trips are then placed in descending order of regret, the gap between their
    best and second-best option. A traveller with one good slot and nothing else should
    choose before a traveller who is nearly indifferent, because reversing that order
    spends the constrained traveller's only option on someone who had alternatives.
    Regret is recomputed on pop, since committing one trip changes it for others.
    """
    history = cumulative_shift_minutes or {}
    if ledger is None:
        ledger = SlotLedger(capacity_vph)
    allocation = Allocation()

    movable: list[PlannedTrip] = []
    for trip in trips:
        if trip.movable:
            movable.append(trip)
        else:
            ledger.commit(trip, trip.preferred_departure_s)
            allocation.departures[trip.trip_id] = trip.preferred_departure_s

    # Equal regret is common and the heap breaks those ties on position, so without
    # this the result depends on what order the caller happened to iterate travellers
    # in - two scripts planning the same cohort from the same data disagreed by 10%
    # because one read the population file and the other read the route file.
    movable.sort(key=lambda trip: (trip.preferred_departure_s, trip.trip_id))

    queue: list[tuple[float, int]] = []
    for index, trip in enumerate(movable):
        _, best, second = _best_two(
            trip,
            ledger,
            history.get(trip.identity, 0.0),
            congestion_weight,
            fairness_weight,
        )
        heappush(queue, (-_regret(best, second), index))

    placed: set[int] = set()
    while queue:
        stale_regret, index = heappop(queue)
        if index in placed:
            continue

        trip = movable[index]
        departure, best, second = _best_two(
            trip,
            ledger,
            history.get(trip.identity, 0.0),
            congestion_weight,
            fairness_weight,
        )
        regret = _regret(best, second)

        # The ledger has moved since this entry was pushed. If the trip has become less
        # constrained than the queue believes, it no longer deserves its position and
        # goes back with the regret it actually has.
        if -regret > stale_regret + 1e-9 and queue:
            heappush(queue, (-regret, index))
            continue

        ledger.commit(trip, departure)
        placed.add(index)
        allocation.departures[trip.trip_id] = departure

        shift_minutes = abs(departure - trip.preferred_departure_s) / 60
        if shift_minutes:
            allocation.shifted += 1
            allocation.total_shift_minutes += shift_minutes

    allocation.unknown_edges = len(ledger.unknown_edges)
    return allocation


def _regret(best: float, second: float) -> float:
    """Zero when a trip has only one option: nothing to lose by placing it last."""
    return 0.0 if second == float("inf") else second - best


def allocate_independently(
    trips: Iterable[PlannedTrip],
    capacity_vph: Mapping[str, int],
    congestion_weight: float = CONGESTION_WEIGHT_MINUTES,
    ledger: SlotLedger | None = None,
) -> Allocation:
    """
    The naive design: every traveller is told the best time given today's traffic.

    Each movable trip is costed against a ledger holding only the background, and none
    of their choices is fed back into it, which is exactly what happens when a system
    answers each user's question independently. They all see the same quiet slot and
    they all take it.

    This exists to be measured against `allocate`, not as an option. docs/engine.md
    carries the resulting inflow histogram, which has a higher peak than doing nothing
    at all.
    """
    if ledger is None:
        ledger = SlotLedger(capacity_vph)
    allocation = Allocation()
    movable: list[PlannedTrip] = []

    for trip in trips:
        if trip.movable:
            movable.append(trip)
        else:
            ledger.commit(trip, trip.preferred_departure_s)
            allocation.departures[trip.trip_id] = trip.preferred_departure_s

    for trip in movable:
        departure, _, _ = _best_two(trip, ledger, 0.0, congestion_weight, 0.0)
        allocation.departures[trip.trip_id] = departure

        shift_minutes = abs(departure - trip.preferred_departure_s) / 60
        if shift_minutes:
            allocation.shifted += 1
            allocation.total_shift_minutes += shift_minutes

    allocation.unknown_edges = len(ledger.unknown_edges)
    return allocation
