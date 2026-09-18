# Simulation results

> One run, 11 September 2026. Read the limitations at the bottom before quoting
> anything from here.

---

## Setup

| | |
|---|---|
| Network | OpenStreetMap extract of central Bhopal, 23.210–23.265 N, 77.385–77.445 E |
| Area | 6.1 × 6.1 km — MP Nagar, Arera Colony, Habibganj, TT Nagar, New Market |
| Drivable edges | 20,815 |
| Simulator | Eclipse SUMO 1.27.1 |
| Population | 600 synthetic commuters with generated routines |
| Road trips simulated | 436 (metro, walking and cycling excluded — no road capacity) |
| Zones | 12 |

**The experiment.** Two runs on the same network, with the same travellers, the
same origin/destination pairs, the same trip count and identical simulator
settings. **The only difference is departure time.**

| Scenario | Departures |
|---|---|
| `BASELINE` | every commuter at their usual time |
| `CITYFLOW` | every commuter at the time the engine recommended |

The optimiser reassigned **151 of 601** commuters (25%) before the export.

---

## Result

### Peak departures — the metric that matches the claim

The project's question is *"how do we prevent too many vehicles entering the
road network at the same time?"* That is departures per window.

| | Baseline | CityFlow | Change |
|---|---|---|---|
| **Busiest 15-minute window** | **52** | **39** | **−25.0%** |
| Share of trips in the 4 busiest windows | 35.8% | 29.6% | −6.2 pts |

### Where the trips went

```
    time      baseline  cityflow   change
    06:45            5        12       +7
    07:00            9        12       +3
    07:15           11        16       +5
    07:30           15        20       +5
    07:45           16        25       +9
    08:00           21        19       -2
    08:15           35        27       -8
    08:30           31        26       -5
    08:45           31        27       -4
    09:00           52        39      -13   <-- peak
    09:15           38        33       -5
    09:30           31        30       -1
    09:45           31        25       -6
    10:15           10        17       +7
```

Every window from 08:00 to 09:45 falls. Every window from 06:45 to 07:45 rises.
That is the shape demand smoothing is supposed to produce: the peak drains into
the shoulders rather than relocating somewhere else. **No new peak appears.**

### Network effects

| | Baseline | CityFlow | Change |
|---|---|---|---|
| Vehicles in the network at once (peak) | 18 | 14 | −22.2% |
| Mean travel time | 228 s | 227 s | −0.4% |
| Mean waiting time | 23 s | 23 s | 0.0% |
| Total delay | 32,193 s | 31,816 s | −1.2% |

**Travel time barely moves, and that is the expected result.** 436 vehicles
across 37 km² is far below congestion. With free-flowing roads, leaving at 08:00
instead of 09:00 does not change how long the drive takes. The mechanism
demonstrably flattens the demand peak; whether that shortens journeys requires a
load level this simulation did not reach.

The concurrent-vehicle figure moved from 18 to 14 — a real direction, but only
four vehicles. Treat the percentage with care.

---

## Why only 25% of commuters moved

The optimiser reports why each person stayed where they were:

| | Count | Share |
|---|---|---|
| Moved | 151 | 25% |
| Departure declared fixed | 156 | 26% |
| No quieter slot anywhere in their window | 213 | 35% |
| Best option better, but by under 4 points | 28 | 5% |
| Best option better by 4–8 points — blocked by the threshold | 41 | 7% |
| Already committed to a time | 1 | <1% |

**The binding constraint is commuter flexibility, not the engine's judgement.**

26% had declared a fixed departure time, and a further 35% had nothing quieter
anywhere inside the flexibility window they gave. **61% were structurally
unreachable before the engine's decision threshold came into it at all.** Only
7% had a meaningfully better option withheld by the 8-point rule.

### What that implies for the product

The highest-value change is not tuning the engine. It is **widening flexibility**
— asking for it differently, asking earlier in the day, or making the benefit of
a wider window visible to the person at the moment they set it.

---

## Parameter sensitivity

A numerical replication of the engine over a statistically similar population,
varying only the two constants that govern the decision:

| `TRIP_WEIGHT` | `MIN_MEANINGFUL_IMPROVEMENT` | Peak | Change | Moved |
|---|---|---|---|---|
| **2.5** | **8** | 59 | −22.4% | 163 |
| 2.5 | 4 | 57 | −25.0% | 187 |
| 1.0 | 8 | 48 | −36.8% | 214 |
| 1.0 | 4 | 49 | −35.5% | 248 |
| 0.5 | 8 | 52 | −31.6% | 212 |
| 0.25 | 8 | 56 | −26.3% | 217 |

**The relationship is not monotonic.** `TRIP_WEIGHT` is how much one extra trip
raises a slot's demand index. Set it high and each slot saturates after about
three arrivals, so nobody else can move there. Set it low and no slot ever looks
busy enough to push anyone away. There is an optimum between, near 1.0 for this
population.

**The shipped value was not changed.** These constants are modelling choices that
need calibration against real demand data, and tuning one until the result looks
better — then reporting only that run — would invalidate everything else here.
The sweep is reported as analysis, not as a result.

---

## Limitations

Stated plainly, because every one of them bounds what the numbers above mean.

**The travellers are synthetic.** 600 generated routines with a realistic
departure distribution and mode split. Every recommendation shown was produced
by the live engine — only the people are generated.

**The demand model is modelled, not measured.** There are no road sensors behind
CityFlow AI. The baseline curve reproduces the shape urban travel demand takes;
it is not a count of vehicles.

**Zone positions are arbitrary.** The TAZ file was generated by hashing each zone
name onto a slice of the network's edges, so "Kolar Road" is not where Kolar Road
is. **Absolute travel times are therefore meaningless** — only the comparison is
valid, because both scenarios use the identical zone file.

**This is one simulated day.** A result that appears once is noise. It needs
repeating across several days and demand levels before it supports a general
claim.

**436 vehicles is not a congested city.** The peak-flattening result holds at
this scale. The journey-time result cannot be assessed at this scale.

---

## What this run supports

> "In simulation on an OpenStreetMap network of central Bhopal (6.1 × 6.1 km,
> 20,815 drivable edges) with 436 modelled road trips, applying CityFlow AI's
> departure recommendations reduced the busiest 15-minute departure window from
> 52 to 39 vehicles (−25.0%) and lowered the share of trips falling in the four
> busiest windows from 35.8% to 29.6%, relative to a baseline in which all
> travellers departed at their usual times. Departures fell in every window
> between 08:00 and 09:45 and rose between 06:45 and 07:45, with no new peak
> forming elsewhere. Mean travel time was unchanged (−0.4%), as expected at a
> vehicle count well below network capacity."

## What it does not support

- "CityFlow AI reduces traffic by 25%" — this is departures in one window on one
  simulated day, not traffic, and not generally
- "Users save time" — no real journey was measured, and travel time did not move
- Anything at all inferred from the absolute travel times
