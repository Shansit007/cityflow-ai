import pytest

from core.capacity import (
    STANDARD_LANE_WIDTH_M,
    UnknownRoadClass,
    lane_width_factor,
    segment_capacity_pcu,
    segment_capacity_vph,
)
from core.fleet import INDIAN_URBAN_PEAK, FleetMix


def test_capacity_scales_with_lanes() -> None:
    one = segment_capacity_pcu("primary", lanes=1)
    three = segment_capacity_pcu("primary", lanes=3)

    assert three == pytest.approx(3 * one)


def test_green_ratio_separates_arterial_from_motorway() -> None:
    # Same lane count, similar saturation flow: the difference is that an arterial
    # only gets a share of the cycle. A model that ignored signals would call these
    # roads nearly equal, which is the mistake this table exists to prevent.
    arterial = segment_capacity_pcu("primary", lanes=2)
    motorway = segment_capacity_pcu("motorway", lanes=2)

    assert motorway > 2 * arterial


def test_two_wheeler_heavy_fleet_carries_more_vehicles_than_pcu() -> None:
    pcu = segment_capacity_pcu("primary", lanes=2)
    vph = segment_capacity_vph("primary", lanes=2, fleet=INDIAN_URBAN_PEAK)

    assert vph > pcu


def test_all_car_fleet_gives_capacity_equal_to_pcu() -> None:
    all_cars = FleetMix(two_wheeler=0.0, car=1.0, auto_rickshaw=0.0, lcv=0.0, bus=0.0)

    pcu = segment_capacity_pcu("secondary", lanes=2)
    vph = segment_capacity_vph("secondary", lanes=2, fleet=all_cars)

    assert vph == round(pcu)


def test_bengaluru_arterial_capacity_is_in_a_plausible_range() -> None:
    # A four-lane divided arterial, two lanes per direction. Indo-HCM and IRC:106
    # put this class in the low thousands of vehicles per hour per direction; a
    # result outside that means the formula or a constant has drifted.
    vph = segment_capacity_vph("primary", lanes=2, fleet=INDIAN_URBAN_PEAK)

    assert 1800 <= vph <= 3600


@pytest.mark.parametrize("width", [2.5, 3.0, 3.658, 4.5, 6.0])
def test_width_factor_stays_within_its_fitted_range(width: float) -> None:
    assert 0.85 <= lane_width_factor(width) <= 1.10


def test_standard_width_is_the_unadjusted_case() -> None:
    assert lane_width_factor(STANDARD_LANE_WIDTH_M) == pytest.approx(1.0)


def test_unknown_highway_class_is_refused_rather_than_guessed() -> None:
    with pytest.raises(UnknownRoadClass):
        segment_capacity_pcu("cycleway", lanes=1)


def test_zero_lanes_is_refused() -> None:
    with pytest.raises(ValueError):
        segment_capacity_pcu("primary", lanes=0)


def test_fleet_shares_must_sum_to_one() -> None:
    with pytest.raises(ValueError):
        FleetMix(two_wheeler=0.9, car=0.9, auto_rickshaw=0.0, lcv=0.0, bus=0.0)
