# Saarthi — the assistant

> *Saarthi* means charioteer: the one who handles the route so the traveller can
> think about where they are going.

---

## What it does

Two jobs, one conversation.

| You say | It does |
|---|---|
| "I want to leave at 6 PM today" | proposes the change, shows what would be saved, waits for you |
| "Where do I report a pothole?" | answers, and gives you a button to the page |

The second job is the newer one. Before it existed, every "where is…" and "how
do I…" fell through to a generic "I did not follow that" — which is a bad answer,
because the question was reasonable and the product does have an answer.

---

## Where to find it

- **A small round compass button, bottom-right, on every signed-in page.**
  On a phone it is just the icon; from `sm` upwards the name appears beside it.
- **Saarthi** in the top navigation, with the same mark.
- The full page at `/assistant`, which keeps your history.

It hides itself in exactly two places: on `/assistant` (it would point at the
page you are reading) and anywhere under `/admin` — the Admin Portal is a
separate part of the product and must never carry commuter chrome.

### Why a compass and not a speech bubble

A speech bubble says "there is a chatbot here", which is the least interesting
thing about this assistant and the thing people are most tired of seeing. A
compass needle says "a guide, pointing" — which is both the meaning of the name
and what it actually does.

The mark is drawn as inline SVG rather than an image file, so it inherits the
current text colour, stays sharp at any size, adds no network request, and needs
no second asset for dark mode.

---

## What it knows about the app

27 topics, in `web/src/lib/chat/app-guide.ts`. Each has an answer and, where the
feature lives on a page, a link to it.

Grouped roughly:

| Group | Examples |
|---|---|
| The idea | what CityFlow AI is · demand smoothing · "won't everyone get the same time?" |
| Using it | changing today's departure · changing your routine · what confirming does · why you got that time |
| The numbers | what 0–100 means · whether it is real measured traffic |
| Privacy | your CityFlow ID · who can see your data · whether your location is tracked |
| Roads | reporting a pothole · phone road sensing · who actually repairs roads |
| Participation | your contribution · rewards (there are none) |
| Getting around | dashboard · city · history · dark mode · notifications · map · account · cost |
| The project | the Admin Portal · SUMO simulation · who Saarthi is |

### The rule every answer follows

**It must be true of the application as it exists.**

No planned feature is described as real. Where something is not built — changing
your password, repair status, rewards — the answer says so plainly and offers
what *is* there.

An assistant that confidently describes a screen the person then cannot find is
worse than one that says "I don't know": it wastes their time and costs them
their trust in everything else it said.

---

## How a travel instruction and an app question are told apart

This is the part worth understanding, because getting it wrong in either
direction is bad. Answering "I want to leave at 6 PM" with a help page is
useless; answering "what does 0-100 mean?" with "shall I move you to 1:00?" is
worse.

`parseIntent()` checks in this order:

1. greeting, small talk, `help`
2. **`ASK_RECOMMENDATION`** — "when should I leave?" is unambiguous and deserves
   the real answer, not a page link
3. **`ASK_APP_HELP`**, only when all three hold:
   - the sentence is SHAPED as a question about the product
   - a topic scores at least `CONFIDENT_TOPIC_SCORE`
   - **it is not a travel question in disguise**
4. `ASK_TRAFFIC`
5. the travel matchers, unchanged

### The disguise rule

*"What is traffic like at 6 PM"* and *"how does traffic prediction work"* both
mention traffic. The discriminator:

> A message carrying **both a parseable clock time and a travel word** is never
> treated as a question about the app.

The first has both, so it goes to the traffic answer. The second has neither a
time nor a travel instruction, so it goes to the app answer.

There is a second guard further down: the "a bare time is probably a departure"
fallback is skipped entirely for anything question-shaped, so *"what is the
0-100 index?"* can never become an offer to change your travel plan.

### Scoring

A multi-word keyword scores the **square of its word count**, so one three-word
hit beats three unrelated one-word hits — which is what you want when somebody
writes a full sentence.

A short list of `strongKeywords` per topic covers words that can only mean that
topic in this product ("pothole", "rewards", "history", "sumo"). They score as
much as a two-word phrase, so *"do I get any rewards?"* is answered rather than
shrugged at.

---

## When it does not understand

Three different outcomes, deliberately:

| Situation | What happens |
|---|---|
| A topic **almost** matched | "Did you want to know about reporting a road problem?" — the answer follows, framed as a guess |
| Small talk — thanks, ok, bye | acknowledged in a line |
| Genuinely nothing | says so plainly, with six examples split across its two jobs |

A weak match is never answered as though it were certain. Being wrong about what
somebody asked is worse than admitting the guess.

If you type just `yes`, it tells you the **Confirm** button is what actually
saves things — nothing is ever stored from a typed "yes", because the card is
the record of exactly what was agreed to.

---

## What it is not

Not a language model. It matches patterns, which is a deliberate trade:

- **free** — no API key, no per-message cost, which the project requires
- **deterministic** — the same sentence always produces the same proposal, which
  is what makes the confirmation card trustworthy
- **auditable** — you can point at the rule that fired

The cost is real and is stated on screen rather than hidden: it understands
travel sentences and questions about this app. It will not manage your calendar
or discuss the weather, and it says so instead of improvising.

`parseIntent()` is the seam. Swapping in a hosted model later means returning the
same `ParsedIntent` shape from a different implementation — nothing downstream
changes.

---

## Testing it

Ask these; each should give a real answer **and** a link where one applies:

```
where do i report a pothole
what does the 0-100 number mean
who can see my data
why was i given this time
how do i change my usual time
do i get any rewards
is this real traffic data
who fixes the roads
will everyone get the same time
who are you
```

Then check the boundary still holds:

```
what is traffic like at 6 pm      → the traffic answer, not a help page
i want to leave at 6 pm today     → a proposal card, not a help page
when should i leave               → today's recommendation
pothole                           → "Did you want to know about…?"
thanks                            → acknowledged, not a list of examples
```
