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

| Vehicle | Indo-HCM | Simulated | |
|---|---|---|---|
| two-wheeler | 0.35 | 0.539 | |
| car | 1.00 | 1.000 | by definition |
| auto-rickshaw | 0.80 | 0.822 | |
| LCV | 1.40 | 1.225 | |
| bus | 3.00 | 1.652 | |
| **fleet mean** | **0.635** | **0.722** | 14% apart |

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
  it at 20%. Redrawing per level would let a difference between levels be *who*
  participates rather than *how many*, and the adoption sweep would measure nothing in
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
a *destination* is its street length weighted by how much employment reaches it:

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
