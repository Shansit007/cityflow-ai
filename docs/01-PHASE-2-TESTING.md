# Phase 2 — what to run and what to check

## Run it

In VS Code's Terminal, inside the `web` folder:

```bash
npm install
```
> Phase 2 adds three packages: `leaflet`, `react-leaflet`, `@types/leaflet`.

```bash
npm run db:push
```
> Adds two new tables — `travel_profiles` and `recommendations`. Your existing
> account is untouched.

```bash
npm run build
```
> Catches type errors before they reach Vercel.

```bash
npm run dev
```

---

## Test checklist

### Onboarding (new account)

1. Sign out, then sign up with a **new** email.
2. On the welcome screen press **Set up my travel routine**.
3. **Step 1** — leave "Home area" blank and press Continue. It should refuse and
   highlight the field.
4. Fill in both areas, pick a destination type and a transport mode → Continue.
5. **Step 2** — set departure `09:00`, required arrival `09:30`, journey `45` min.
   It should refuse: 45 minutes does not fit between 9:00 and 9:30.
6. Change the journey to `20` minutes. The grey preview line should say you would
   arrive around 9:20 AM → Continue.
7. **Step 3** — turn OFF both "leave earlier" and "leave later". It should refuse
   while your departure is marked flexible.
8. Turn "leave earlier" back on → Continue.
9. **Step 4** — read the privacy section, then press **Complete Setup**.
10. You land on the dashboard with a green "Your CityFlow profile is ready" notice.

### Dashboard

- [ ] The recommendation card is the first thing you see, showing a recommended
      time, your usual time, and a reason for both.
- [ ] Press **Why am I seeing this?** — it lists both demand figures, the
      estimated journey and arrival, and your required arrival.
- [ ] Press **Use …** or **Keep …** — a badge appears showing your decision.
- [ ] Press **Change my plan**, enter a different time, save — the badge updates
      to your own time.
- [ ] The **Upcoming demand** chart highlights your usual and recommended slots.
- [ ] The map loads, is centred on your city, and shows a dashed demand circle.
- [ ] Type at least 3 letters in the map search (e.g. a locality you know) and
      pick a result — the map flies there and drops a teal marker.
- [ ] Switch the theme to dark — the map tiles darken with the rest of the page.
- [ ] Switch city in the header — the map recentres and the search box clears.
- [ ] Reload the page. The recommendation and your decision are unchanged.

### Profile

- [ ] Open **My profile** (header menu, or "Edit my routine" on the dashboard).
- [ ] Everything you entered during onboarding is pre-filled.
- [ ] Change your usual departure by an hour → the sticky bar says
      "You have unsaved changes" → press **Save routine**.
- [ ] Go back to the dashboard: the recommendation has been recalculated around
      the new time.
- [ ] Press **Undo changes** after editing something — it reverts.

### Responsive

- [ ] At phone width the dashboard stacks into one column and the map is
      full-width.
- [ ] The onboarding stepper collapses to "Step 2 of 4 · Your schedule".

---

## Things that are deliberately NOT real yet

Say this plainly in your capstone report — it is a strength, not a gap:

| Shown as | Actually is |
|---|---|
| Predicted demand index | A **modelled baseline**, not measured traffic counts |
| Estimated journey time | Your own stated journey time × a congestion factor |
| Road conditions card | An honest empty state — detection arrives in Phase 5 |
| Notifications | Preference recorded; sending is not built |
| Carpool / public transport interest | Recorded; matching is not built |

Nothing on any screen claims a measured time saving, because CityFlow AI cannot
observe your actual journey.

---

## Save and deploy

```bash
cd ..
git add .
git commit -m "Phase 2: onboarding, demand engine, commuter dashboard, map and profile editing"
git push origin main
```

Vercel redeploys automatically. **No new environment variables are needed** —
Phase 2 adds no secrets.
