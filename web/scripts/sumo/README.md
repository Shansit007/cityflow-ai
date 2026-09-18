# SUMO comparison — one command

```bash
./run-comparison.sh city.osm.xml <baseline>.trips.xml <cityflow>.trips.xml
```

## What you need first

**1. A road network.** Go to <https://www.openstreetmap.org>, find your city,
click **Export**, and drag a box around **one district** — not the whole city.
A full metro is millions of edges and will take hours. Save it as
`city.osm.xml` in this folder.

> If the web export refuses because the area is too large, the box is too big.
> Make it smaller.

**2. The two trip files.** Admin Portal → **Simulation** → download both
`…-baseline.trips.xml` and `…-cityflow.trips.xml` into this folder.

---

## What happens

| Step | Tool | Produces |
|---|---|---|
| 1 | `netconvert` | `city.net.xml` |
| 2 | `make-tazs.py` | `tazs.add.xml` |
| 3 | `duarouter` ×2 | `baseline.rou.xml`, `cityflow.rou.xml` |
| 4 | `sumo` ×2 | `*.tripinfo.xml`, `*.summary.xml` |
| — | `read-metrics.py` | the five numbers, side by side |

Then type those into **Admin Portal → Simulation → Record a simulation result**,
once for each scenario, with the **same** network description on both.

---

## The honesty that makes this worth anything

**Zone positions are arbitrary.** `make-tazs.py` hashes each zone name onto a
slice of the network's edges. "Kolar Road" is not where Kolar Road is. So the
**absolute travel times mean nothing** — never report "the average journey took
14 minutes".

**The comparison is still valid**, and that is the point. Both runs use the
identical zone file, the identical travellers, the identical origin/destination
pairs and identical simulation settings. **Only departure time differs.** So a
difference in the result is caused by departure time and nothing else — which
is exactly the claim being tested.

**Report the change, as a percentage.**

To do it properly, open `city.net.xml` in **netedit**, select the streets in
each real area, and paste their edge ids into `tazs.add.xml`. This script is
what lets you prove the pipeline works before you spend that evening.

---

## What one run can and cannot support

**Can:**

> "In simulation on an OpenStreetMap network of <area>, with <N> modelled
> travellers, shifting departures according to CityFlow AI's recommendations
> reduced the busiest 15-minute vehicle count by X% relative to a baseline where
> all travellers departed at their usual times."

**Cannot:**

- "CityFlow AI reduces traffic by X%" — one simulated day is not a general result
- "Users save Y minutes" — nobody's real journey was measured
- Anything at all from a single pair of runs

Repeat across several days and demand levels before claiming anything. A result
that appears on one day is noise.

Full background: [`docs/04-SUMO-EVALUATION.md`](../../../docs/04-SUMO-EVALUATION.md)
