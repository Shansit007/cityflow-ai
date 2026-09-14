import pytest

from sim.demand import FLEXIBILITY_MINUTES, generate

EDGES = [f"e{i}" for i in range(50)]
WEIGHTS = [1.0] * 50


def population(count: int = 2000, seed: int = 7):
    return generate(EDGES, WEIGHTS, count=count, seed=seed)


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
        generate(EDGES, WEIGHTS, count=count, seed=1)


def test_mismatched_edges_and_weights_are_refused() -> None:
    with pytest.raises(ValueError):
        generate(EDGES, [1.0], count=10, seed=1)


def test_no_edges_at_all_is_refused() -> None:
    with pytest.raises(ValueError):
        generate([], [], count=10, seed=1)
