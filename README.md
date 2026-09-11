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
- [docs/04-SUMO-EVALUATION.md](docs/04-SUMO-EVALUATION.md) — how to test the core claim with SUMO
- [docs/06-MUNICIPAL-HANDOFF.md](docs/06-MUNICIPAL-HANDOFF.md) — what crosses to the Municipal Dashboard, and what does not
- [docs/07-SAARTHI.md](docs/07-SAARTHI.md) — how the assistant works
- [docs/09-RESULTS.md](docs/09-RESULTS.md) — **the simulation result, with its limitations**

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
| **5** | Road-issue reporting, phone road-impact detection, Municipal Dashboard hand-off, participation, accessibility and security pass | ✅ Complete |
| **5+** | Saarthi reachable from every page; the assistant now also answers questions about the app itself and links to the right screen | ✅ Complete |

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
| Road sensing *(Phase 5)* | Browser DeviceMotion + Geolocation APIs — no app, no SDK |

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
7. A detected road impact is a **possible** issue until independent reports
   agree — and even then it is "confirmed by reports", never "verified".
8. No figure is shown that the system did not actually observe. There is no
   "time saved", because nobody's real journey was measured.
9. The assistant only describes features that exist. When something is not
   built, it says so rather than sending someone looking for it.

---

## Does it work?

In simulation on an OpenStreetMap network of central Bhopal with 436 modelled
road trips, applying CityFlow AI's recommendations reduced the busiest
15-minute departure window from **52 to 39 vehicles (−25%)**, with departures
falling across the whole 08:00–09:45 peak and rising on the earlier shoulder.
**No new peak formed elsewhere** — which is the difference between smoothing
demand and relocating congestion.

Mean travel time was unchanged, as expected at a vehicle count well below
network capacity.

Full method, the reason only 25% of commuters could be moved, a parameter
sensitivity analysis and every limitation: **[docs/09-RESULTS.md](docs/09-RESULTS.md)**.

---

> An academic capstone project. CityFlow AI is not an official government service.
