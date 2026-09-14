from dataclasses import dataclass
from typing import Literal

# Speed at which a queue discharges past a stop line, in m/s. A headway-derived PCU
# depends on it: at a standstill only physical length separates a scooter from a bus,
# at speed the reaction gap dominates. 30 km/h is the discharge speed the HCM's
# saturation-flow definition assumes for an urban signalised approach.
DISCHARGE_SPEED_MS = 8.33

PcuBasis = Literal["indo_hcm", "simulated"]


@dataclass(frozen=True)
class VehicleSpec:
    """
    One vehicle type, in the terms the capacity model and SUMO both need.

    The car-following fields are handed to SUMO verbatim as a vType. indo_hcm_pcu is
    the published planning figure for the same vehicle on an Indian urban road. The two
    do not agree, and simulated_pcu below is where the disagreement is made visible
    rather than averaged away.
    """

    length_m: float
    min_gap_m: float
    tau_s: float
    max_speed_ms: float
    accel_ms2: float
    decel_ms2: float
    # Braking a driver will only use to avoid a crash. It has to be at least the
    # hardest decel any vehicle in the fleet uses, because the car-following model
    # computes a safe speed assuming the leader brakes no harder than the follower
    # can: a bus behind a two-wheeler that can stop at 5 m/s2 has to be able to
    # exceed that or the two will collide by construction.
    emergency_decel_ms2: float
    sigma: float
    indo_hcm_pcu: float
    sumo_class: str
    gui_shape: str

    def headway_m(self, speed_ms: float = DISCHARGE_SPEED_MS) -> float:
        """Road length one vehicle occupies in a moving queue, front bumper to front."""
        return self.length_m + self.min_gap_m + self.tau_s * speed_ms


# indo_hcm_pcu follows Indo-HCM (CSIR-CRRI, 2017) Volume 2 for urban roads. The
# car-following parameters are the ones a rider or driver of that vehicle actually
# keeps in Indian city traffic: two-wheeler and auto-rickshaw taus are well under the
# European default because riders accept far shorter gaps, which is most of why a
# two-wheeler occupies so much less road than a car.
VEHICLES: dict[str, VehicleSpec] = {
    "two_wheeler": VehicleSpec(
        length_m=2.0,
        min_gap_m=1.0,
        tau_s=0.6,
        max_speed_ms=16.7,
        accel_ms2=3.0,
        decel_ms2=5.0,
        emergency_decel_ms2=9.0,
        sigma=0.6,
        indo_hcm_pcu=0.35,
        sumo_class="motorcycle",
        gui_shape="motorcycle",
    ),
    "car": VehicleSpec(
        length_m=4.5,
        min_gap_m=2.0,
        tau_s=1.0,
        max_speed_ms=16.7,
        accel_ms2=2.6,
        decel_ms2=4.5,
        emergency_decel_ms2=9.0,
        sigma=0.5,
        indo_hcm_pcu=1.00,
        sumo_class="passenger",
        gui_shape="passenger",
    ),
    "auto_rickshaw": VehicleSpec(
        length_m=3.2,
        min_gap_m=1.5,
        tau_s=0.9,
        max_speed_ms=12.5,
        accel_ms2=2.0,
        decel_ms2=4.0,
        emergency_decel_ms2=9.0,
        sigma=0.6,
        indo_hcm_pcu=0.80,
        sumo_class="passenger",
        gui_shape="passenger/van",
    ),
    "lcv": VehicleSpec(
        length_m=6.5,
        min_gap_m=2.5,
        tau_s=1.1,
        max_speed_ms=13.9,
        accel_ms2=1.5,
        decel_ms2=3.5,
        emergency_decel_ms2=7.0,
        sigma=0.5,
        indo_hcm_pcu=1.40,
        sumo_class="delivery",
        gui_shape="delivery",
    ),
    "bus": VehicleSpec(
        length_m=12.0,
        min_gap_m=2.5,
        tau_s=1.2,
        max_speed_ms=12.5,
        accel_ms2=1.2,
        decel_ms2=3.0,
        emergency_decel_ms2=7.0,
        sigma=0.4,
        indo_hcm_pcu=3.00,
        sumo_class="bus",
        gui_shape="bus",
    ),
}

CAR = VEHICLES["car"]


def simulated_pcu(name: str, speed_ms: float = DISCHARGE_SPEED_MS) -> float:
    """
    PCU the simulated vehicle actually reproduces, as a ratio of headways to a car.

    This is deliberately not indo_hcm_pcu. SUMO's default car-following model is
    longitudinal only: vehicles queue one behind another and never share a lane. A
    two-wheeler in that model still occupies a whole lane width, so it comes out near
    0.54 PCU where Indo-HCM measures 0.35 from streams in which two-wheelers filter
    between lanes. Closing that gap needs SUMO's sublane model, which roughly triples
    run time; docs/engine.md states the cost and what it would buy.

    Using this basis for capacity keeps one thing true that matters more than matching
    the published figure: the capacity the allocator spends is the capacity the
    simulation can actually deliver.
    """
    spec = VEHICLES.get(name)
    if spec is None:
        raise KeyError(f"Unknown vehicle type {name!r}. Known: {', '.join(VEHICLES)}.")
    return spec.headway_m(speed_ms) / CAR.headway_m(speed_ms)


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

    def mean_pcu(self, basis: PcuBasis = "simulated") -> float:
        """PCU of the average vehicle. Divides a PCU/h capacity to give vehicles/h."""
        if basis == "indo_hcm":
            per_type = {name: spec.indo_hcm_pcu for name, spec in VEHICLES.items()}
        else:
            per_type = {name: simulated_pcu(name) for name in VEHICLES}

        return sum(share * per_type[name] for name, share in self.shares().items())


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
