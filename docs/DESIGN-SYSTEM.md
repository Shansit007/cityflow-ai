# CityFlow AI — Design System

Everything visual is defined in one file: `web/src/app/globals.css`.
Change a value there and it updates across the whole product, in both themes.

---

## 1. The feeling we are aiming for

| We want | We avoid |
|---|---|
| Official, calm, reliable | Neon colours, cyberpunk styling |
| Clean and data-driven | Heavy gradients, glassmorphism everywhere |
| Accessible on a cheap phone | Large decorative elements, heavy animation |
| Trustworthy public service | Generic SaaS look, rows of identical blue cards |

---

## 2. Colour

Colours are **semantic**. A component asks for `traffic-high`, not "red".
That is what lets light and dark mode both work correctly.

### Brand

| Token | Light | Dark | Used for |
|---|---|---|---|
| `primary` | `#14396f` deep government navy | `#7ba6ee` | Main actions, active navigation |
| `secondary` | `#0e6f78` teal | `#4cc2cd` | Data, intelligence, section labels |
| `accent` | `#b45309` controlled saffron | `#e2a04a` | Used sparingly for emphasis |

### Traffic status

| Meaning | Token |
|---|---|
| Normal / low | `traffic-low` (green) |
| Moderate | `traffic-moderate` (amber) |
| Heavy / high | `traffic-high` (red) |
| Critical | `traffic-severe` (dark red) |

### Road condition

`road-good` · `road-attention` · `road-poor` · `road-critical`

### Surfaces

`bg` (page) → `surface` (cards) → `surface-2` (inset) → `surface-3` (pressed)
Text: `fg` → `muted` → `subtle`. Borders: `border-base`, `border-strong`.

> **Rule:** never make everything blue. Blue means "primary action or active
> navigation". Status must use its own status colour.

---

## 3. Dark mode

Dark mode is **not an inversion**:

- surfaces stay slightly navy, never pure black
- `primary` becomes *lighter* in dark mode so contrast survives
- the city artwork's opacity drops (`--cf-backdrop-opacity`) so it does not glow
- shadows get deeper instead of disappearing

It is driven by a `dark` class on `<html>`, set by `ThemeProvider`. A tiny inline
script in `layout.tsx` applies it before the first paint, so a dark-mode user
never sees a white flash.

---

## 4. Typography

- **Inter**, loaded through `next/font` (self-hosted at build time — no external request).
- Headings: 600 weight, tight tracking.
- Body: 400/500, `leading-relaxed` for anything over two lines.
- Small caption labels use `uppercase` + `tracking-[0.14em]` and are always
  paired with a real heading — never used alone as a heading.

---

## 5. City visual identity

Each supported city has a hand-drawn SVG in
`web/src/components/city/city-skyline.tsx`:

| City | Visual |
|---|---|
| Delhi | India Gate on a tree-lined boulevard |
| Bengaluru | Tech-park towers, green arterial road |
| Mumbai | Marine Drive curve, dense skyline |
| Hyderabad | Charminar beside modern towers |
| Pune | Green hills behind a wide road |
| Bhopal | Upper Lake, causeway, green edge |
| Chennai | Marina coastline and lighthouse |
| Kolkata | Howrah Bridge over the river |

**Rules the artwork must obey:**

1. It is decoration — always `aria-hidden`, never carries information.
2. It fades towards the top (an SVG mask) so headlines sit on a clean area.
3. A theme-aware scrim sits above it, so text contrast is guaranteed.
4. It is drawn, not photographed — small file size, no licensing questions,
   and it inherits theme colours automatically.

Adding a city = one entry in `lib/cities.ts` + one drawing function.

---

## 6. Accessibility rules the components enforce

- **Focus** — every interactive element shows a 2px focus ring (`:focus-visible`).
- **Never colour alone** — traffic and road badges also carry a shape marker
  (● ▲ ◆ ■) and a text label.
- **Real labels** — every input has a `<label>`, not just a placeholder.
- **Errors are announced** — `role="alert"` plus `aria-describedby`.
- **Charts have a text version** — visually hidden, listing the same numbers.
- **Touch targets** — controls are at least 40px tall (`h-10`/`h-11`).
- **Skip link** — keyboard users can jump past the header.
- **Reduced motion** — all animation is disabled when the OS asks for it.

---

## 7. Component primitives

| Component | File | Notes |
|---|---|---|
| `Button` / `ButtonLink` | `ui/button.tsx` | Use `ButtonLink` when it navigates, `Button` when it acts |
| `Card` / `CardHeader` | `ui/card.tsx` | Quiet by default; `raised` for the single most important card |
| `Badge` | `ui/badge.tsx` | Status chip with shape marker |
| `TextField` / `Notice` | `ui/input.tsx` | Label + hint + error, wired for screen readers |
| `Container` | `ui/container.tsx` | One place controls page width and side padding |
| `SectionHeading` | `ui/section-heading.tsx` | eyebrow + title + description |

---

## 8. Writing style in the UI

- Say what is estimated: "expected", "predicted", "may help".
- Never promise a time saving that has not been calculated.
- Every recommendation is followed by *why*.
- Label anything not yet built as not yet built. An honest empty state beats
  fake data.
