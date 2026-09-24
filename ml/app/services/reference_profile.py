"""
A real-world reference for the residual model -- not a replacement for the
product's own demand curve.

WHERE THIS FITS
`synthetic.py` is the product's own, hand-tuned prior: it is deliberately
anchored to Indian office hours (9:00 / 18:30 commute peaks) and is kept
byte-identical to the web application's `demand-model.ts` on purpose, so the
two systems never disagree about what a normal Tuesday looks like. That curve
is not touched here.

What this module adds is a genuinely external, dataset-derived signal: the
actual observed relative shape of a real day of urban road traffic (how peaked
vs flat it is, how much quieter weekends really are), computed once from a
real sensor dataset and given to the XGBoost residual stage in `forecast.py`
as one more tabular feature. Where the hand-tuned prior encodes "the shape we
expect," this feature encodes "the shape a real road actually measured" --
letting the residual model learn how much weight to put on that agreement or
disagreement, rather than asserting anything about it here.

DATA SOURCE
`ml/app/data/reference_traffic_profile.json` is a small, pre-computed table
(48 numbers: an hourly index for weekday and weekend), not the raw dataset --
the full sensor CSV is too large and not India-specific enough to be worth
committing. See `ml/scripts/calibrate_reference_profile.py` for the exact,
reproducible aggregation that produced it, and its own docstring for the
dataset's source, license and citation.

WHY ONLY SHAPE, NOT TIMING
The source sensor is a US interstate (Minneapolis-St Paul). Its literal
rush-hour clock times do not transfer to an Indian city's commute pattern, so
this module is deliberately used only for its RELATIVE hour-to-hour shape
(how flat vs peaked a day is), read off by weekday/weekend -- never for
"traffic peaks at 7am" style claims, which would be true for that sensor and
false for the cities this product serves.
"""

from __future__ import annotations

import json
from datetime import date
from functools import lru_cache
from pathlib import Path

_PROFILE_PATH = Path(__file__).resolve().parent.parent / "data" / "reference_traffic_profile.json"


@lru_cache(maxsize=1)
def _load() -> dict:
    with _PROFILE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def reference_index(day: date, minute_of_day: int) -> float:
    """
    The real-data-calibrated traffic index (0-100) for this hour of this kind
    of day, linearly interpolated between the two nearest hourly buckets.

    This is a SHAPE feature, not a forecast in its own right -- callers pass
    it to a model as one input among several, they do not display it alone.
    """
    profile = _load()
    key = "weekend_hourly_index" if day.weekday() >= 5 else "weekday_hourly_index"
    values = profile[key]

    hour_float = (minute_of_day / 60.0) % 24
    lo = int(hour_float) % 24
    hi = (lo + 1) % 24
    frac = hour_float - int(hour_float)

    return values[lo] * (1 - frac) + values[hi] * frac


def source_citation() -> str:
    """One line, safe to surface in docs or an admin screen."""
    source = _load()["source"]
    return f"{source['name']} ({source['origin']}), {source['sensor']} -- {source['url']}"
