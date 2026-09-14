import random
import xml.etree.ElementTree as ET

from core.fleet import VEHICLES, FleetMix


def sample_type(rng: random.Random, fleet: FleetMix) -> str:
    shares = fleet.shares()
    names = list(shares)
    return rng.choices(names, weights=[shares[n] for n in names], k=1)[0]


def write_vtypes(root: ET.Element, fleet: FleetMix) -> None:
    """
    Declares every vehicle type the population can draw, as the first children of a
    routes document.

    Types with a zero share are still declared. duarouter and sumo both reject a
    vehicle whose type is undefined, and a fleet that happens to draw none of a type
    in one run but does in the next would otherwise fail only sometimes.
    """
    for name in fleet.shares():
        spec = VEHICLES[name]
        ET.SubElement(
            root,
            "vType",
            id=name,
            vClass=spec.sumo_class,
            guiShape=spec.gui_shape,
            length=f"{spec.length_m:.2f}",
            minGap=f"{spec.min_gap_m:.2f}",
            tau=f"{spec.tau_s:.2f}",
            maxSpeed=f"{spec.max_speed_ms:.2f}",
            accel=f"{spec.accel_ms2:.2f}",
            decel=f"{spec.decel_ms2:.2f}",
            sigma=f"{spec.sigma:.2f}",
        )
