from dataclasses import dataclass

# Passenger car units per vehicle type, from Indo-HCM (CSIR-CRRI, 2017), Volume 2,
# for urban roads. A two-wheeler occupies far less road space than a car and filters
# through gaps, which is why Indian urban capacity in vehicles per hour is much higher
# than the same road's capacity in PCU per hour.
PCU = {
    "two_wheeler": 0.35,
    "car": 1.00,
    "auto_rickshaw": 0.80,
    "lcv": 1.40,
    "bus": 3.00,
}


@dataclass(frozen=True)
class FleetMix:
    """Share of each vehicle type in the traffic stream. Shares must sum to 1."""

    two_wheeler: float
    car: float
    auto_rickshaw: float
    lcv: float
    bus: float

    def __post_init__(self) -> None:
        total = sum(self.shares().values())
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"Fleet shares must sum to 1, got {total:.6f}.")
        for name, share in self.shares().items():
            if share < 0:
                raise ValueError(f"Fleet share for {name} cannot be negative.")

    def shares(self) -> dict[str, float]:
        return {
            "two_wheeler": self.two_wheeler,
            "car": self.car,
            "auto_rickshaw": self.auto_rickshaw,
            "lcv": self.lcv,
            "bus": self.bus,
        }

    def mean_pcu(self) -> float:
        """PCU of the average vehicle. Divides a PCU/h capacity to give vehicles/h."""
        return sum(share * PCU[name] for name, share in self.shares().items())


# Indian metro peak-hour composition: two-wheeler dominated, which is the feature that
# distinguishes Indian urban capacity from the HCM's assumptions. These are published
# order-of-magnitude shares, not a counted sample from any one city. A deployment
# calibrates this per city from classified counts; docs/engine.md says what using the
# default instead costs the capacity figure.
INDIAN_URBAN_PEAK = FleetMix(
    two_wheeler=0.62,
    car=0.26,
    auto_rickshaw=0.07,
    lcv=0.03,
    bus=0.02,
)
