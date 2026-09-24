#!/usr/bin/env python3
"""
Regenerates `ml/app/data/reference_traffic_profile.json` from its source
dataset. Run this by hand when the reference dataset is refreshed; it is not
run automatically and nothing in the service imports it.

SOURCE DATASET
"Metro Interstate Traffic Volume Data Set" -- UCI Machine Learning Repository,
donated by John Hogue. Hourly westbound traffic volume at Minnesota DOT ATR
station 301 on I-94, Minneapolis-St Paul, 2012-10-02 to 2018-09-30, combined
with hourly weather from OpenWeatherMap. Public dataset, provided for reuse
with attribution.
  https://archive.ics.uci.edu/dataset/492/metro+interstate+traffic+volume

This repository does not commit the raw CSV (it is a US sensor dataset with
weather columns this project has no use for, and there is no reason to carry
~4MB of somebody else's traffic counts in git for one derived table). To
regenerate:

  1. Download `Metro_Interstate_Traffic_Volume.csv` from the URL above (or its
     Kaggle mirror) and save it anywhere on disk.
  2. Run:
       python3 ml/scripts/calibrate_reference_profile.py <path-to-csv>
  3. Commit the resulting `ml/app/data/reference_traffic_profile.json` if it
     changed.

WHAT THIS COMPUTES, AND WHAT IT DELIBERATELY DOES NOT
For each hour of the day, the script averages `traffic_volume` across every
day in the dataset, split into weekday and weekend, then rescales each group
onto this project's existing 6-100 demand-index convention (floor=6, matching
`ml/app/services/synthetic.py`). That is the RELATIVE SHAPE of a real day of
urban traffic -- how peaked vs flat it is, how much quieter weekends are.

It does NOT calibrate peak TIMING. The source sensor's actual rush hours
(roughly 7am and 4-5pm, a US commute pattern) are not read out of this script
at all -- only the two output arrays' relative values by hour-of-day index are
kept, and the product's own peak timing (9:00 / 18:30, anchored to Indian
office hours in `synthetic.py`) is left untouched. Mixing those would quietly
import a Minneapolis commute clock into an Indian city's forecast.
"""

from __future__ import annotations

import csv
import datetime
import json
import sys
from collections import defaultdict
from pathlib import Path

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "reference_traffic_profile.json"

FLOOR = 6.0
CEILING = 100.0


def _load_hourly_means(csv_path: Path) -> dict[tuple[bool, int], float]:
    sums: dict[tuple[bool, int], float] = defaultdict(float)
    counts: dict[tuple[bool, int], int] = defaultdict(int)

    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                stamp = datetime.datetime.strptime(row["date_time"], "%Y-%m-%d %H:%M:%S")
            except (ValueError, KeyError):
                continue
            volume = float(row["traffic_volume"])
            is_weekend = stamp.weekday() >= 5
            key = (is_weekend, stamp.hour)
            sums[key] += volume
            counts[key] += 1

    if not counts:
        raise SystemExit(f"No usable rows found in {csv_path} -- wrong file?")

    return {key: sums[key] / counts[key] for key in sums}, sum(counts.values())


def _normalize(hourly: list[float]) -> list[float]:
    lo, hi = min(hourly), max(hourly)
    if hi == lo:
        raise SystemExit("Degenerate profile: every hour has the same volume.")
    return [round(FLOOR + (v - lo) / (hi - lo) * (CEILING - FLOOR), 2) for v in hourly]


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(f"Usage: {sys.argv[0]} <path-to-Metro_Interstate_Traffic_Volume.csv>")

    csv_path = Path(sys.argv[1])
    means, row_count = _load_hourly_means(csv_path)

    weekday = _normalize([means[(False, h)] for h in range(24)])
    weekend = _normalize([means[(True, h)] for h in range(24)])

    payload = {
        "$schema": "reference-traffic-profile-v1",
        "source": {
            "name": "Metro Interstate Traffic Volume Data Set",
            "origin": "UCI Machine Learning Repository, donated by John Hogue",
            "sensor": "Minnesota DOT ATR station 301, westbound I-94, Minneapolis-St Paul",
            "url": "https://archive.ics.uci.edu/dataset/492/metro+interstate+traffic+volume",
            "rows_used": row_count,
            "date_range": "2012-10-02 to 2018-09-30 (hourly)",
        },
        "methodology": (
            "Hourly traffic_volume averaged across all observed days, split by "
            "weekday vs weekend, then linearly rescaled per group onto the "
            "product's existing 6-100 demand-index convention (floor=6 matching "
            "ml/app/services/synthetic.py). This captures the RELATIVE shape of "
            "real observed urban traffic across a day (how flat vs peaked, how "
            "much quieter weekends are) as a feature for the XGBoost residual "
            "model. It intentionally does not override the product's own "
            "India-office-hours peak timing (9:00 / 18:30), since this sensor is "
            "a US interstate and its literal rush-hour clock time does not "
            "transfer to Indian commute patterns -- only its shape does."
        ),
        "weekday_hourly_index": weekday,
        "weekend_hourly_index": weekend,
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH} from {row_count} rows in {csv_path}")


if __name__ == "__main__":
    main()
