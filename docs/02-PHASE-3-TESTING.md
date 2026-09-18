# Phase 3 — what to run and what to check

## Run it

Inside `web`, with the dev server stopped (**Control + C**):

```bash
npm run db:push
```
> Adds four tables: `travel_intentions`, `demand_slot_aggregates`,
> `network_events` and `chat_messages`.
> No new packages, so **no `npm install` needed**.

```bash
npm run build
```
```bash
npm run dev
```

---

## The assistant — Saarthi

The assistant has its own page. Reach it from **Saarthi** in the header, from the
**Ask Saarthi** button floating at the bottom right of any page, or by opening
**/assistant** directly.

> **Why "Saarthi"?** A *saarthi* (सारथी) is the charioteer — the one who guides
> the journey while the traveller decides where to go. That is exactly the
> relationship the product is trying to have with a commuter. To rename it,
> change one line in `web/src/lib/chat/branding.ts`.

Your conversation is now **saved to your account**, so it is still there on your
next visit and on your other devices. A **Clear conversation** button deletes it
permanently. Clearing the transcript does not undo any saved travel plan — those
are separate structured records.

### 1. A clear instruction — applied straight away

Type:

```
I want to leave at 6 PM today
```

- [ ] The reply **states** it is updating your plan to 6:00 PM — it must NOT ask
      "would you like me to…". A clear, unhedged instruction is acted on.
- [ ] A card shows the departure, predicted demand and estimated arrival
- [ ] A follow-up message confirms it was saved and says what it did to the city

### 2. An uncertain statement — must be confirmed

Type:

```
I think I might leave at 6
```

- [ ] The reply is a **question** ("Would you like me to update…"), not a statement
- [ ] The card has **Confirm** and **Not now** buttons
- [ ] Press **Not now** → the card says "No change saved."
- [ ] Check the dashboard — your plan has **not** changed
- [ ] Reload `/assistant` — the whole conversation is still there

> This is the rule the project cares about: hedged wording is never written to
> the database.

### 3. An ambiguous time — the reading is shown

Type:

```
I am leaving at 8
```

- [ ] The reply says "I have read that as 8:00 AM" (or PM, whichever is nearer
      your usual departure) and asks you to confirm
- [ ] The card shows the exact time that would be saved

### 4. Arriving by a time

```
I need to reach office by 9
```

- [ ] It works backwards using the journey time from your profile, and says so
- [ ] It asks before saving

### 5. Other things to try

| Type this | Expect |
|---|---|
| `I can leave 30 minutes late today` | Shifts your current plan by +30 min |
| `I don't want to leave before 8` | Only proposes a change if your plan is earlier |
| `I want to take the metro` | Records the mode; notes metro uses no road capacity |
| `I don't want to drive today` | Asks which mode instead — it will not guess |
| `I'm not travelling today` | Offers to remove your trip |
| `When should I leave?` | Answers, saves nothing |
| `What is traffic like at 6?` | Gives the index and calls it a prediction |
| `Tell me a joke` | Says it did not follow, and lists what it can do |
| `my destination is different` | Explains route changes belong in My profile, and links there |

---

## The part that matters most: demand smoothing

This is the requirement that CityFlow AI must not simply move a jam. To see it
working you need **two or three accounts** (use different emails; they can all
be fake).

1. Create 3 accounts, each with **the same city** and a **similar routine**
   (e.g. usual departure 09:00, arrival by 09:45, flexibility 1 hour, willing to
   leave earlier **and** later).
2. On account A, open the assistant and confirm `I want to leave at 8:45 AM`.
3. Repeat on account B, then C — confirming the **same** 8:45 AM each time.

What to look for:

- [ ] After each confirmation the assistant reports how many **other**
      recommendations were adjusted (never who they belong to)
- [ ] On the **Upcoming demand** card, the note "N confirmed travel plans … are
      counted in this window" appears, and the bar at 8:45 grows
- [ ] Log back into an account whose recommendation moved — a teal banner says
      **"Your recommendation has been updated"** and explains why
- [ ] The recommended times **spread out** (8:30 / 8:45 / 9:00) instead of all
      three being told 8:45

If all three kept being told 8:45, the smoothing is not working — tell me.

---

## What is real and what is not

| | Status |
|---|---|
| Intent recognition | **Rule-based pattern matching, not an LLM.** Deterministic, free, offline. It says so when it does not understand. |
| The conversation | Saved to your account so history persists. It is a **record, never an input** — nothing in the demand or recommendation pipeline reads it. Deletable at any time from the assistant page. |
| What the system acts on | Only the structured plan you confirm: date, zones, times, mode. |
| Aggregated demand | Counts only — no user id, no CityFlow ID, no route. Cannot be traced back to a person. |
| Trip weight | Each confirmed trip counts as more than one vehicle, because a handful of test users cannot move a city index. It is a **modelling choice**, documented in `lib/demand/aggregate.ts`. |
| Accidents / closures / weather | The table and the whole update path exist. **No live feed is connected** — rows are entered by hand. |
| Notifications | In-app only. No email or push. |

---

## Save and deploy

```bash
cd ..
git add .
git commit -m "Phase 3: AI assistant, travel intent, demand aggregation and city-wide re-optimisation"
git push origin main
```

Vercel redeploys automatically. **No new environment variables.**

> ⚠️ After deploying, run the database migration against production too:
> the Vercel build runs `prisma generate` but not `prisma db push`. From your
> Mac, with your `.env` pointing at the same Neon database, `npm run db:push`
> is enough — you already did this in step 1.
