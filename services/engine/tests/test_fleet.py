import xml.etree.ElementTree as ET

import pytest

from core.fleet import INDIAN_URBAN_PEAK, VEHICLES, FleetMix, simulated_pcu
from sim.vehicles import write_vtypes


def test_a_car_is_one_pcu_by_definition() -> None:
    assert simulated_pcu("car") == pytest.approx(1.0)


def test_smaller_vehicles_take_less_road_than_a_car() -> None:
    assert simulated_pcu("two_wheeler") < simulated_pcu("auto_rickshaw") < 1.0


def test_larger_vehicles_take_more() -> None:
    assert simulated_pcu("lcv") > 1.0
    assert simulated_pcu("bus") > simulated_pcu("lcv")


def test_the_simulated_two_wheeler_is_heavier_than_the_published_figure() -> None:
    # Not a defect to be fixed by editing a constant. SUMO's default model is
    # longitudinal, so a two-wheeler holds a whole lane instead of filtering between
    # them, and it comes out near 0.54 PCU against Indo-HCM's measured 0.35. The
    # capacity model uses the simulated basis so that the capacity the allocator
    # spends is the capacity the simulation can deliver; docs/engine.md carries the
    # rest of the argument. This test fails if either number is quietly changed.
    assert simulated_pcu("two_wheeler") > VEHICLES["two_wheeler"].indo_hcm_pcu
    assert simulated_pcu("two_wheeler") == pytest.approx(0.54, abs=0.02)


def test_the_two_bases_disagree_by_a_stated_margin() -> None:
    published = INDIAN_URBAN_PEAK.mean_pcu("indo_hcm")
    simulated = INDIAN_URBAN_PEAK.mean_pcu("simulated")

    assert simulated > published
    assert simulated / published == pytest.approx(1.14, abs=0.02)


def test_an_all_car_fleet_averages_one_pcu_on_either_basis() -> None:
    all_cars = FleetMix(two_wheeler=0.0, car=1.0, auto_rickshaw=0.0, lcv=0.0, bus=0.0)

    assert all_cars.mean_pcu("simulated") == pytest.approx(1.0)
    assert all_cars.mean_pcu("indo_hcm") == pytest.approx(1.0)


def test_an_unknown_vehicle_is_refused_rather_than_defaulted() -> None:
    with pytest.raises(KeyError):
        simulated_pcu("tram")


def test_every_type_is_declared_even_at_zero_share() -> None:
    # A vehicle referring to an undeclared type is an error SUMO raises only after
    # several minutes spent loading the network, and a fleet that draws none of a type
    # in one run but does in the next would fail only sometimes.
    only_cars = FleetMix(two_wheeler=0.0, car=1.0, auto_rickshaw=0.0, lcv=0.0, bus=0.0)
    root = ET.Element("routes")

    write_vtypes(root, only_cars)

    assert {t.get("id") for t in root.findall("vType")} == set(VEHICLES)


def test_declared_types_carry_the_parameters_capacity_was_derived_from() -> None:
    root = ET.Element("routes")
    write_vtypes(root, INDIAN_URBAN_PEAK)

    scooter = next(t for t in root.findall("vType") if t.get("id") == "two_wheeler")
    spec = VEHICLES["two_wheeler"]

    assert float(scooter.get("length", 0)) == pytest.approx(spec.length_m)
    assert float(scooter.get("minGap", 0)) == pytest.approx(spec.min_gap_m)
    assert float(scooter.get("tau", 0)) == pytest.approx(spec.tau_s)
