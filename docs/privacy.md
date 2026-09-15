# Privacy

## What the traveller side stores

An account is a row in `city_identities` holding three things: a public ID such as
`BLR-7X3K-9QMN`, a salted scrypt hash of a recovery code, and a home city. There is no
name, email, phone number or device identifier, and no column to put one in.

The ID and the recovery code are both generated in the browser. The recovery code
reaches the server once, over TLS, and is hashed before it is written; it is never
stored in plain text and never logged. It is shown to the traveller once. An account
whose owner loses it cannot be recovered by anyone, including whoever runs the server.

## What is deliberately imprecise

Every origin and destination — in `routines` and in `trips` — is stored as a
six-character geohash, not a coordinate. At Indian latitudes that cell is roughly
1.2 km east to west and 0.6 km north to south.

The address a traveller types is resolved to a cell in their browser. The coordinate
itself is never transmitted, so it is not in the database, not in a backup, and not in
an HTTP log.

This is enforced by the `geohash_cell` domain in `infra/migrations/0001_init.sql`
rather than by convention, so a later migration cannot quietly add a precise column
without replacing the type and explaining why.

`defect_reports.location` is the one exact point in the schema. It describes a hole in
a public road, it is only written once several independent identities have registered
an anomaly at the same place, and it is not attributable to any one of them.

## What this protects against

- **The server operator learning who a traveller is.** The database holds travel
  patterns with no identity attached to them.
- **A breach linking travel history to a person.** There is nothing in a dump to join
  against an email list, a phone number or a social profile.
- **Knowing where someone lives.** A cell of roughly 1.2 by 0.6 km at the origin end of
  a routine contains, in urban Bengaluru, several thousand households.

## What this does not protect against

Stated plainly, because a privacy claim that only lists its wins is not a threat model.

- **Traffic analysis.** A routine that leaves cell A at 08:30 every weekday and arrives
  in cell B is a signature. Someone who independently knows a person's commute can
  recognise it. Coarsening the cells does not remove this; only not storing routines
  would, and the system cannot allocate departure slots without them.
- **Anyone holding the device.** The session is a long-lived cookie, and the browser
  holds the resolved addresses so the map can show them. A person with an unlocked
  phone has the account.
- **Correlation with anything else.** Cells are coarse, but a traveller who reports a
  road defect at an exact point near their origin has narrowed their own cell.
- **The network path.** IP addresses reach the hosting provider's logs like they do for
  any web application. The application does not store them; the platform may.
- **Rate-limited guessing.** There is no rate limit on the recovery endpoint yet. The
  code is about 114 bits and scrypt makes each attempt expensive, so guessing is not
  the practical risk — denial of service through repeated hashing is, and it is not
  addressed.

## What is not claimed

**This is not end-to-end encrypted, and the documentation will not say it is.** The
server has to read origin cells, destination cells and arrival windows in order to
allocate departure slots across a road network; an allocator cannot solve over
ciphertext. Data is encrypted in transit and at rest by the hosting provider. That is
the accurate claim, and it is weaker than end-to-end encryption.

## Why municipal staff are treated differently

`municipal_users` has an email address, a password and a real name. That is the
opposite of the traveller side, on purpose.

A citizen travelling to work has no accountability relationship with the city, so the
system should not be able to identify them. A council employee assigning and closing
road repairs is acting in an official capacity, and someone has to be answerable for
a defect marked resolved that was never fixed. Anonymity there would be a defect in
the design, not a feature.

The two datasets do not join. There is no foreign key between `municipal_users` and
`city_identities`, and nothing in the municipal application reads traveller data.

## The one place exact location is stored

Everything a traveller saves about their own journeys is a six-character geohash cell,
coarsened in the browser. Defect reporting is the exception and it is a real one.

`road_anomalies` holds an exact coordinate next to a City ID. Together those say where
somebody was at a moment, which is precisely what the rest of this schema is built to
avoid. It is stored because a pothole has to be findable by a repair crew, and because
placing a reading in a 1.2 km cell would make it useless for that.

Three things limit the exposure, and none of them is encryption:

- **It is opt-in and visible.** Nothing is recorded until the traveller starts a
  recording, and the page says on it that exact position is sent for this feature.
- **It is short-lived.** `infra/prune_anomalies.sql` deletes readings once they have
  been aggregated into a defect, and deletes unaggregated ones after a fortnight. A
  reading that never found a second witness is evidence of one person's journey and
  nothing else.
- **What survives is not attributable.** A `defect_report` carries a location and a
  count of how many identities confirmed it, and no identity column. The link from a
  defect back to the people who reported it is severed when the readings are pruned.

What this does not protect against is unchanged from the rest of this document: a server
operator who reads the table before it is pruned sees exact positions for a City ID, and
a traveller who records their whole commute every day is producing a trace that would
identify them to anyone holding it. The honest summary is that defect reporting is the
least private thing CityFlow does, it is separable from the rest of the product, and
somebody who does not want to do it should not turn it on.
