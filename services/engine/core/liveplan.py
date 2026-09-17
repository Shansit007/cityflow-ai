"""Planning one traveller against the load the city has already committed today."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from core.allocator import (
    SLOT_SECONDS,
    PlannedTrip,
    SlotLedger,
    allocate,
    allocate_independently,
)
from core.routing import Route

SECONDS_PER_MINUTE = 60


def window_index(moment: datetime) -> int:
    return int(moment.timestamp()) // SLOT_SECONDS


def window_start(index: int) -> datetime:
    return datetime.fromtimestamp(index * SLOT_SECONDS, tz=UTC)


def segment_key(segment_id: int) -> str:
    """
    The ledger is keyed by string because offline it holds SUMO edge names.

    Converting here rather than making the ledger generic keeps one implementation of
    the capacity arithmetic, which is the part that has been measured.
    """
    return str(segment_id)


@dataclass(frozen=True)
class SegmentWindow:
    segment_id: int
    window_start: datetime


@dataclass(frozen=True)
class Plan:
    """What to tell one traveller, and what it costs the road if they follow it."""

    depart_at: datetime
    # What a system that answered this traveller's question alone would have said.
    # Shown beside the recommendation and stored with it, because the comparison is
    # the claim the product makes and it should be auditable after the fact.
    naive_depart_at: datetime
    # Leaving late enough to arrive exactly on time: the traveller's own habit.
    usual_depart_at: datetime
    travel_seconds: int
    shift_minutes: int
    # Excess over capacity this one vehicle would add, at the recommended time and at
    # the traveller's usual one. This is what the plan is actually buying, and it is
    # the only saving the engine can honestly quote: travel time under congestion is
    # not modelled yet, so the product does not promise minutes it cannot predict.
    overflow_at_plan: float
    overflow_at_usual: float
    # The same comparison in units a traveller can check: how many roads on the route
    # are already at their limit when this vehicle would arrive at them.
    roads_over_at_plan: int
    roads_over_at_usual: int
    charges: tuple[SegmentWindow, ...]


class Unroutable(ValueError):
    pass


def plan(
    route: Route,
    arrive_by: datetime,
    arrive_window_minutes: int,
    capacity_vph: dict[str, int],
    background: dict[tuple[str, int], int],
    committed: dict[tuple[str, int], int] | None = None,
    cumulative_shift_minutes: float = 0.0,
    identity: str = "live",
) -> Plan:
    """
    The departure to recommend, and the naive answer it is measured against.

    A traveller says when they must arrive and how early they are willing to be, so
    the allocator may only move them earlier. Departing later could make them late,
    and a recommendation that risks that is not one they would follow twice.
    """
    if not route.segment_ids:
        raise Unroutable("A plan needs a path; origin and destination are the same.")

    usual = arrive_by - timedelta(seconds=route.duration_s)
    preferred_s = int(usual.timestamp())
    slack_s = arrive_window_minutes * SECONDS_PER_MINUTE

    trip = PlannedTrip(
        trip_id=identity,
        identity=identity,
        path=tuple(segment_key(s) for s in route.segment_ids),
        offsets_s=route.offsets_s,
        preferred_departure_s=preferred_s,
        earliest_departure_s=preferred_s - slack_s,
        latest_departure_s=preferred_s,
        movable=slack_s > 0,
    )

    shared = dict(background)
    for key, count in (committed or {}).items():
        shared[key] = shared.get(key, 0) + count

    road = SlotLedger(capacity_vph, load=shared)
    coordinated = allocate(
        [trip],
        capacity_vph,
        cumulative_shift_minutes={identity: cumulative_shift_minutes},
        ledger=road,
    )
    # Costed against the background alone: the naive system does not know what it has
    # already promised anyone else, which is the whole of its disadvantage.
    naive = allocate_independently(
        [trip], capacity_vph, ledger=SlotLedger(capacity_vph, load=dict(background))
    )

    departure_s = coordinated.departures[identity]
    depart_at = datetime.fromtimestamp(departure_s, tz=UTC)

    # Measured before the trip is committed, so both are the cost of being the next
    # vehicle rather than of being counted twice.
    uncharged = SlotLedger(capacity_vph, load=shared)
    overflow_at_plan = uncharged.marginal_overflow(trip, departure_s)
    overflow_at_usual = uncharged.marginal_overflow(trip, preferred_s)
    roads_over_at_plan = uncharged.segments_over_capacity(trip, departure_s)
    roads_over_at_usual = uncharged.segments_over_capacity(trip, preferred_s)

    return Plan(
        depart_at=depart_at,
        naive_depart_at=datetime.fromtimestamp(naive.departures[identity], tz=UTC),
        usual_depart_at=usual,
        travel_seconds=route.duration_s,
        shift_minutes=round((preferred_s - departure_s) / SECONDS_PER_MINUTE),
        overflow_at_plan=overflow_at_plan,
        overflow_at_usual=overflow_at_usual,
        roads_over_at_plan=roads_over_at_plan,
        roads_over_at_usual=roads_over_at_usual,
        charges=tuple(
            SegmentWindow(
                segment_id=segment_id,
                window_start=window_start((departure_s + offset) // SLOT_SECONDS),
            )
            for segment_id, offset in zip(route.segment_ids, route.offsets_s, strict=True)
        ),
    )
