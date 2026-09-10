# Evaluating CityFlow AI with SUMO and OpenStreetMap

This is how you test the project's central claim:

> **Spreading departure times across nearby slots reduces the peak, rather than
> moving it.**

Everything here is free and open source. No account, no API key, no billing.

---

## What the web app does and does not do

| | |
|---|---|
| **CityFlow AI does** | produce the demand files, and store the results you bring back |
| **CityFlow AI does not** | run SUMO |

SUMO is a desktop simulator. A serverless web app cannot host it, and a button
labelled "Run simulation" that quietly produced numbers would be fabricating the
project's most important evidence. So the loop is explicit and you can see every
step of it.

---

## The experiment

Two simulations, on **the same road network**, with:

- the same travellers
- the same origins and destinations
- the same total number of trips

**The only difference is departure time.**

| Scenario | Departure times |
|---|---|
| `BASELINE` | everyone leaves at their normal time |
| `CITYFLOW` | everyone leaves at the time CityFlow AI recommended (or the time they confirmed) |

Because everything else is held constant, any difference in the results is
caused by demand smoothing and nothing else. That is what makes the comparison
worth anything.

---

## Install SUMO

**macOS:**
```bash
brew install --cask sumo-gui
```
or download from <https://sumo.dlr.de/docs/Downloads.php>

Check it worked:
```bash
sumo --version
netconvert --version
duarouter --version
```

---

## Step 1 — Get a road network from OpenStreetMap

1. Open <https://www.openstreetmap.org>
2. Navigate to your city
3. Click **Export**, drag a box around the area you want (start small — a
   district, not the whole city; a full metro is millions of edges)
4. If the area is too large for the web export, use
   <https://download.geofabrik.de> and clip it

Then convert it:

```bash
netconvert --osm-files bhopal.osm.xml -o bhopal.net.xml \
           --geometry.remove --roundabouts.guess --ramps.guess \
           --junctions.join --tls.guess-signals --tls.discard-simple
```

Those flags clean up the raw OSM data: merge redundant geometry, infer
roundabouts and motorway ramps, join clustered junctions, and guess traffic
signals. Without them the network has thousands of artificial junctions and the
simulation grinds.

---

## Step 2 — Export demand from the Admin Portal

Go to **Admin Portal → Simulation**, pick your city, and download:

| File | What it is |
|---|---|
| `…-baseline.trips.xml` | The baseline day |
| `…-cityflow.trips.xml` | The CityFlow AI day |
| `…-tazs.add.xml` | The zone template |

### Fill in the zone file

The trips refer to zones by name (`fromTaz="salt-lake-sector-5"`). SUMO needs to
know which network edges each zone covers:

```xml
<taz id="salt-lake-sector-5" edges="-123#0 -123#1 456#2 457#0" />
```

**CityFlow AI cannot generate these.** Edge ids only exist once you have built
the network, and a guessed value would produce a simulation that runs and
produces numbers that mean nothing. The template ships with `edges=""` and says
so.

To find edge ids: open `bhopal.net.xml` in **netedit** (ships with SUMO), select
the streets in each area, and copy their ids.

> **Shortcut for a first run:** give every zone the same handful of edges. The
> absolute travel times will be meaningless, but the *relative* comparison
> between baseline and CityFlow is still valid, because both scenarios use the
> identical zone definitions. Good enough to prove the pipeline works before you
> spend an evening in netedit.

---

## Step 3 — Route both scenarios

```bash
duarouter -n bhopal.net.xml --taz-files tazs.add.xml \
          -t baseline.trips.xml -o baseline.rou.xml \
          --ignore-errors

duarouter -n bhopal.net.xml --taz-files tazs.add.xml \
          -t cityflow.trips.xml -o cityflow.rou.xml \
          --ignore-errors
```

`--ignore-errors` skips trips whose origin and destination are not connected —
common with a clipped network. Check how many were skipped; if it is a large
share, widen your OSM extract.

---

## Step 4 — Run both

**Identical settings for both.** Any difference in configuration invalidates the
comparison.

```bash
sumo -n bhopal.net.xml -r baseline.rou.xml \
     --tripinfo-output baseline.tripinfo.xml \
     --summary baseline.summary.xml \
     --no-warnings

sumo -n bhopal.net.xml -r cityflow.rou.xml \
     --tripinfo-output cityflow.tripinfo.xml \
     --summary cityflow.summary.xml \
     --no-warnings
```

Use `sumo-gui` instead of `sumo` if you want to watch it — good for a demo,
slower for a real run.

---

## Step 5 — Read the metrics

The Admin Portal form asks for five numbers. Here is where each one comes from.

### From `*.summary.xml`

```xml
<step time="..." loaded="..." inserted="..." running="..." ended="..." />
```

| Portal field | Where |
|---|---|
| **Vehicles departed** | the final `ended` value, or `inserted` |
| **Busiest 15-minute slot** | the largest `running` value across any 900-second window |

### From `*.tripinfo.xml`

Each `<tripinfo>` element carries `duration`, `waitingTime` and `timeLoss`.

| Portal field | How |
|---|---|
| **Mean travel time** | mean of `duration` |
| **Mean waiting time** | mean of `waitingTime` |
| **Total delay** | sum of `timeLoss` |

A one-liner to compute them:

```bash
python3 - <<'PY'
import xml.etree.ElementTree as ET, sys
for name in ("baseline", "cityflow"):
    root = ET.parse(f"{name}.tripinfo.xml").getroot()
    trips = root.findall("tripinfo")
    if not trips:
        print(f"{name}: no trips"); continue
    dur  = [float(t.get("duration", 0))    for t in trips]
    wait = [float(t.get("waitingTime", 0)) for t in trips]
    loss = [float(t.get("timeLoss", 0))    for t in trips]
    print(f"\n{name}:")
    print(f"  vehicles           {len(trips)}")
    print(f"  mean travel time   {round(sum(dur)/len(dur))} s")
    print(f"  mean waiting time  {round(sum(wait)/len(wait))} s")
    print(f"  total delay        {round(sum(loss))} s")
PY
```

---

## Step 6 — Record both runs

**Admin Portal → Simulation → Record a simulation result.**

Enter each scenario separately. Put the **same** network description on both —
the portal warns you if they differ, because a difference in network makes the
comparison meaningless.

The comparison table then shows both, with the change on each measure. A
negative change means CityFlow AI's day was better.

---

## How to report this honestly

**What the result can support:**

> "In simulation on an OpenStreetMap network of <area>, with <N> modelled
> travellers, shifting departures according to CityFlow AI's recommendations
> reduced the busiest 15-minute vehicle count by X% and mean travel time by Y%
> relative to a baseline where all travellers departed at their usual times."

**What it cannot support:**

- "CityFlow AI reduces traffic by X%" — one simulated day is not a general result
- "Users save Y minutes" — nobody's real journey was measured
- Anything at all from a single pair of runs

**Do this before claiming anything:** repeat across several days and demand
levels. A result that only appears on one day is noise. Also report how many
trips `duarouter` skipped, and whether your zone edges were real or the
shortcut above — both change how much the numbers mean.

**The most important honest note:** the demand itself is modelled, not measured.
The travellers in the simulation come from real registered routines, but the
baseline demand curve is a model of how urban travel demand behaves, not a count
of vehicles on a road. The simulation tests whether *demand smoothing works as a
mechanism* — it does not measure a real city.
