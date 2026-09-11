# Demo data — filling the city for a presentation

With two real accounts the Admin Portal is honest but empty. One row in the
heatmap, two bars in the mode split, a demand curve that is pure baseline.
None of it shows what the system does.

```bash
cd web
npm run demo:seed -- --city bhopal --users 120
```

Takes a minute or two on the free database tier. Remove it all with:

```bash
npm run demo:clear
```

---

## What it creates

| | |
|---|---|
| 120 registered commuters | real area names, believable departure spread, weighted mode split |
| A travel routine each | home area, destination, journey time, flexibility, privacy choices |
| A **pending** recommendation each | at their own usual time — see below |
| ~35% with a confirmed plan for today | which is what puts trips into aggregated demand |

Options: `--city <code>` · `--users <n>` · `--confirm <percent>`

---

## The one line that matters

Each demo commuter gets a recommendation **at their own usual time**, marked
`PENDING`, with a reason that says plainly it is a placeholder.

That is not a result. It is the **input** the optimiser needs.

The moment anybody confirms a plan, `reoptimiseCity()` recalculates every one of
them with the real engine. What you then watch spreading across the morning is
the actual mechanism working — not a script drawing a picture of it.

**This is the demo worth showing:**

1. Seed the city
2. Open **Admin Portal → Overview**, note the day curve and *Adjusted by optimiser: 0*
3. Sign in as yourself and confirm a plan in the assistant
4. Reload the Admin Portal

Recommendations have moved. The peak is flatter. Nothing about that was
pre-computed.

---

## What it will not do

- **No fabricated results.** No recommendation the engine did not produce, no
  road issues, no simulation metrics, no repairs.
- **Nobody can sign in as a demo account.** The password is a hash of a random
  value that was never recorded.
- **They cannot be mistaken for real users.** Every address ends in
  `@demo.cityflow.invalid` — `.invalid` is reserved by RFC 2606 and can never
  be a real domain.

---

## Deterministic

The random source is seeded from the city name, so the same city always
produces the same 120 people. You can re-seed between rehearsals and get an
identical city — and a SUMO comparison built on this data can be **reproduced**,
not merely described.

---

## What `demo:clear` does

Deletes accounts matching the demo domain and nothing else. Profiles,
recommendations, intentions and chat messages cascade with them.

`demand_slot_aggregates` is the exception, **by design**: it holds counts with
no user column, so nothing can cascade to it — that is the same property that
makes it impossible to work backwards from a row to a person. The script
rebuilds it from the confirmed plans that remain.

Your own account is never touched.

---

## Be straight about it

If you show this in a viva, say it is demo data. The mechanism is real, the
engine output is real, the spreading is real — the **people** are generated, and
claiming otherwise would undermine every honest thing in the rest of the
project.

A good sentence for a slide:

> "120 synthetic commuters with realistic routines. Every recommendation shown
> was produced by the live engine; only the travellers are generated."
