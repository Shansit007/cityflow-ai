# CityFlow AI — Architecture

> Status: **Phase 1 complete.** Phases 2–5 are planned and the folder structure
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
| Framework | **Next.js 15** (App Router, TypeScript) | Frontend and backend in one deployable unit |
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
        │   ├── landing/      Landing-page sections
        │   ├── layout/       Header and footer
        │   ├── theme/        Light/dark theme provider and toggle
        │   └── ui/           Reusable primitives (Button, Card, Badge, TextField…)
        ├── lib/
        │   ├── auth/         Password hashing, JWT, session, CityFlow ID generation
        │   ├── cities.ts     Supported cities (single source of truth)
        │   ├── db.ts         Prisma client
        │   ├── env.ts        Environment variable access
        │   └── validation.ts Zod schemas shared by client and server
        └── middleware.ts     Route protection (runs before pages render)
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
  → middleware.ts verifies the cookie signature (Edge runtime, no database)
      → invalid?  redirect to /login?next=/dashboard
      → valid?    continue
  → page loads the full user record with Prisma (Node runtime)
```

**Why the split:** Prisma and bcrypt cannot run on the Edge runtime, so middleware
only checks the signature. Database work happens in pages and API routes.

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
| **3** | AI assistant, intent recognition, confirmation flow, `TravelIntention` table, demand aggregation, re-optimisation loop |
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
