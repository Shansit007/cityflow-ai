# CityFlow AI — Architecture

> Status: **Phases 1, 2 and 3 complete.** Phases 4–5 are planned and the folder structure
> already anticipates them, but their code does not exist yet. Anything marked
> *(planned)* is not implemented.

---

## 1. The three portals

CityFlow AI has three separate parts. They are deliberately **not** merged.

| Portal | Who uses it | Where it lives |
|---|---|---|
| **User / Commuter Portal** | Citizens | This repository, routes `/`, `/dashboard`, `/profile` |
| **Admin Portal** | The CityFlow AI project team today; possibly a government authority in future | This repository, routes under `/admin` *(planned, Phase 4)* |
| **Municipal Dashboard** | Municipal road-maintenance staff | **A separate, already-existing system.** Not built here. |

### What the Municipal Dashboard may and may not do

It is responsible for: receiving reported road problems → prioritising → inspection
→ repair → status update.

It has **no authority** over user schedules, departure recommendations, traffic
optimisation, demand forecasting, the recommendation engine, or the Admin Portal.

---

## 2. Technology choices (all free tiers)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript) | Frontend and backend in one deployable unit |
| Styling | **Tailwind CSS v4** with CSS-variable design tokens | Light/dark theming without duplicating styles |
| Database | **PostgreSQL on Neon** (free tier) | Free plan does not expire and does not pause the project |
| ORM | **Prisma** | Type-safe queries; schema is the single source of truth |
| Auth | Email + password, **bcryptjs** hashing, **jose** JWT in an httpOnly cookie | No paid identity provider needed |
| Hosting | **Vercel** Hobby plan | Free, deploys straight from GitHub |
| Maps *(Phase 2)* | **Leaflet + OpenStreetMap tiles** | No API key, no billing |
| Simulation *(Phase 4)* | **SUMO** + OpenStreetMap road network | Open source, runs offline |

---

## 3. Folder layout

```
cityflow-ai/
├── docs/                     Documentation (setup, architecture, design system)
└── web/                      The Next.js application
    ├── prisma/
    │   └── schema.prisma     Database tables
    └── src/
        ├── app/              Pages and API routes (Next.js App Router)
        │   ├── api/          Backend endpoints
        │   ├── layout.tsx    Shared shell: fonts, theme, city context, header, footer
        │   └── page.tsx      Landing page
        ├── components/
        │   ├── auth/         Sign-up / log-in forms, CityFlow ID card
        │   ├── brand/        Logo
        │   ├── city/         City context, selector, skyline artwork, backdrop
        │   ├── chat/         The assistant panel and its confirmation card
        │   ├── dashboard/    Recommendation card, peak strip, status cards, history
        │   ├── landing/      Landing-page sections
        │   ├── layout/       Header and footer
        │   ├── map/          Leaflet map + search, loaded browser-side only
        │   ├── onboarding/   The four-step travel-routine wizard
        │   ├── profile/      Profile editor (reuses the onboarding steps)
        │   ├── theme/        Light/dark theme provider and toggle
        │   └── ui/           Reusable primitives (Button, Card, Badge, TextField…)
        ├── lib/
        │   ├── auth/         Password hashing, JWT, session, CityFlow ID generation
        │   ├── chat/         Time parsing, intent recognition, assistant replies
        │   ├── demand/       Time slots, baseline model, aggregation, engine, optimiser, zones
        │   ├── app-time.ts   "Today" and "now" in the application timezone (IST)
        │   ├── cities.ts     Supported cities (single source of truth)
        │   ├── db.ts         Prisma client
        │   ├── env.ts        Environment variable access
        │   ├── intent-service.ts          Stores a confirmed plan, then re-optimises
        │   ├── recommendation-service.ts  Ties the engine to the database
        │   ├── travel.ts     Transport modes and destination types
        │   └── validation.ts Zod schemas shared by client and server
        └── proxy.ts          Route protection (runs before pages render;
                               called middleware.ts before Next.js 16)
```

**Rule followed throughout:** UI components never talk to the database. They call
an API route, which uses `lib/` helpers, which use Prisma.

---

## 4. Request flow

### Signing up

```
Browser (signup form)
  → validate with Zod on the client
  → POST /api/auth/signup
      → validate with the SAME Zod schema on the server
      → reject duplicate email
      → hash password (bcrypt, 10 rounds)
      → generate a unique anonymous CityFlow ID  (CF-XXXXXXX)
      → insert row in "users"
      → sign a JWT and set an httpOnly cookie
  → redirect to /welcome  (shows the CityFlow ID + privacy explanation)
```

### Opening a protected page

```
Browser → /dashboard
  → proxy.ts verifies the cookie signature (no database call)
      → invalid?  redirect to /login?next=/dashboard
      → valid?    continue
  → page loads the full user record with Prisma (Node runtime)
```

**Why the split:** every request passes through the proxy, so it must stay fast.
It only verifies the cookie signature; the database is read later, in the page.

---

## 4b. How a recommendation is produced

```
profile (usual departure, required arrival, journey time, flexibility)
        +
demand model  →  predicted demand index 0-100 per 15-minute slot
        ↓
only slots the person AGREED to (earlier / later / neither)
        ↓
discard any slot whose estimated arrival misses the required arrival
        ↓
pick the lowest-demand slot; tie-break towards the usual time
        ↓
is it at least 8 index points better?  no → recommend keeping the usual time
        ↓
store it (with its reason) + explain it on screen
```

**The demand model is a modelled baseline, not measured traffic.** It reproduces
the shape urban demand reliably takes — an overnight floor, a sharp morning
peak, a midday bump, a broader evening peak, a flatter weekend — scaled per
city and varied per day by a deterministic wobble. `predictDemandIndex()` in
`lib/demand/demand-model.ts` is the single seam where real aggregated demand
replaces it in Phase 3; no screen has to change.

---

## 4c. Demand smoothing — how the peak is not simply moved

This is the mechanism the whole project exists for.

```
person confirms a plan in the assistant
        ↓
POST /api/intent/confirm          ← the ONLY endpoint that writes travel data
        ↓
travel_intentions row (structured; the chat text is never stored)
        ↓
demand_slot_aggregates: one trip moves from its old slot to its new slot
        ↓
adjusted(slot) = baseline(slot)
               + confirmed trips in slot × TRIP_WEIGHT
               + any active network event
        ↓
reoptimiseCity(): recompute EVERY pending recommendation, in a stable order,
                  adding each person's new slot to the curve BEFORE the next
                  person is considered
        ↓
anyone whose time moved gets updatedByOptimiser + updateReason
        ↓
dashboard shows "Your recommendation has been updated", and why
```

**Why this cannot stack everyone on one slot.** The demand value the engine
reads already contains everybody else's confirmed departures. The moment people
start moving to 8:45, 8:45's index rises — for the next person to ask, and for
the re-optimisation pass. The sequential pass in `optimizer.ts` is what turns
"everyone is told 8:45" into 8:30 / 8:45 / 9:00.

**What the optimiser will not do.** It never moves someone who has already
committed; it never rewrites a stored travel intention; it never breaks a
person's required arrival or their stated flexibility direction. It changes what
is *recommended*, tells them it changed, and leaves the decision with them.

**Determinism.** Users are processed ordered by id, so the same data always
produces the same result. That is what makes the outcome explainable rather
than a lottery.

**Where it runs.** Inline after each confirmation — a few dozen rows at this
scale. In a real deployment this belongs on a queue.

---

## 5. Privacy model

- `users.email` exists for authentication, recovery and service messages **only**.
- `users.cityflowId` (e.g. `CF-8X42K91`) is what every other part of the system uses.
- The Admin Portal *(Phase 4)* will read **aggregated** figures only —
  "8,200 trips expected between 6:00–6:15 PM", never "CF-8X42K91 is travelling at 6 PM".
- The session cookie is `httpOnly`, `sameSite=lax`, and `secure` in production.

---

## 6. What each later phase adds

| Phase | Adds |
|---|---|
| **2** | Travel-routine onboarding, real commuter dashboard, Leaflet map, profile editing. New tables: `TravelProfile`, `Recommendation` |
| **3** | ✅ Built: assistant, intent recognition, confirmation flow, `TravelIntention`, `DemandSlotAggregate`, `NetworkEvent`, city-wide re-optimisation |
| **4** | Admin Portal (separate auth + `/admin` routes), demand heatmap, reports, system health, SUMO + OpenStreetMap simulation structure, baseline vs CityFlow AI comparison |
| **5** | Smartphone road-impact detection, citizen road-issue reporting, hand-off to the existing Municipal Dashboard, participation/rewards, final accessibility and security pass |

---

## 7. Design principles that constrain the code

1. Do not move congestion — smooth demand. A shift is only accepted after the
   **new** time slot has been checked for overload.
2. Recommendations are suggestions, never instructions.
3. Predictions are presented as estimates, never certainties.
4. Every recommendation carries a plain-language reason.
5. Mock data is allowed only where real data does not exist yet, and must sit
   behind the same data layer the real source will use — so swapping it in
   later changes one file, not the UI.
