#!/usr/bin/env python3
"""
Fill in the zone (TAZ) file that SUMO needs, without an evening in netedit.

=============================== THE PROBLEM =================================
CityFlow AI exports trips that refer to areas by name:

    <trip id="..." fromTaz="kolar-road" toTaz="mp-nagar-zone-1" depart="..."/>

SUMO has no idea where "kolar-road" is. It needs a TAZ definition listing the
network edges that area covers:

    <taz id="kolar-road" edges="-123#0 -123#1 456#2 ..."/>

Those edge ids only exist once the network has been built, so the application
cannot generate them — it ships the template with edges="" and says so.

============================== WHAT THIS DOES ===============================
It assigns each zone a deterministic slice of the network's drivable edges, by
hashing the zone name. Same zone name, same network, same edges — every time.

======================= WHAT THIS IS AND IS NOT =============================
⚠️  THE ZONE POSITIONS ARE ARBITRARY. "Kolar Road" is not placed where Kolar
    Road actually is. This script knows nothing about real geography; it is
    spreading zones deterministically across whatever network you gave it.

    Therefore: ABSOLUTE travel times from this run are meaningless. Do not
    report "the average journey took 14 minutes" — it is not a real journey.

✅  THE COMPARISON IS STILL VALID, and this is the point. Both scenarios use
    the IDENTICAL zone file, the identical travellers, and the identical
    origin/destination pairs. The only thing that differs between the two runs
    is departure time. So a difference in the result is caused by departure
    times and by nothing else, which is exactly the claim being tested.

    Report the CHANGE (a percentage), never the absolute values.

To do it properly, open the network in netedit, select the streets in each real
area, and paste their edge ids in. This script is what lets you prove the
pipeline works first.
============================================================================
"""

import argparse
import hashlib
import sys
import xml.etree.ElementTree as ET

# Edge types that a car can actually drive on. Everything else — footways,
# cycleways, railways — would make duarouter fail or route a car down a
# pavement.
DRIVABLE_PREFIXES = (
    "highway.motorway",
    "highway.trunk",
    "highway.primary",
    "highway.secondary",
    "highway.tertiary",
    "highway.unclassified",
    "highway.residential",
    "highway.living_street",
)


def load_drivable_edges(net_path):
    """Every edge in the network a passenger car may use."""
    try:
        root = ET.parse(net_path).getroot()
    except (ET.ParseError, OSError) as error:
        sys.exit(f"✖ Could not read the network file {net_path}: {error}")

    edges = []

    for edge in root.findall("edge"):
        # function="internal" edges are the little connectors inside a
        # junction. They are not real road and cannot start or end a trip.
        if edge.get("function") == "internal":
            continue

        edge_id = edge.get("id")
        if not edge_id or edge_id.startswith(":"):
            continue

        edge_type = edge.get("type") or ""

        # Some networks carry no type attribute at all. Rather than throw the
        # whole edge away, fall back to checking the lanes allow a car.
        if edge_type:
            if not edge_type.startswith(DRIVABLE_PREFIXES):
                continue
        else:
            lanes = edge.findall("lane")
            if not lanes:
                continue
            disallow = lanes[0].get("disallow") or ""
            allow = lanes[0].get("allow") or ""
            if "passenger" in disallow:
                continue
            if allow and "passenger" not in allow and "all" not in allow:
                continue

        edges.append(edge_id)

    return edges


def zones_in(trips_paths):
    """Every zone name mentioned by the trip files, so none is left undefined."""
    zones = set()

    for path in trips_paths:
        try:
            root = ET.parse(path).getroot()
        except (ET.ParseError, OSError) as error:
            sys.exit(f"✖ Could not read the trips file {path}: {error}")

        for trip in root.iter("trip"):
            for attribute in ("fromTaz", "toTaz"):
                value = trip.get(attribute)
                if value:
                    zones.add(value)

    return sorted(zones)


def slice_for(zone, edges, per_zone):
    """
    A deterministic slice of the edge list for one zone.

    Hashing the NAME rather than using its position means adding a new zone
    never moves the existing ones — so a second run with one more area is still
    comparable with the first.
    """
    digest = hashlib.sha256(zone.encode("utf-8")).digest()
    start = int.from_bytes(digest[:4], "big") % max(1, len(edges))

    # Wrap around the end of the list rather than running short.
    return [edges[(start + offset) % len(edges)] for offset in range(per_zone)]


def main():
    parser = argparse.ArgumentParser(
        description="Generate a SUMO TAZ file from a network and CityFlow trip files."
    )
    parser.add_argument("network", help="the .net.xml produced by netconvert")
    parser.add_argument("trips", nargs="+", help="one or more .trips.xml files")
    parser.add_argument("-o", "--output", default="tazs.add.xml")
    parser.add_argument(
        "--edges-per-zone",
        type=int,
        default=12,
        help="how many edges each zone covers (default 12)",
    )
    args = parser.parse_args()

    edges = load_drivable_edges(args.network)
    if not edges:
        sys.exit(
            "✖ No drivable edges found in that network.\n"
            "  The OpenStreetMap extract may be too small, or may contain no roads.\n"
            "  Try exporting a larger area."
        )

    zones = zones_in(args.trips)
    if not zones:
        sys.exit("✖ No zones found in those trip files. Did the export produce any trips?")

    per_zone = max(1, min(args.edges_per_zone, len(edges)))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!--",
        "  Traffic analysis zones for a CityFlow AI simulation comparison.",
        "",
        "  ⚠️  ZONE POSITIONS ARE ARBITRARY. These were generated by hashing each",
        "      zone name onto a slice of this network's edges. They are NOT the",
        "      real locations of these areas.",
        "",
        "      Absolute travel times from this run are therefore meaningless.",
        "",
        "  ✅  The COMPARISON is valid: both scenarios use this identical file,",
        "      the same travellers and the same origin/destination pairs. Only",
        "      departure time differs between them, so any difference in the",
        "      result is attributable to departure time alone.",
        "",
        "      Report the CHANGE between scenarios, never the absolute numbers.",
        "-->",
        '<additional xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '            xsi:noNamespaceSchemaLocation="http://sumo.dlr.de/xsd/additional_file.xsd">',
    ]

    for zone in zones:
        assigned = " ".join(slice_for(zone, edges, per_zone))
        lines.append(f'    <taz id="{zone}" edges="{assigned}"/>')

    lines.append("</additional>")
    lines.append("")

    with open(args.output, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))

    print(f"✔ Wrote {args.output}")
    print(f"  {len(zones)} zones, {per_zone} edges each, from {len(edges)} drivable edges.")
    print("  Zone positions are arbitrary — compare the two scenarios, not the raw times.")


if __name__ == "__main__":
    main()
