import random
from dataclasses import dataclass

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
    participates: bool

    @property
    def earliest_departure_s(self) -> int:
        return self.habitual_departure_s - self.flexibility_minutes * SECONDS_PER_MINUTE

    @property
    def latest_departure_s(self) -> int:
        return self.habitual_departure_s + self.flexibility_minutes * SECONDS_PER_MINUTE

    @property
    def movable(self) -> bool:
        """A trip the allocator is allowed to shift at all."""
        return self.participates and self.flexibility_minutes > 0


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
    adoption: float,
    seed: int,
) -> list[Traveller]:
    """
    Builds a synthetic travelling population.

    `adoption` is the share using CityFlow AI. Everyone else keeps their habitual
    departure and forms background load the allocator has to plan around rather than
    control, which is the difference between a believable result and one that assumes
    the system owns the whole road.
    """
    if not edges:
        raise ValueError("Cannot generate demand without candidate edges.")
    if len(edges) != len(weights):
        raise ValueError("Each edge needs exactly one weight.")
    if count < 1:
        raise ValueError(f"Trip count must be positive, got {count}.")
    if not 0.0 <= adoption <= 1.0:
        raise ValueError(f"Adoption must be a share between 0 and 1, got {adoption}.")

    rng = random.Random(seed)
    travellers: list[Traveller] = []

    for index in range(count):
        origin, destination = _distinct_pair(rng, edges, weights)
        travellers.append(
            Traveller(
                trip_id=f"t{index}",
                origin_edge=origin,
                destination_edge=destination,
                habitual_departure_s=_sample_departure(rng),
                flexibility_minutes=_sample_flexibility(rng),
                participates=rng.random() < adoption,
            )
        )

    return travellers


def _distinct_pair(
    rng: random.Random, edges: list[str], weights: list[float]
) -> tuple[str, str]:
    if len(edges) == 1:
        raise ValueError("Need at least two edges to build a trip.")

    origin = rng.choices(edges, weights=weights, k=1)[0]
    for _ in range(8):
        destination = rng.choices(edges, weights=weights, k=1)[0]
        if destination != origin:
            return origin, destination

    # Weighted sampling can keep returning one dominant edge; fall back to any other.
    fallback = next(edge for edge in edges if edge != origin)
    return origin, fallback
