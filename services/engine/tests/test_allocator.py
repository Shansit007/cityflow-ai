import pytest

from core.allocator import (
    SLOT_SECONDS,
    Allocation,
    PlannedTrip,
    SlotLedger,
    allocate,
    allocate_independently,
)

BOTTLENECK = "bottleneck"
EIGHT_AM = 8 * 3600


def trip(
    name: str,
    *,
    preferred: int = EIGHT_AM,
    flexibility_minutes: int = 30,
    movable: bool = True,
    identity: str | None = None,
    path: tuple[str, ...] = (BOTTLENECK,),
) -> PlannedTrip:
    slack = flexibility_minutes * 60
    return PlannedTrip(
        trip_id=name,
        identity=identity or name,
        path=path,
        offsets_s=tuple(0 for _ in path),
        preferred_departure_s=preferred,
        earliest_departure_s=preferred - slack,
        latest_departure_s=preferred + slack,
        movable=movable,
    )


def loads(allocation: Allocation, edge: str = BOTTLENECK) -> dict[int, int]:
    counts: dict[int, int] = {}
    for departure in allocation.departures.values():
        window = departure // SLOT_SECONDS
        counts[window] = counts.get(window, 0) + 1
    return counts


def peak(allocation: Allocation) -> int:
    return max(loads(allocation).values())


def test_a_trip_nobody_competes_with_is_left_alone() -> None:
    # The allocator is not a scheduler. If a departure costs nobody anything, the
    # traveller keeps the time they chose.
    allocation = allocate([trip("t0")], {BOTTLENECK: 4000})

    assert allocation.departures["t0"] == EIGHT_AM
    assert allocation.shifted == 0


def test_immovable_trips_keep_their_departure() -> None:
    trips = [trip(f"t{i}", movable=False) for i in range(50)]

    allocation = allocate(trips, {BOTTLENECK: 4})

    assert set(allocation.departures.values()) == {EIGHT_AM}
    assert allocation.shifted == 0


def test_a_crowded_segment_is_spread_across_windows() -> None:
    # 100 travellers all wanting the same quarter of an hour, on a segment that can
    # take 20 in one. Five windows are reachable inside their flexibility, so a
    # perfect spread is 20 apiece.
    trips = [trip(f"t{i}") for i in range(100)]

    allocation = allocate(trips, {BOTTLENECK: 80})

    assert peak(allocation) <= 30
    assert len(loads(allocation)) >= 4


def test_nobody_is_moved_outside_the_flexibility_they_declared() -> None:
    trips = [trip(f"t{i}", flexibility_minutes=15) for i in range(100)]

    allocation = allocate(trips, {BOTTLENECK: 4})

    for name, departure in allocation.departures.items():
        assert abs(departure - EIGHT_AM) <= 15 * 60, name


def test_inflexible_travellers_are_never_moved_however_congested_it_is() -> None:
    fixed = [trip(f"f{i}", movable=False) for i in range(80)]
    flexible = [trip(f"m{i}") for i in range(20)]

    allocation = allocate(fixed + flexible, {BOTTLENECK: 4})

    assert all(allocation.departures[f"f{i}"] == EIGHT_AM for i in range(80))


def test_background_load_is_planned_around_not_ignored() -> None:
    # The people who do not use the app fill the middle window. A traveller who does
    # use it should be placed somewhere else, because that is where the room is.
    background = [trip(f"b{i}", movable=False) for i in range(60)]

    allocation = allocate(background + [trip("me")], {BOTTLENECK: 80})

    assert allocation.departures["me"] != EIGHT_AM


def test_independent_optimisation_builds_a_worse_peak_than_coordination() -> None:
    # The failure this whole design exists to avoid. Told individually, every traveller
    # is given the same quiet slot and they all take it, so the trough becomes the new
    # peak. Coordinated placement sees each choice as it is made.
    background = [trip(f"b{i}", movable=False) for i in range(60)]
    flexible = [trip(f"m{i}") for i in range(120)]
    capacity = {BOTTLENECK: 80}

    naive = allocate_independently(background + flexible, capacity)
    coordinated = allocate(background + flexible, capacity)

    assert peak(naive) > peak(coordinated)


def test_independent_optimisation_can_beat_leaving_everyone_alone_on_paper() -> None:
    # And it looks like it is working, which is why it is a trap rather than a bug:
    # measured only at the segment the travellers left, the naive answer improves it.
    background = [trip(f"b{i}", movable=False) for i in range(60)]
    flexible = [trip(f"m{i}") for i in range(120)]

    naive = allocate_independently(background + flexible, {BOTTLENECK: 80})
    untouched = 60 + 120

    assert loads(naive)[EIGHT_AM // SLOT_SECONDS] < untouched


def test_a_traveller_already_shifted_a_lot_is_shifted_less() -> None:
    # Same person, same journey, different history. Fairness is the only difference
    # between the two runs, so any difference in who moves is the fairness term.
    crowd = [trip(f"t{i}") for i in range(40)]
    subject = trip("subject", identity="veteran")
    capacity = {BOTTLENECK: 40}

    fresh = allocate(crowd + [subject], capacity)
    weary = allocate(crowd + [subject], capacity, {"veteran": 240.0})

    moved_when_fresh = abs(fresh.departures["subject"] - EIGHT_AM)
    moved_when_weary = abs(weary.departures["subject"] - EIGHT_AM)

    assert moved_when_weary <= moved_when_fresh


def test_fairness_spreads_the_burden_over_repeated_days() -> None:
    # Run the same morning twice, carrying the shift forward. The people moved on day
    # one should not be exactly the people moved on day two.
    trips = [trip(f"t{i}") for i in range(60)]
    capacity = {BOTTLENECK: 40}

    day_one = allocate(trips, capacity)
    history = {
        name: abs(departure - EIGHT_AM) / 60
        for name, departure in day_one.departures.items()
    }
    day_two = allocate(trips, capacity, history)

    moved_one = {n for n, d in day_one.departures.items() if d != EIGHT_AM}
    moved_two = {n for n, d in day_two.departures.items() if d != EIGHT_AM}

    assert moved_one != moved_two


def test_a_segment_with_no_capacity_figure_is_unconstrained_not_impassable() -> None:
    # A missing number means the capacity model has nothing to say about that road.
    # Reading it as zero would have the allocator refuse to send anyone down it.
    trips = [trip(f"t{i}", path=("unmapped",)) for i in range(50)]

    allocation = allocate(trips, {})

    assert allocation.shifted == 0
    assert allocation.unknown_edges == 1


def test_recommendations_land_on_five_minute_marks() -> None:
    trips = [trip(f"t{i}") for i in range(60)]

    allocation = allocate(trips, {BOTTLENECK: 40})

    for departure in allocation.departures.values():
        assert (departure - EIGHT_AM) % (5 * 60) == 0


def test_every_trip_given_gets_a_departure_back() -> None:
    trips = [trip(f"m{i}") for i in range(30)] + [
        trip(f"f{i}", movable=False) for i in range(30)
    ]

    allocation = allocate(trips, {BOTTLENECK: 20})

    assert set(allocation.departures) == {t.trip_id for t in trips}


def test_mean_shift_is_reported_over_the_people_who_moved() -> None:
    trips = [trip(f"t{i}") for i in range(40)]

    allocation = allocate(trips, {BOTTLENECK: 20})

    assert allocation.shifted > 0
    assert allocation.mean_shift_minutes > 0
    assert allocation.mean_shift_minutes <= 30


def test_a_ledger_counts_a_quarter_of_the_hourly_capacity() -> None:
    ledger = SlotLedger({BOTTLENECK: 80})

    assert ledger.window_capacity(BOTTLENECK) == pytest.approx(20.0)


def test_overflow_is_charged_only_past_capacity() -> None:
    ledger = SlotLedger({BOTTLENECK: 4})
    one = trip("t0")

    assert ledger.marginal_overflow(one, EIGHT_AM) == pytest.approx(0.0)
    ledger.commit(one, EIGHT_AM)
    assert ledger.marginal_overflow(one, EIGHT_AM) == pytest.approx(1.0)


def test_a_trip_whose_offsets_do_not_match_its_path_is_refused() -> None:
    with pytest.raises(ValueError):
        PlannedTrip(
            trip_id="t0",
            identity="t0",
            path=("a", "b"),
            offsets_s=(0,),
            preferred_departure_s=EIGHT_AM,
            earliest_departure_s=EIGHT_AM,
            latest_departure_s=EIGHT_AM,
            movable=False,
        )


def test_a_preferred_departure_outside_its_own_window_is_refused() -> None:
    with pytest.raises(ValueError):
        PlannedTrip(
            trip_id="t0",
            identity="t0",
            path=("a",),
            offsets_s=(0,),
            preferred_departure_s=EIGHT_AM,
            earliest_departure_s=EIGHT_AM + 600,
            latest_departure_s=EIGHT_AM + 1200,
            movable=True,
        )


def test_allocation_does_not_depend_on_caller_iteration_order() -> None:
    """
    Two callers planning the same cohort must get the same plan.

    run_allocation.py reads travellers out of the population file and run_sweep.py
    reads them out of the route file, which is sorted by departure. When ties in the
    regret queue fell back on position, those two orders produced plans that differed
    by 10% of the excess removed.
    """
    trips = [
        trip(f"t{index:03d}", preferred=EIGHT_AM + (index % 7) * 300)
        for index in range(60)
    ]
    capacity = {BOTTLENECK: 20}

    forward = allocate(trips, capacity)
    reversed_order = allocate(list(reversed(trips)), capacity)
    shuffled = allocate(trips[17:] + trips[:17], capacity)

    assert forward.departures == reversed_order.departures
    assert forward.departures == shuffled.departures
