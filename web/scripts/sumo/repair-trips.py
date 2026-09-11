#!/usr/bin/env python3
"""
Repair a trips file exported before the XML-comment bug was fixed.

============================== THE BUG =====================================
XML forbids a double hyphen inside a comment — "--" is the sequence that ends
one. CityFlow AI's exporter used to print an example command line in the file's
header comment:

    duarouter -n <net.net.xml> --taz-files tazs.add.xml

…which made every exported file invalid XML. Both SUMO's parser and Python's
reject it, at the very first step of the pipeline:

    not well-formed (invalid token): line 18, column 33

The exporter has been fixed. This script exists so files downloaded BEFORE that
fix still work, without making you re-export everything.

============================ WHAT IT CHANGES ===============================
The header comment, and nothing else. Every <trip> element is untouched, so the
repaired file describes exactly the same journeys as the original.
============================================================================
"""

import re
import sys
from pathlib import Path


def repair(text):
    """Replace any double hyphen inside a comment block with a single one."""
    def clean(match):
        body = match.group(1)
        # Collapse runs of hyphens down to one. The text stays readable and the
        # comment becomes legal.
        return "<!--" + re.sub(r"-{2,}", "-", body) + "-->"

    return re.sub(r"<!--(.*?)-->", clean, text, flags=re.DOTALL)


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: repair-trips.py <file.trips.xml> [more files…]")

    for name in sys.argv[1:]:
        path = Path(name)
        if not path.exists():
            print(f"  skipped (not found): {name}")
            continue

        original = path.read_text(encoding="utf-8")
        repaired = repair(original)

        if repaired == original:
            print(f"  already valid: {path.name}")
            continue

        path.write_text(repaired, encoding="utf-8")
        print(f"  repaired header: {path.name}")


if __name__ == "__main__":
    main()
