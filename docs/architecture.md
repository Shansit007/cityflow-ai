# Architecture

One repository, three deployable units, one database.

```mermaid
flowchart LR
    T["apps/traveller<br/>Next.js, Vercel"]
    M["apps/municipal<br/>Next.js, Vercel"]
    E["services/engine<br/>FastAPI, Render"]
    D[("Postgres + PostGIS")]
    O["OSRM<br/>local dev only"]

    T -->|"session cookie, own routes"| D
    M -->|"defect queue, staff"| D
    T -->|"@cityflow/api-client"| E
    M -->|"@cityflow/api-client"| E
    E --> D
    E -.-> O
```

## Why it is split this way

**Two Next apps, not one app with two sections.** They are separate Vercel projects
with separate root directories, so the municipal dashboard has no route, no bundle and
no environment variable in common with the public site. A path-based split would leave
the two one middleware bug apart; this way a traveller request cannot reach municipal
code because the code is not deployed on that domain.

**A Python service, not a Next API route.** The capacity model, the slot allocator and
the travel-time model are numerical work that belongs in Python, and none of it fits
Vercel's serverless runtime. Keeping it separate also means the evaluation scripts and
the web application call exactly the same code.

**The apps talk to Postgres directly for their own data.** Reading a traveller's own
routines through an HTTP hop to Python would add latency and a second place for
authorisation to be wrong. The engine owns allocation; the apps own their own rows.

## Request flow: a departure recommendation

1. The browser resolves the typed address to a six-character geohash cell. The
   coordinate does not leave the device.
2. `POST /api/trips` on the traveller app writes a `trips` row — cells, arrival
   window, mode — scoped to the identity in the signed session cookie.
3. The engine's allocator runs over the batch of trips for the horizon, not one trip
   at a time, and writes `departure_slots` and one `recommendations` row per trip.
4. The app reads the recommendation back and shows it beside the counterfactual: the
   time the traveller would have left, and where that would have got them.

Steps 3 and 4 are Phase 2 work. Steps 1 and 2 are what Phase 1 built the schema for.

## Packages

- `packages/ui` — the layout shell both apps render inside. Consumed as TypeScript
  source and transpiled by each app, so there is no build step to keep in sync.
- `packages/api-client` — the typed client for the engine. It fails closed: a timeout
  or a non-200 becomes `EngineUnavailableError`, and both apps degrade to showing the
  engine as unreachable rather than failing the render.

## What runs where

|                    | Local                                           | Deployed                                       |
| ------------------ | ----------------------------------------------- | ---------------------------------------------- |
| `apps/traveller`   | `pnpm dev`, port 3000                           | Vercel, root directory `apps/traveller`        |
| `apps/municipal`   | `pnpm dev`, port 3001                           | Vercel, root directory `apps/municipal`        |
| `services/engine`  | `uvicorn app.main:app`                          | Render free tier                               |
| Postgres + PostGIS | `docker compose -f infra/docker-compose.yml up` | Supabase or Neon                               |
| OSRM               | docker compose, `routing` profile               | not deployed; travel times come from the model |

The engine's free tier sleeps when idle, so `@cityflow/api-client` allows eight seconds
for a cold start before giving up.
