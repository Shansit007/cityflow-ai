# Phase 4 — Admin Portal: what to run and what to check

## Run it

Inside `web`, with the dev server stopped (**Control + C**):

```bash
npm run db:push
```
> Adds one table: `simulation_runs`. No new packages.

```bash
npm run build
```

---

## Make yourself an admin

The Admin Portal is role-protected. There is deliberately **no** "make me an
admin" option on the sign-up form — anyone could tick it. Rights are granted
from the machine that owns the database.

**1.** Sign up normally on the website first (or use your existing account).

**2.** In the Terminal, inside `web`:

```bash
npm run admin:create -- your-email@example.com
```

Use the exact email you signed up with.

✅ You should see: `✔ "your-email@example.com" (CF-XXXXXXX) is now an admin.`

**3. ⚠️ Sign out and sign in again.**

This matters. Your login cookie still says `USER` until you get a fresh one, so
`/admin` will bounce you back to the dashboard until you re-authenticate.

**4.** Start the app and open **http://localhost:3000/admin**

You should also now see **Admin Portal** in the header.

---

## What to check

### The portal is visibly separate

- [ ] The header changes completely — it says **Admin Portal**, and the city
      selector, Saarthi link and assistant button are all gone
- [ ] The footer is the short operational one, not the marketing footer
- [ ] It is called **Admin Portal** everywhere — never "Government Admin Portal",
      never "Municipal Admin Portal"

### Access control

- [ ] Open a **private/incognito window**, sign in as a normal (non-admin)
      account, and go to `/admin` → you land on `/dashboard`, with no error page
- [ ] Sign out entirely and go to `/admin` → you land on `/login`
- [ ] Try `/api/admin/export?report=participation` while signed out → `403`

> Two layers do this: `proxy.ts` checks the role in the signed cookie at the
> edge, and every admin page re-checks against the database. The second is not
> redundant — a cookie is a snapshot, and rights can be revoked after it was
> issued.

### Overview page

- [ ] Demand right now, slots over capacity, confirmed plans, adjusted
      recommendations
- [ ] The day curve renders 76 slots; over-capacity bars are a different colour
      **and** are counted in the sentence underneath
- [ ] Peak periods list the three busiest slots
- [ ] Mode split, recommendation outcomes, data freshness, system status
- [ ] Switch city with the buttons top-right — the URL changes to `?city=…`, so
      the view can be bookmarked or shared

### Demand page

- [ ] The zone × time-slot grid renders, with **numbers inside the cells**
- [ ] Switch between Morning / Midday / Evening / Full day
- [ ] Press **Show the table view** — the same grid as text
- [ ] The note underneath says how many trips are confirmed vs assumed

### Reports

- [ ] Six reports listed; five available, road-conditions marked **No data yet**
- [ ] Download any CSV and open it — check there is **no user id, CityFlow ID,
      email or home area** in it
- [ ] The road-conditions CSV explains why it is empty rather than being blank

### Simulation

- [ ] Download `baseline.trips.xml` and `cityflow.trips.xml` — open both in a
      text editor
- [ ] The header comment explains the scenario; trips have `depart`, `fromTaz`,
      `toTaz`
- [ ] Confirm the two files contain the **same number of trips** with the
      **same origin/destination pairs** — only `depart` differs
- [ ] Download the zone template — every zone has `edges=""` with an explanation
- [ ] Record a fake run for each scenario in the form, then check the comparison
      table appears (delete them from the database afterwards if you want)

---

## Colour decision worth knowing about

The heatmap does **not** use the green/amber/red traffic palette. It uses a
**single-hue ramp stepped by lightness**.

I checked the status palette with a contrast validator before building the grid:

```
CVD separation   #b91c1c ↔ #b45309   ΔE 4.9 (deutan)   FAIL
Normal vision    #b91c1c ↔ #b45309   ΔE 9.1            FAIL (floor is 15)
```

"High" and "Very high" sit closer together than most people can distinguish —
and for someone with deuteranopia they are effectively the same colour. A single
hue stepped by lightness survives every form of colour blindness, because
lightness is what all of them preserve.

Both ramps (light and dark mode) were checked for monotonic luminance, and each
step has an ink colour that clears 4.5:1 against it. Cells also print their
number, and there is a full table view. Colour is the *fastest* way to read the
grid; it is never the only way.

Green/amber/red is still used where it belongs — badges and traffic status,
where every value has a text label beside it.

---

## The privacy boundary is in the code

Everything in `lib/admin/analytics.ts` returns counts and averages. There is no
query in that file that selects a user id, a CityFlow ID, an email or a home
area — so the portal *cannot* show an individual, rather than merely choosing
not to.

People who switched off **"count my trip in city-level demand totals"** during
onboarding are excluded from every figure and every export. That promise was
made in Phase 2 and `shareAggregatedDemand: true` appears in each query for
exactly that reason.

---

## Save and deploy

```bash
cd ..
git add .
git commit -m "Phase 4: Admin Portal, demand heatmap, reports and SUMO evaluation structure"
git push origin main
```

**After deploying**, promote your account on the production database too — it is
the same Neon database, so the `npm run admin:create` you already ran covers it.
