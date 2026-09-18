# Phase 5 — what to run and what to check

## Run it

Inside `web`, with the dev server **stopped** (press **Control + C** in the
Terminal window it is running in):

```bash
rm -rf .next
npm run db:push
```

> Adds two tables — `road_issues` and `road_issue_reports` — and four new enum
> types. No new packages, so there is nothing to `npm install`.

```bash
npm run build
npm run dev
```

---

## What Phase 5 added

| Where | What |
|---|---|
| `/roads` | Road conditions for a commuter: what has been reported near them, a report form, and phone-sensor road sensing |
| `/participation` | "My CityFlow participation" — what you have contributed, and honestly-labelled possible future benefits |
| `/admin/roads` | Aggregated road-condition monitoring and the suggested priority order |
| `/api/roads/report` | One citizen report |
| `/api/roads/detections` | A batch of phone-sensor road impacts |
| `/api/admin/roads/handoff` | The Municipal Dashboard hand-off file |
| `/profile` | "How much CityFlow AI can do for you" — what is set up and what each thing changes |
| Dashboard | Road conditions card now shows real reports; road issues appear as map markers |
| Reports | The road-conditions CSV is now a real report |

---

## What to check

### Reporting works

1. Sign in, open **Roads** in the header.
2. The area is pre-filled from your routine. Choose a problem, a severity, and
   press **Send report**.
3. ✅ You should see: *"you are the first person to report this…"*
4. Press **Send report** again without changing anything.
5. ✅ You should now see: *"You have already reported this issue, so the count
   has not changed."*

> That second message is the anti-inflation rule working. One person can never
> be twenty pieces of evidence — the database enforces it with a unique
> constraint on (issue, user).

### Merging and confidence

6. Sign up a **second** account in a private/incognito window, complete
   onboarding with the **same home area**, and report the **same problem type**
   in the **same area**.
7. ✅ You should see: *"your report has been added to existing reports…"*
8. Back on `/roads`, the issue should show **2 independent reports**, still
   labelled **Possible road issue**, with a line saying how many more reports
   would make it *likely*.

> One report is never enough to call something real. Confidence is derived in
> `web/src/lib/roads/confidence.ts` and nowhere else, so it cannot be quietly
> softened in a component.

### The photo

9. Attach a photo from your phone or a large image from your Mac.
10. ✅ It should show *"Resizing your photo…"* and then a preview.

> The image is resized to at most 1000px and re-encoded as JPEG **in your
> browser** before it is sent. That is deliberate: these are stored in a
> Postgres column on a free plan, so an unbounded upload would eventually fill
> the database. Re-encoding also strips the camera's hidden GPS metadata.

### Phone road sensing — **needs a real phone on HTTPS**

This **will not work on `http://localhost`**. Browsers only give motion and
location sensors to secure pages. Test it after deploying, on the Vercel URL,
from your phone.

11. Open the deployed site on your phone → **Roads** → **Start road sensing**.
12. On an iPhone you will get a permission prompt. Allow motion and location.
13. Shake the phone firmly a few times while walking.
14. ✅ **Possible impacts** should tick up and **Strongest jolt** should rise.
15. Press **Finish trip and send**.

> If **Movement** shows *Stationary*, nothing is recorded — that is correct.
> Without it, putting the phone down on a table would register as a pothole, and
> a false road issue in a citizen-facing system is worse than a missed one.

16. Press **Stop and discard** on another run. ✅ Nothing is sent at all.

### The dashboard

17. Open **My dashboard**.
18. ✅ **Road conditions near you** lists your reports with their evidence
    labels, instead of the old empty state.
19. ✅ Any report you attached a location to appears as a marker on the map.
    Area-only reports do **not** — there is no spot to pin, and dropping one at
    the area centre would invent a precision the report does not have.

### Participation

20. Open **My participation** (header menu on mobile, footer on desktop).
21. ✅ Days with a plan, plans confirmed, flexibility offered, total shift.
22. ✅ Your road reports, split into ones you filled in and ones your phone
    detected.
23. ✅ **Possible future benefits** is headed *"None of the following exists.
    Nothing is being earned."*

> There is deliberately **no "time saved"** figure anywhere. CityFlow AI does
> not measure anybody's real journey, so any such number would be invented — and
> inventing an impact figure on a page designed to make somebody feel good about
> participating would be the most dishonest thing this product could do.

### Admin Portal → Road conditions

24. Sign in as your admin account, open **Admin Portal → Road conditions**.
25. ✅ Headline counts, strength-of-evidence split, what is being reported,
    areas with the most reports **together with how many trips pass through
    them**.
26. ✅ A suggested priority order, with the score, the band spelled out in
    words, and the evidence.
27. Press **Download hand-off file** and open the JSON.
28. ✅ Check there is **no user id, CityFlow ID, email or reporter of any kind**
    anywhere in it.
29. ✅ Check the `notice` array is present and explains that nothing has been
    inspected.
30. Reload the page. ✅ Those issues now say **Handed over**.

> That flag means one thing: *this appeared in a file we gave them.* It is not a
> repair status, and it is never shown as one — CityFlow AI is never told
> whether anything was fixed. Full detail in
> [docs/06-MUNICIPAL-HANDOFF.md](06-MUNICIPAL-HANDOFF.md).

### Profile completeness

**My profile** now opens with *"How much CityFlow AI can do for you"*.

✅ Each line says what it **changes about your recommendations**, not just
whether a box is ticked.

✅ Anything you switched off on purpose — notifications, city-demand sharing, or
"my departure cannot move" — is marked **your choice** and is left **out of the
score**.

> A respected preference is not an incomplete profile. Nagging somebody about a
> privacy setting they deliberately chose would be a dark pattern, so the score
> only counts things that are genuinely missing.

✅ Each marker has its own **shape** as well as its own colour — a tick, a dash,
an empty dashed circle — and a screen-reader word.

### Access control

31. Sign out. Go to `/roads` → ✅ redirected to `/login?next=/roads`.
32. Sign out. Go to `/participation` → ✅ redirected to login.
33. As a **non-admin**, go to `/admin/roads` → ✅ you land on `/dashboard`.
34. Signed out, open `/api/admin/roads/handoff` → ✅ `403`.

> Phase 5 also fixed a real hole: `/admin` had a role check written in
> `proxy.ts` that was never actually called. Admin pages were still safe,
> because each one re-checks against the database — but the documented edge
> layer did not exist. It does now.

### Responsive and keyboard

35. Narrow the browser to phone width on `/roads`.
    ✅ The two columns stack, the ☰ menu appears, nothing scrolls sideways.
36. On `/admin/roads`, narrow the window.
    ✅ The priority table scrolls horizontally **inside its own box** — the page
    itself does not.
37. Press **Tab** through `/roads` without touching the mouse.
    ✅ Every control is reachable and the focused one is clearly outlined.
38. Every status in Phase 5 has a **word** next to it — "Possible road issue",
    "Likely", "high" — never colour on its own.

---

## Known limitations, stated plainly

| | |
|---|---|
| **Sensor detection needs the screen on** | Browsers pause motion sensors in a background tab. A native app would not have this limit. This is a real weakness of doing it in a web page, and the UI says so rather than hiding it. |
| **A jolt is not a pothole** | A speed breaker, a kerb and a railway crossing feel identical to an accelerometer. Everything detected is filed as *possible* and counts as half a human report. |
| **Magnitude is not severity** | How hard a bump feels depends on the vehicle's suspension and how the phone is held. The raw value is stored for future tuning, never converted into "dangerous". |
| **Merging is a grid, not map-matching** | Reports are merged into ~50 m cells. A proper implementation would snap each report to an OpenStreetMap road segment, so a report on a flyover is not merged with one on the road beneath it. One file would change: `lib/roads/cell.ts`. |
| **Photos live in a database column** | Workable at this scale because the browser shrinks them first, and capped at ~200 KB. A production deployment would use object storage and keep a URL instead. |
| **The rate limiter is per server instance** | It counts in memory, so on Vercel each instance keeps its own tally. It stops the realistic problems — a stuck retry, a double tap — at zero cost. A real guarantee needs Postgres or Redis. |
| **Exposure counts CityFlow users only** | "312 trips a day through this area" means 312 *registered CityFlow AI* trips. It is not a traffic census, and the hand-off file says so. |

---

## Save and deploy

```bash
cd ..
git add .
git commit -m "Phase 5: road-condition intelligence, participation, municipal hand-off, security and accessibility pass"
git push origin main
```

Vercel redeploys automatically. **After it finishes, run `npm run db:push` once
more** if you have not already — the production database is the same Neon
database, so the two new tables are needed there too (they are: it is one
database, so the push you already did covers it).
