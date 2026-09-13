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

`road_segments.capacity_vph` is a column with a `CHECK` and no population logic; the
formula that fills it is Phase 2 and will be cited in `docs/engine.md`. Nothing writes
`departure_slots` or `recommendations` yet either — the allocator is Phase 2.
