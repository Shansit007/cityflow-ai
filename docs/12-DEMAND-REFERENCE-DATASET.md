# A real dataset in the demand forecasting loop

The `ml/` service's residual model (see `ml/app/services/forecast.py`) is
Prophet fitted to a seasonal shape, corrected by XGBoost on a handful of
tabular features: time of day, day of week, active events, forecast rain.
Every one of those, until now, was either a calendar fact or something the
product itself defines. Nothing in the training loop had ever seen a real,
independently measured road.

This adds one: `reference_traffic_index`, a feature read from
`ml/app/services/reference_profile.py`, calibrated from a real public traffic
sensor dataset.

---

## What was added, and what deliberately was not

**Added:** a 48-number table (`ml/app/data/reference_traffic_profile.json`) —
one relative traffic index per hour of the day, for a weekday and for a
weekend — computed once from a real dataset and handed to XGBoost as one more
feature it can learn to weight.

**Not touched:** `ml/app/services/synthetic.py` and the web app's
`src/lib/demand/demand-model.ts`. Those two are the product's own seasonal
prior, deliberately anchored to Indian office hours (9:00 / 18:30) and kept
byte-identical to each other on purpose — replacing that curve with a foreign
dataset's literal shape would have meant importing a Minneapolis commute clock
into an Indian city's forecast, and it would have invalidated the SUMO
baseline already recorded in `09-RESULTS.md`, which was run against the
existing curve. So the real dataset was added as a *feature the residual
model can lean on*, not as a replacement for the product's own demand curve.

---

## The dataset

**Metro Interstate Traffic Volume Data Set** — UCI Machine Learning
Repository, donated by John Hogue. Hourly westbound traffic volume at
Minnesota DOT ATR station 301 on I-94 (Minneapolis–St Paul), 2012-10-02 to
2018-09-30 — 48,204 hourly readings, combined with OpenWeatherMap weather.
Public dataset, provided for reuse with attribution.

<https://archive.ics.uci.edu/dataset/492/metro+interstate+traffic+volume>

The raw CSV is not committed to this repository — it is a US highway sensor
feed with weather columns this project has no use for, and there is no reason
to carry someone else's multi-megabyte dataset in git for one derived table.
What is committed is the small table it produced.

## Methodology

For every hour of the day, `traffic_volume` was averaged across all 2,008
days in the dataset, split into weekday and weekend. Each group was then
linearly rescaled onto the product's existing 6–100 demand-index convention
(floor = 6, matching `synthetic.py`).

That produces the *relative shape* of a real measured day — how peaked versus
flat it is, and how much quieter weekends really are — without adopting the
sensor's literal rush-hour clock times, which belong to a different city on a
different continent.

One finding from this calibration is worth stating plainly: the real sensor's
daytime trough between its two peaks never drops below roughly 70% of its
peak value — considerably shallower than a hand-tuned curve might assume.
Real urban daytime traffic stays more sustained than an idealised
morning-spike / evening-spike model suggests. XGBoost is left to decide how
much that matters relative to the other features; nothing here forces the
product's own curve to agree with it.

Reproducing the table (only needed if the source dataset is refreshed):

```bash
python3 ml/scripts/calibrate_reference_profile.py <path-to-downloaded-csv>
```

See that script's docstring for the exact steps and the full reasoning above.

## Tests

`ml/tests/test_reference_profile.py` — the feature stays inside the product's
0–100 scale, interpolates sanely between hourly buckets, is deterministic, and
weekday/weekend genuinely differ. `ml/tests/test_forecast.py`'s existing
residual-stage tests exercise `_features()`, which now includes this column.

## Where this sits relative to "the ML service is deployed"

This feature only ever reaches a forecast when the residual (XGBoost) stage
runs at all — which requires three weeks of real observed trips *and* the
`ml/` service actually being reachable from the web app
(`ML_SERVICE_URL` configured; see `ml/README.md` and `docs/ARCHITECTURE.md`).
Without that, the web app's built-in TypeScript demand model is used, as
before, and correctly says so.
