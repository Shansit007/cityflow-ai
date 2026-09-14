import math

import pytest

from core.fleet import INDIAN_URBAN_PEAK, FleetMix
from sim.demand import CELL_M, FLEXIBILITY_MINUTES, Endpoint, generate

GRID = 12


def grid_endpoints(side: int = GRID) -> list[Endpoint]:
    """A square city of uniform street density, so any spatial bias is the model's."""
    return [
        Endpoint(
            edge_id=f"e{i}-{j}",
            x=(i + 0.5) * CELL_M,
            y=(j + 0.5) * CELL_M,
            length_m=100.0,
        )
        for i in range(side)
        for j in range(side)
    ]


ENDPOINTS = grid_endpoints()
POSITION = {e.edge_id: (e.x, e.y) for e in ENDPOINTS}


def population(count: int = 2000, seed: int = 7, fleet: FleetMix = INDIAN_URBAN_PEAK):
    return generate(ENDPOINTS, count=count, seed=seed, fleet=fleet)


def separations(people) -> list[float]:
    return [
        math.dist(POSITION[p.origin_edge], POSITION[p.destination_edge]) for p in people
    ]


def test_the_same_seed_reproduces_the_same_population() -> None:
    assert population(seed=11) == population(seed=11)


def test_a_different_seed_changes_it() -> None:
    assert population(seed=11) != population(seed=12)


def test_adoption_selects_roughly_its_share() -> None:
    people = population(count=20000)
    share = sum(1 for p in people if p.participates(0.2)) / len(people)

    assert 0.18 <= share <= 0.22


def test_nobody_participates_at_zero_and_everybody_at_one() -> None:
    people = population()

    assert not any(p.participates(0.0) for p in people)
    assert all(p.participates(1.0) for p in people)


def test_adoption_cohorts_are_nested_so_the_sweep_isolates_adoption() -> None:
    # The people using the app at 5% must still be using it at 20%. If the cohort were
    # redrawn per level, a difference between levels could be who participates rather
    # than how many, and the sweep would measure nothing in particular.
    people = population(count=5000)

    small = {p.trip_id for p in people if p.participates(0.05)}
    large = {p.trip_id for p in people if p.participates(0.20)}

    assert small < large


def test_a_trip_never_starts_and_ends_on_the_same_edge() -> None:
    assert all(p.origin_edge != p.destination_edge for p in population())


def test_departures_are_bimodal_around_the_commuting_peaks() -> None:
    hours = [p.habitual_departure_s // 3600 for p in population(count=20000)]

    morning = sum(1 for h in hours if 7 <= h <= 10)
    evening = sum(1 for h in hours if 17 <= h <= 20)
    midday = sum(1 for h in hours if 12 <= h <= 15)

    assert morning > midday * 3
    assert evening > midday * 3


def test_flexibility_follows_the_declared_distribution() -> None:
    people = population(count=20000)

    for minutes, expected in FLEXIBILITY_MINUTES.items():
        share = sum(1 for p in people if p.flexibility_minutes == minutes) / len(people)
        assert abs(share - expected) < 0.02


def test_vehicle_types_follow_the_fleet_mix() -> None:
    people = population(count=20000)

    for name, expected in INDIAN_URBAN_PEAK.shares().items():
        share = sum(1 for p in people if p.vehicle_type == name) / len(people)
        assert abs(share - expected) < 0.02


def test_a_single_type_fleet_puts_everyone_in_that_vehicle() -> None:
    all_cars = FleetMix(two_wheeler=0.0, car=1.0, auto_rickshaw=0.0, lcv=0.0, bus=0.0)

    assert {p.vehicle_type for p in population(fleet=all_cars)} == {"car"}


def test_journeys_are_shorter_than_picking_a_destination_at_random() -> None:
    # The gravity model is the fix for a baseline that gridlocked on distance rather
    # than on peaking: uniform destinations over a city this size average well over
    # half its diagonal, which no commute population does.
    diagonal = math.hypot(GRID * CELL_M, GRID * CELL_M)
    mean = sum(separations(population(count=5000))) / 5000

    assert mean < diagonal / 3


def test_near_destinations_are_chosen_more_often_than_far_ones() -> None:
    distances = separations(population(count=5000))
    near = sum(1 for d in distances if d <= 2000)
    far = sum(1 for d in distances if d >= 5000)

    assert near > far


def test_trip_length_responds_to_the_decay_parameter(monkeypatch) -> None:
    # Distance decay has to be doing the work. If mean journey length were set by the
    # geometry of the extract instead, changing the parameter would move nothing and
    # the calibration in docs/engine.md would be describing a constant.
    import sim.demand as demand

    baseline = sum(separations(population(count=3000))) / 3000
    monkeypatch.setattr(demand, "DECAY_M", 1500.0)
    tighter = sum(separations(population(count=3000))) / 3000

    assert tighter < baseline * 0.8


def test_inflexible_travellers_are_never_movable_even_at_full_adoption() -> None:
    fixed = [p for p in population() if p.flexibility_minutes == 0]

    assert fixed, "expected some travellers with no flexibility"
    assert not any(p.movable(1.0) for p in fixed)


def test_non_participants_are_never_movable_however_flexible_they_are() -> None:
    flexible = [p for p in population() if p.flexibility_minutes > 0]

    assert flexible
    assert not any(p.movable(0.0) for p in flexible)


def test_the_departure_window_is_symmetric_around_the_habitual_time() -> None:
    person = population()[0]
    slack = person.flexibility_minutes * 60

    assert person.earliest_departure_s == person.habitual_departure_s - slack
    assert person.latest_departure_s == person.habitual_departure_s + slack


@pytest.mark.parametrize("count", [0, -1])
def test_a_nonsense_trip_count_is_refused(count: int) -> None:
    with pytest.raises(ValueError):
        generate(ENDPOINTS, count=count, seed=1, fleet=INDIAN_URBAN_PEAK)


def test_too_few_endpoints_is_refused() -> None:
    with pytest.raises(ValueError):
        generate(ENDPOINTS[:1], count=10, seed=1, fleet=INDIAN_URBAN_PEAK)


def test_endpoints_all_in_one_cell_is_refused() -> None:
    crowded = [
        Endpoint(edge_id=f"e{i}", x=10.0 + i, y=10.0, length_m=50.0) for i in range(5)
    ]

    with pytest.raises(ValueError, match="one cell"):
        generate(crowded, count=10, seed=1, fleet=INDIAN_URBAN_PEAK)
