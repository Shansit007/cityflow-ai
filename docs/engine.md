# Engine

How a road's capacity is computed, how the simulated population is built, and the rule
that decides whether a simulation run may be quoted.

## Capacity

A segment's capacity is the number of vehicles per hour it can absorb in one direction.

```
capacity_pcu = lanes x saturation_flow x width_factor x green_ratio
capacity_vph = capacity_pcu / mean_pcu(fleet)
```

`saturation_flow` is the rate at which vehicles discharge from a standing queue on a
green signal, in PCU per hour per lane. `green_ratio` is effective green over cycle
length: an arterial is only usable for the share of the cycle its signals allow, which
is what separates its raw discharge rate from the flow it actually carries. Both are
per road class, in `services/engine/core/capacity.py`, and follow **Indo-HCM (CSIR-CRRI,
2017), Volume 2**, for Indian urban roads. The green ratios are class-typical rather
than measured at any specific junction, which is the largest single source of error in
the figure.

`width_factor` is the HCM 6th edition lane-width adjustment converted from feet, and
clamped to [0.85, 1.10] because the linear form stops meaning anything outside the
range it was fitted over and OSM width tags contain both typos and genuinely unusual
geometry.

A worked example, a two-lane-per-direction primary arterial at standard lane width:

```
2 lanes x 1800 PCU/h/lane x 1.00 x 0.45 = 1620 PCU/h
1620 / 0.722                            = 2245 vehicles/h
```

### Where the lane count comes from

OSM tags lanes on arterials and almost never on residential streets, so most segments
take a per-class default from `core/osm.py`. `road_segments.lanes_tagged` records which
is which, because a capacity column that looks uniformly derived from map data when
most of it rests on an assumption invites exactly one question, and the answer should
be in the schema rather than in someone's memory. OSM also tags the whole carriageway,
so a two-way street's count is halved on load; capacity is always per direction.

## Two PCU bases, and why they disagree

Dividing by `mean_pcu` is what makes the figure Indian. In a stream that is 62%
two-wheelers the average vehicle occupies far less road than a car, so the same
tarmac carries substantially more vehicles per hour than its PCU capacity. Ignoring
this understates capacity by about a third and would have the allocator shifting people
who did not need to move.

There are two defensible numbers for a two-wheeler's PCU and the repo carries both.

| Vehicle        | Indo-HCM  | Simulated |               |
| -------------- | --------- | --------- | ------------- |
| two-wheeler    | 0.35      | 0.539     |               |
| car            | 1.00      | 1.000     | by definition |
| auto-rickshaw  | 0.80      | 0.822     |               |
| LCV            | 1.40      | 1.225     |               |
| bus            | 3.00      | 1.652     |               |
| **fleet mean** | **0.635** | **0.722** | 14% apart     |

`indo_hcm_pcu` is the published planning figure. `simulated_pcu` is derived from the
car-following parameters the simulation actually runs — length, minimum gap and
reaction time — as a ratio of headways at a 30 km/h discharge speed:

```
pcu(v) = (length + min_gap + tau x 8.33) / (length_car + min_gap_car + tau_car x 8.33)
```

The auto-rickshaw agrees closely. The two-wheeler does not, and the reason is
structural rather than a constant needing adjustment: SUMO's default car-following
model is longitudinal, so a two-wheeler queues behind the vehicle in front and holds a
whole lane, where Indo-HCM's 0.35 is measured in streams whose two-wheelers filter
between lanes. The bus is lower for a related reason — Indo-HCM's 3.00 prices in
bus-stop dwell and lateral clearance, not just headway.

Closing the gap needs SUMO's sublane model (`--lateral-resolution`), which roughly
triples run time and so is not the default for a sweep that runs the network fourteen
times.

**The capacity model therefore defaults to the simulated basis.** Matching the
published number matters less than one thing that matters more: the capacity the
allocator spends has to be the capacity the simulation can actually deliver, or the
measured effect is partly the gap between the two. `basis="indo_hcm"` is available and
`tests/test_fleet.py` fails if either figure is quietly edited.

## Demand

The simulated population is synthetic. Its structure, in `sim/demand.py`:

- **Departure times** are bimodal — a morning peak centred at 08:45 with a 50-minute
  spread and a flatter evening peak at 18:30 with 70 minutes, since going home is less
  tightly bound to a fixed time than arriving at work. Centres and spreads are
  modelling choices, not counts.
- **Flexibility** is drawn from a fixed distribution: 25% of travellers have none, and
  the rest have 15, 30 or 45 minutes. The share with none is the ceiling on what any
  departure-shifting system can achieve, which makes it the most consequential
  assumption in the model.
- **Participation** is a draw in [0, 1) fixed per traveller, so participation at 5%
  adoption is `draw < 0.05`. Cohorts nest: everyone using the app at 5% is still using
  it at 20%. Redrawing per level would let a difference between levels be _who_
  participates rather than _how many_, and the adoption sweep would measure nothing in
  particular.
- **Vehicle type** is drawn from the same fleet mix the capacity model divides by, and
  written into the scenario as a SUMO `vType`.

### Origin and destination

Destinations follow a gravity model with exponential distance decay. Endpoints are
bucketed into 500 m cells; a journey picks a destination cell with weight
`street_length x exp(-distance / 4500 m)`, then an edge inside it. The cell is the unit
because a per-edge draw over ~50,000 candidates costs 50,000 operations per trip, and
the distribution it approximates is the same one.

### Journeys have a direction

Street length within a cell stands in for how many people live there. It says nothing
about where they work, and a first version used it for both ends of the journey. That
produced a city with no centre: origins and destinations spread identically, journeys
scattered across the whole extract, and the busiest segment in the busiest quarter of
an hour reached a fraction of its capacity. A departure-time allocator has nothing to
do in a city that never fills up, and three consecutive baselines measured exactly
that.

Real cities congest because of structure, not volume. People leave a dispersed
periphery and converge on a few employment districts along a few radial arterials,
which saturate while the residential grid stays empty.

So `core/cities.py` carries the city's employment districts, and a cell's attraction as
a _destination_ is its street length weighted by how much employment reaches it:

```
employment(cell) = street_length(cell) x Σ_districts weight x exp(-distance / 1200 m)
```

A morning journey draws its origin from residential mass and its destination from
employment mass; an evening journey reverses both. The 1200 m radius is the size of a
commercial district rather than a point, because the streets around an office area
absorb its arrivals.

The districts are the approximate centroids of Bengaluru's main commercial areas —
MG Road, Koramangala, Indiranagar, Domlur, Rajajinagar, Jayanagar — placed from their
well-known locations and weighted by relative pull, not from an employment survey.
Whitefield and Electronic City are the city's two largest employment centres and both
fall outside this extract, so the tide modelled here is the one into the central
districts only. A city with no districts listed falls back to street length at both
ends, and will not congest.

On the Bengaluru extract the 4.5 km decay gives a mean straight-line journey of 4.97 km
(median 4.42, p90 9.48), which is 8.2 km by road as routed.

### How much demand

The number of journeys is a calibration, not a fact: it is chosen so the baseline
congests without breaking down, since a network that never exceeds capacity gives a
departure-time allocator nothing to do and one that gridlocks cannot be measured at
all. `run_baseline.py --demand-share` thins the routed population at run time, keyed on
a stable hash of the trip id, so finding that level costs a simulation rather than a
re-route. `run_allocation.py` reports, in about ten seconds and without simulating
anything, how many segment-windows the untouched departures push over capacity. That
is the question a demand level is chosen to answer, and a far more direct one than
whether mean delay looks high enough. Levels nest: lowering the share removes
travellers and never substitutes them, so two runs at different levels differ only in
how many people are on the road.

Every result records the share it was produced at. A delay figure without one is not a
figure.

## Why a run can be invalid

SUMO removes a vehicle that has been immobile for five minutes and counts it as a
teleport. A handful are the price of simulating a real network. A large number mean the
run has gridlocked, and an average delay taken over the survivors of a gridlock is not
a measurement of anything.

`sim/runner.py` therefore records `teleport_share`, a breakdown by cause and a boolean
`valid` alongside every result, with the threshold at 1%, and `run_baseline.py` exits
non-zero when a run fails it. Two baselines have failed this gate, for unrelated
reasons, and neither announced itself in the averages.

### First failure: the simulation and the capacity model disagreed

The first CityFlow baseline failed the gate badly and looked fine:

```
cohort           20,604 trips, 08:00-10:00
mean delay       1354.5 s  (22.6 min)
mean speed       8.0 km/h
teleports        2,684  (13.0%, of which 1,973 for jam)
```

Two things were wrong, and both are the kind that produce a plausible number rather
than an error.

**The simulation ran the wrong vehicles.** No `vType` was ever declared, so all 20,604
vehicles were SUMO's default 4.5 m passenger car, on a network whose capacity had been
computed by dividing by a fleet mean of 0.635 PCU. The simulation was loading the
network 1.575 times more heavily than the capacity model it was supposed to be testing.
The two halves of the project disagreed about what a vehicle was.

**Journeys were too long.** Origins and destinations were drawn independently, weighted
only by street length, which over a 15 km extract gives a mean straight-line separation
of 7.40 km and a mean route of 11.6 km. Real commutes inside a city core are not
uniform over its area. The network was saturating on vehicle-kilometres rather than on
peaking, which is precisely the thing the project claims to address.

Declaring the fleet and replacing uniform sampling with distance decay cuts PCU-
kilometres to roughly 48% of the original: 0.722/1.0 from the fleet, 0.67 from the
shorter journeys.

### Second failure: the fleet could not be simulated at the default step

The next run was not congested at all — 167 s mean time loss, 9 km/h, 76 s of waiting —
and still failed, this time with every teleport attributed to a collision:

```
cohort           20,697 trips, 08:00-10:00
mean delay        167.5 s
teleports        15,729  (76.0%, all collisions, zero for jam)
```

Declaring the fleet had introduced the problem that fixed the first one. A driver's
`tau` is the headway they aim to keep, and the car-following model cannot work out a
safe speed for a headway shorter than one simulation step. SUMO's default step is 1 s;
the two-wheeler's tau is 0.6 s and the auto-rickshaw's 0.9 s, so 69% of the fleet was
asking for something the solver could not represent. Vehicles drove into each other and
were teleported out.

The short headway is not a parameter to raise — it is most of why a two-wheeler occupies
less road than a car, and `simulated_pcu` is derived from it. So the step comes down to
0.5 s instead, which doubles run time. `tests/test_fleet.py` asserts that no tau is below
the step, so lowering one or raising the other fails a test rather than a baseline.

Two smaller changes went with it. `--collision.mingap-factor` is set to 0, because at
SUMO's default of 1.0 a vehicle closer to its leader than its own minimum gap is
recorded as having crashed — which would count the very tailgating that makes a
two-wheeler efficient as a pile-up. And every type gets an `emergencyDecel` above the
hardest normal braking in the fleet, because a follower computes its safe speed assuming
the leader brakes no harder than it can itself: a bus behind a two-wheeler that stops at
5 m/s2 collides by construction otherwise.

### Why the breakdown by cause is recorded

These two failures produced the same headline number — a large `teleport_share` — from
opposite causes. The first was a network over-saturated with traffic; the second was a
network almost empty of it. Reading only the total sent the first investigation at the
wrong problem, so `teleports_by_cause` is now part of every result: a run failing on
`jam` wants less demand, one failing on `collisions` wants neither more nor less of it.

A congested baseline is wanted. A broken-down one is not, because the treatment run has
to be compared against it, and two gridlocks are not comparable.

## Detecting road defects

A phone in a moving vehicle is an accelerometer with a network connection. Two studies
established that this is enough to find potholes and are the prior art here: MIT's
**Pothole Patrol** (Eriksson et al., MobiSys 2008), which detects defects from vertical
acceleration spikes gated on speed, and Microsoft Research India's **Nericell** (Mohan
et al., SenSys 2008), which added braking and honking detection and handled the phone
sitting at an arbitrary orientation. The design below follows both and departs from
them where a browser forces it to.

### Features

Acceleration is reduced to the magnitude of the vector rather than its z component,
which is what lets the phone ride in a pocket or a cradle at any angle. It costs the
ability to separate a vertical jolt from a lateral swerve — a trade Nericell makes and
documents too. Over a one-second window, stepped every half second:

| Feature                              | What it separates                           |
| ------------------------------------ | ------------------------------------------- |
| variance of magnitude                | smooth tarmac from generally broken surface |
| peak deviation from the window mean  | the size of the worst jolt                  |
| mean squared sample-to-sample change | a step edge from a slow arc                 |

The third is the one that earns its place. A speed bump and a pothole can produce the
same peak acceleration; the bump is a smooth arc and the pothole edge is a step, and
the squared difference between consecutive samples separates them. `tests/motion.test.ts`
puts a synthetic bump and a synthetic pothole with identical peak height through the
detector and requires that only one is reported. An FFT would be the textbook answer,
but over a window of roughly thirty samples it would resolve almost nothing, so the
cheap high-pass is not a compromise so much as the honest size of the data.

Two gates reject a window before it is scored at all: below walking pace, picking a
parked phone out of its cradle is indistinguishable from a crater; above about 80 km/h
the vehicle is not on the kind of street this is for. A gated window returns no score
rather than a low one, because "the vehicle was stopped" is not evidence about the road.

### It is a threshold detector, not a model

The thresholds are chosen to sit above ordinary Indian urban road roughness. They are
not fitted, because there is no labelled Indian road data to fit them to, and a model
trained on synthetic bumps would be a model of the generator. The feature extraction is
the part a classifier would consume, so the thresholds can be replaced by a fitted model
without changing anything around them. Calling this a classifier would be the single
easiest thing in the repo to catch.

### One phone is never a defect

A reading is promoted into a defect report only when **independent City IDs** report
within about 20 metres of each other, clustered with `ST_ClusterDBSCAN` in
`promote_anomalies`. Independent identities, not readings: one traveller driving the
same street twice a day is one opinion about it. This is what keeps a badly mounted
phone and an unfamiliar speed table out of the municipal queue, and the schema enforces
it — `defect_reports.confirmations` has a `CHECK (confirmations >= 2)`, so the rule
cannot be skipped by a future second client.

A cluster within 25 m of an existing open defect raises that defect's confirmation count
instead of creating a second row, so one hole reported over a month is one queue entry.

## The departure-slot allocator

This is the part the project exists for. Everything above it — capacity, the fleet, the
demand model — is there so that this has something true to work against.

### Why it is not "the best time to leave"

The obvious design computes each traveller's best departure independently. It does not
work, and the reason is not subtle: if five hundred people are each told the same quiet
moment, that moment stops being quiet. The trough becomes the peak.

`allocate_independently` in `core/allocator.py` implements exactly that mistake, not as
an option but so it can be measured. It costs every traveller against a frozen picture
of today's traffic and never feeds their choices back, which is what any system does
when it answers each user's question on its own.

### What it does instead

A trip is not a point in time. It is a path through (segment, fifteen-minute window)
pairs: departing at _t_ means loading edge _e_ during the window containing _t + offset(e)_.
So this is capacity-constrained assignment over a shared resource, not scheduling.

Background first. Non-participants and anyone with no slack are committed at their
habitual departure before the allocator places anybody, because at the default 70%
non-participation that is most of the road, it is fixed, and a system that assumed
otherwise would be measuring a city it does not live in.

Then each movable trip is costed over the five-minute departures inside its flexibility:

```
cost(trip, t) = deviation_minutes x (1 + w_fair x cumulative_shift / 60 min)
              + w_cong x Σ over (segment, window) on path of Δ(excess²)
```

Three things in that line are deliberate.

**Capacity is a penalty, not a constraint.** Background load alone can already exceed
capacity on some segments. A hard constraint would make the problem infeasible exactly
where it matters most, and the allocator would have nothing to say about the worst
roads in the city.

**The penalty is quadratic in excess.** A linear one is flat above capacity — every
vehicle past the limit costs the same — so once every window a traveller can reach is
full, the congestion term stops discriminating and deviation alone decides. That sends
everyone back to their preferred time and rebuilds the peak. A test caught this: 100
travellers on a segment with room for 20 per window came out as 80 in one window. With
squared excess the same scenario spreads to 21/21/22/21/15.

**Fairness multiplies deviation rather than adding to it.** A traveller carrying an hour
of accumulated shift finds every further minute twice as expensive, so the allocator
stops converging on the same flexible people every morning. Multiplying means a
traveller at zero deviation still pays nothing however often they have been moved
before: a shift history can change who is asked to move, never make it attractive to
move somebody who does not need to.

Trips are placed in descending order of **regret** — best cost minus second-best — so a
traveller with one workable slot chooses before one who is nearly indifferent. Regret is
recomputed when a trip is popped, because committing one trip changes it for others.

### Measured

Bengaluru, 08:00–10:00, 61,866 journeys, 20% adoption. Reproduce with
`scripts/run_allocation.py --city BLR --demand-share 1.0 --adoption 0.20`; the numbers
below are `docs/results/allocation-blr.json` and nothing else in this repo restates them
by hand.

|                             | overloaded segment-windows | vehicles over capacity |
| --------------------------- | -------------------------- | ---------------------- |
| nobody shifts               | 94                         | 5,115                  |
| **coordinated allocation**  | **71**                     | **2,646**              |
| independent per-user advice | 78                         | 4,476                  |

Coordinated allocation removes **48% of the over-capacity vehicles**. Telling each
traveller their own best time removes 12.5%.

The efficiency gap is wider than the headline. Coordination shifted 1,498 travellers by
15.9 minutes on average and the naive design shifted 897 by 14.5. Per person actually
inconvenienced, coordination removes 1.65 vehicles of excess against 0.71 — **2.3 times
more benefit for each traveller asked to change their morning**. Only 9,208 of the
61,866 journeys were movable at all; the other 85% are non-participants and people with
no slack, and the allocator planned around them rather than assuming them away.

### What this measurement is not

It is excess over modelled capacity, not delay. Removing 48% of over-capacity vehicles
is not a claim that anybody's journey got 48% shorter, and the two are not proportional
— congestion responds non-linearly to load, which cuts both ways. Turning this into a
figure in minutes requires simulating the allocated departures against the baseline in
SUMO, which `run_allocation.py` already writes the scenario for.

Offsets along a path come from free-flow traversal times, so the allocator's view of
when a trip reaches the far end of its route is optimistic under congestion. It errs in
a known direction and the alternative is circular: how long a journey takes depends on
the departure times being chosen. Replacing it needs measured per-interval edge speeds
from the baseline run.
