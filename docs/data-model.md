# Data model

The schema lives in `infra/migrations/`, applied in filename order. Postgres with
PostGIS; every table is created in `0001_init.sql`.

## Tables

| Table             | Holds                                                      | Keyed by                     |
| ----------------- | ---------------------------------------------------------- | ---------------------------- |
| `cities`          | Deployment cities, their centroid and timezone             | `code` (`BLR`, `PNQ`)        |
| `city_identities` | The anonymous account                                      | `public_id`                  |
| `road_segments`   | OSM ways with lane count, length and derived capacity      | `(city, osm_way_id)`         |
| `routines`        | A recurring journey a traveller saved                      | `identity_id`                |
| `trips`           | One concrete journey, from a routine or ad-hoc             | `(city, travel_date)`        |
| `departure_slots` | Per segment, per 15 minutes: capacity and what is using it | `(segment_id, window_start)` |
| `recommendations` | The slot a trip was given, and the counterfactual          | `trip_id`                    |
| `defect_reports`  | A confirmed road defect awaiting repair                    | `(city, status, severity)`   |
| `municipal_users` | Named council staff                                        | `(city, email)`              |
| `points_ledger`   | Append-only reward points                                  | `identity_id`                |

## Relationships that carry a decision

**`trips.routine_id` is nullable and nulled on delete, not cascaded.** A trip belongs to
a routine only if it came from one; ad-hoc trips have none. Deleting a routine must not
erase the trips already taken under it, because those are what the allocator's fairness
accounting and the evaluation both read.

**`recommendations` stores both departures.** `depart_at` is what the traveller was
told; `naive_depart_at` is when they would have left without the system. Keeping the
counterfactual on the row is what makes the comparison shown in the app the same number
the evaluation measures, rather than two things that drift apart.

**`recommendations.accepted` and `.followed` are separate, and both nullable.**
Accepting a suggestion and actually leaving at that time are different events with
different failure modes, and `null` means "not answered yet" rather than "no".

**`departure_slots` splits `allocated` from `background_load`.** The allocator controls
only the participants. Non-participants are fixed load it has to plan around, so the two
are separate columns rather than one total — see `docs/engine.md`.

**`points_ledger` is append-only with no balance column.** A balance is the sum of the
rows. A stored balance that disagrees with its entries cannot be explained to the person
holding it.

## Changes from the original table list

**Added `cities`.** Every other table is scoped by city. Repeating a text city name
across nine tables invites `Bengaluru` and `bangalore` to coexist, and the system is
meant to run in more than one city. A three-letter code with a foreign key makes that
impossible and gives the centroid and timezone a home.

**Recovery code rather than recovery phrase.** A word phrase is easier to transcribe,
but only with a wordlist shipped in the client, and eight words of a 256-word list is
64 bits. The code is 24 characters from a 27-symbol alphabet, about 114 bits, with the
ambiguous glyphs removed so it survives being written on paper. `normaliseRecoveryCode`
accepts it back lowercase, spaced, or with the dashes missing.

**`arrive_window_minutes` on both `routines` and `trips`.** The allocator needs to know
how much slack a person has, and slack is the binding constraint on how much good the
system can do. A single arrival time with no tolerance would make almost every trip
immovable.

## What is not here yet

`road_segments.capacity_vph` is populated by `scripts/load_network.py` from the formula
in `docs/engine.md`. `departure_slots` and `recommendations` are still unwritten: the
allocator exists and is tested, but it runs over a simulated population held in memory
rather than over trips in this database, and wiring it to real routines is what the
Today screen is waiting on.

## Tables added since

**`municipal_settings`** (0005) holds one row per city: the severity at or above which
a defect is flagged priority in the queue. It is a property of the city's current
capacity to fix things, not of any defect, which is why it is not a column on
`defect_reports` and why changing it re-labels the queue rather than re-scoring it.

**`road_anomalies`** (0007) is the raw output of one traveller's phone: an exact point,
a City ID, a magnitude and the features the detector computed. It is the only place in
the traveller schema where an identity sits next to a precise location, it exists only
until the reading has been aggregated into a `defect_report`, and
`infra/prune_anomalies.sql` is what removes it. Deleting a City ID cascades here, making
this the one table a traveller has anything to erase.

`promote_anomalies()` is a function rather than application code because the rule it
enforces — several independent identities before anything becomes a defect — is the same
rule `defect_reports.confirmations` has a CHECK for. Both live in the database so that a
second client, a script or a future migration cannot route around it.

**`defect_reports.resolution_note` and `resolved_by`** (0006) were added because
"resolved" on its own does not say whether the hole was filled, the road was resurfaced,
or the crew found nothing there. The accompanying constraint is `NOT VALID`: defects
resolved before that migration have no note, and there is no honest way to give them
one.
