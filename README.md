# CityFlow AI

### Smarter Departures, Smoother Journeys

CityFlow AI is a **proactive** traffic-management system.

Existing systems ask *“which road should this vehicle take?”*
CityFlow AI asks *“how do we prevent too many vehicles from entering the road
network at the same time?”*

Instead of rerouting people once congestion already exists, CityFlow AI predicts
travel demand ahead of time, learns how flexible each commuter is, and
distributes trips across nearby departure slots so the peak becomes less sharp
for everyone.

---

## 👉 New here? Start with the setup guide

**[docs/00-SETUP-STEP-BY-STEP.md](docs/00-SETUP-STEP-BY-STEP.md)** — click-by-click
instructions to run the project on your Mac and deploy it online for free.

Other documentation:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the system is put together
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) — colours, theming, accessibility rules

---

## The three portals

CityFlow AI has three separate parts, and they are intentionally kept apart:

1. **User / Commuter Portal** — citizens get departure recommendations they can
   understand and change. *(Built here.)*
2. **Admin Portal** — city-level demand monitoring, forecasting, optimisation
   results and reports, using aggregated data only. Currently owned by the
   CityFlow AI project team. *(Built here, Phase 4.)*
3. **Municipal Dashboard** — road-condition and pothole management: prioritise →
   inspect → repair → update status. **This is a separate, already-existing
   system and is not rebuilt in this repository.**

---

## Current status

| Phase | Scope | Status |
|---|---|---|
| **1** | Foundation, design system, landing page, city selection, light/dark theme, authentication, anonymous CityFlow ID | ✅ Complete |
| **2** | Travel-routine onboarding, demand model + recommendation engine, commuter dashboard, Leaflet map, profile editing | ✅ Complete |
| **3** | AI assistant, travel-intent recognition, confirmed-plan storage, demand aggregation, city-wide re-optimisation | ✅ Complete |
| **4** | Admin Portal, demand heatmap, reports, system status, SUMO + OpenStreetMap evaluation structure | ✅ Complete |
| 5 | Road-impact detection, participation, final polish and security review | ⏳ Not started |

---

## Tech stack — all free tiers

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 with CSS-variable design tokens |
| Database | PostgreSQL on Neon (free plan) |
| ORM | Prisma |
| Auth | bcrypt password hashing + JWT session in an httpOnly cookie |
| Hosting | Vercel (Hobby plan) |
| Maps *(Phase 2)* | Leaflet + OpenStreetMap |
| Simulation *(Phase 4)* | SUMO + OpenStreetMap road network |

---

## Quick start

```bash
cd web
npm install
cp .env.example .env     # then fill in DATABASE_URL and AUTH_SECRET
npm run db:push
npm run dev
```

Open <http://localhost:3000>.

Full instructions, including how to get a free database and how to deploy:
**[docs/00-SETUP-STEP-BY-STEP.md](docs/00-SETUP-STEP-BY-STEP.md)**.

---

## Principles this project holds to

1. Do not move congestion from one time to another — **smooth demand**.
2. Recommendations are **suggestions**, never instructions.
3. Predictions are **estimates**, never presented as certainties.
4. Every recommendation explains **why**.
5. Individual identity stays out of city-level analysis — an anonymous
   **CityFlow ID** carries travel behaviour instead.
6. The Municipal Dashboard is separate and does **not** control traffic
   recommendations.

---

> An academic capstone project. CityFlow AI is not an official government service.
