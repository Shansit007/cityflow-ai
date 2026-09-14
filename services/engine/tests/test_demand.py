import pytest

from sim.demand import FLEXIBILITY_MINUTES, generate

EDGES = [f"e{i}" for i in range(50)]
WEIGHTS = [1.0] * 50


def population(adoption: float = 0.2, count: int = 2000, seed: int = 7):
    return generate(EDGES, WEIGHTS, count=count, adoption=adoption, seed=seed)


def test_the_same_seed_reproduces_the_same_population() -> None:
    assert population(seed=11) == population(seed=11)


def test_a_different_seed_changes_it() -> None:
    assert population(seed=11) != population(seed=12)


def test_adoption_controls_the_share_that_participates() -> None:
    people = population(adoption=0.2, count=20000)
    share = sum(1 for p in people if p.participates) / len(people)

    assert 0.18 <= share <= 0.22


def test_nobody_participates_at_zero_adoption() -> None:
    assert not any(p.participates for p in population(adoption=0.0))


def test_everybody_participates_at_full_adoption() -> None:
    assert all(p.participates for p in population(adoption=1.0))


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


def test_inflexible_travellers_are_never_movable_even_when_they_participate() -> None:
    people = population(adoption=1.0)
    fixed = [p for p in people if p.flexibility_minutes == 0]

    assert fixed, "expected some travellers with no flexibility"
    assert not any(p.movable for p in fixed)


def test_non_participants_are_never_movable_however_flexible_they_are() -> None:
    people = population(adoption=0.0)
    flexible = [p for p in people if p.flexibility_minutes > 0]

    assert flexible
    assert not any(p.movable for p in flexible)


def test_the_departure_window_is_symmetric_around_the_habitual_time() -> None:
    person = population()[0]
    slack = person.flexibility_minutes * 60

    assert person.earliest_departure_s == person.habitual_departure_s - slack
    assert person.latest_departure_s == person.habitual_departure_s + slack


@pytest.mark.parametrize(
    ("count", "adoption"),
    [(0, 0.2), (-1, 0.2), (10, 1.5), (10, -0.1)],
)
def test_nonsense_parameters_are_refused(count: int, adoption: float) -> None:
    with pytest.raises(ValueError):
        generate(EDGES, WEIGHTS, count=count, adoption=adoption, seed=1)


def test_mismatched_edges_and_weights_are_refused() -> None:
    with pytest.raises(ValueError):
        generate(EDGES, [1.0], count=10, adoption=0.2, seed=1)
