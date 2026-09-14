import random
from dataclasses import dataclass
from itertools import accumulate

SECONDS_PER_MINUTE = 60
DAY_SECONDS = 24 * 60 * 60


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


@dataclass(frozen=True)
class Traveller:
    trip_id: str
    origin_edge: str
    destination_edge: str
    habitual_departure_s: int
    flexibility_minutes: int
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


def generate(
    edges: list[str],
    weights: list[float],
    count: int,
    seed: int,
) -> list[Traveller]:
    """
    Builds a synthetic travelling population, independent of adoption level.

    One population serves the whole sweep. Non-participants keep their habitual
    departure and form background load the allocator plans around rather than
    controls, which is the difference between a believable result and one that assumes
    the system owns the whole road.
    """
    if not edges:
        raise ValueError("Cannot generate demand without candidate edges.")
    if len(edges) != len(weights):
        raise ValueError("Each edge needs exactly one weight.")
    if count < 1:
        raise ValueError(f"Trip count must be positive, got {count}.")

    rng = random.Random(seed)
    # random.choices rebuilds the cumulative weight table on every call, which is
    # linear in the number of edges. With ~95k candidate endpoints and two draws per
    # trip that dominated generation entirely. Accumulating once lets each draw be a
    # binary search instead.
    cumulative = list(accumulate(weights))
    travellers: list[Traveller] = []

    for index in range(count):
        origin, destination = _distinct_pair(rng, edges, cumulative)
        travellers.append(
            Traveller(
                trip_id=f"t{index}",
                origin_edge=origin,
                destination_edge=destination,
                habitual_departure_s=_sample_departure(rng),
                flexibility_minutes=_sample_flexibility(rng),
                participation_draw=rng.random(),
            )
        )

    return travellers


def _distinct_pair(
    rng: random.Random, edges: list[str], cumulative: list[float]
) -> tuple[str, str]:
    if len(edges) == 1:
        raise ValueError("Need at least two edges to build a trip.")

    origin = rng.choices(edges, cum_weights=cumulative, k=1)[0]
    for _ in range(8):
        destination = rng.choices(edges, cum_weights=cumulative, k=1)[0]
        if destination != origin:
            return origin, destination

    # Weighted sampling can keep returning one dominant edge; fall back to any other.
    fallback = next(edge for edge in edges if edge != origin)
    return origin, fallback
