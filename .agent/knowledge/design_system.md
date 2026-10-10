# Vesta Design System — direction C ("bright and modern")

> **Version:** 3.0 (October 2026). Replaces "Digital Hearth" v2.
> **Principle:** Nourishment over Numbers: never clinical, never shaming.
> **Full spec, with live component previews:** https://claude.ai/artifact/W9cu6wcRWW9agjtjn7EJU1
> **Tokens in code:** `index.css` (`@theme` plus `:root` / `.dark` in `@layer base`).

The look has four parts:
- solid warm-white surfaces;
- **one bold Hearth block per screen**;
- ink-black controls;
- soft tinted tiles that colour-code each metric.

It should feel energetic and clear, like a good app, not a recipe book.

---

## 1. Colour

### Grounds and text
| Token / utility | Light | Dark | Use |
|---|---|---|---|
| `bg-background` | #FBF8F3 | #17181D | Page canvas |
| `bg-surface` | #FFFDF9 | #21232B | Cards, sheets, modals (always with `border-border`) |
| `bg-surface-sunken` | #F3EEE6 | #1C1D23 | Wells, inactive segments, skeletons |
| `border-border` | #ECE6DC | #2F323C | Decorative hairline |
| `border-border-control` | #8E8A84 | #6B6F7A | Input and outlined-control edges (3:1 or better) |
| `text-main` | #1F2430 | #F3EFE8 | All primary text |
| `text-muted` | #5D6270 | #A3A7B3 | Secondary text (4.5:1 or better at any size) |

- `charcoal` now means Ink (#1F2430), and dark mode re-points it to cream.
- `stone`/`stone-50` is the canvas colour.
- **Never fade text with opacity** (`text-charcoal/60`). Use `text-muted`.

### Bold colour and controls
- `primary` is Hearth deepened to **#B94E36** in light mode (Hearth #E07A5F in dark). Text on it is `text-primary-foreground`.
- Use at most **one solid primary block per screen** (the Today hero). Small marks (active state, progress, the selected day) can also use it.
- `bg-ink text-on-ink`: the primary button and the bottom nav bar.
- `secondary` is sage (#467560 light / #81B29A dark) with `text-secondary-foreground`.

### Metrics
Every metric has a mark colour (rings and charts only, never text), a tile/track tint and a text colour:

| Metric | Mark | Tint | Text on tint |
|---|---|---|---|
| Calories | `calories` | `calories-bg` | `calories-text` |
| Water | `water` | `water-bg` | `water-text` |
| Weight | `weight` | `weight-bg` | `weight-text` |
| Workouts | `workout` (plum) | `workout-bg` | `workout-text` |
| Fasting | `fasting` | `fasting-bg` | `fasting-text` |

The chart order is `--chart-1` to `--chart-5`: calories, water, weight, workouts, fasting.

### Status
- `warning` (amber) is for over-limit and caution. Over target is never `error`, and never red.
- `error` (rose) is for real errors and destructive actions only.

### Scales
The 50–900 families (`terracotta`, `sage`, `ocean`, `plum`, `amber`, `rose`, `stone`) remain for illustration and charts. Stock Tailwind palettes are banned. Text on light grounds uses step 700 or darker.

---

## 2. Typography

Two families:
- **Figtree** (`font-sans`, the default) for body and UI text, at weights 400, 500, 600 and 700.
- **Nunito** (`font-display`, weight 800) for view titles, section and card headings, and big figures.

`h1`–`h6` and the `heading-*` classes use `font-display` automatically. Add `font-display` to any other `font-extrabold` figure. `font-serif` is an alias of `font-display`, kept for older markup; don't use it in new code.

| Use | Classes |
|---|---|
| View title (Header) | `font-display text-[32px] leading-9 font-extrabold tracking-tight` |
| Section / modal title | `heading-2` (22/28, weight 800) |
| Card title | `heading-3` (17/24, weight 700) |
| Body | `text-base` |
| Secondary | `text-sm text-muted` |
| Caption / badge | `text-xs font-semibold` |
| Hero figure | `font-display text-5xl font-extrabold` |
| Tile figure | `font-display text-2xl font-extrabold` |

- **Sentence case everywhere.** No uppercase eyebrows, no `tracking-widest`, no Title Case buttons.
- Figures are tabular (set on `body`).

---

## 3. Shape, space, elevation

- **Corners:**
  - Buttons, pills, the nav bar and avatars: `rounded-full`.
  - Cards and the hero block: 18px (`rounded-3xl` now resolves to 18px).
  - Tiles and inputs: 14px.
  - Modals: 24px.
  - Badges: 8px.

  The `rounded-organic-*` classes are aliases of these values; don't add new hand-molded corners.
- **Spacing:** a 4px grid. Cards use `p-4 md:p-6`, tiles sit `gap-2`/`md:gap-3` apart, and sections are `space-y-6`.
- **Flat by default.** Cards rely on their border. `shadow-soft` and `premium-shadow` resolve to a small shadow, and only floating UI (nav, modals) gets real elevation.
- **No glass:** `glass-card` now renders as a solid surface. Don't use `backdrop-blur`, `bg-white/NN` or gradients.
- **Mobile-first** at 375px. Every tappable control is at least 44px (`touch-target`, `min-h-11`).

---

## 4. Components (classes in `index.css`)

| Class | What |
|---|---|
| `btn-primary` | Ink pill, the main action (one per view) |
| `btn-accent` | Hearth pill, for brand moments only, never next to a hero |
| `btn-secondary` | Surface pill with a control border |
| `btn-ghost` | Low emphasis |
| `btn-sm`, `btn-lg`, `btn-block` | Size and width modifiers |
| `icon-btn` | 44px round icon button (needs `aria-label`) |
| `card`, `card-hover`, `card-padding` | Solid content containers |
| `hero` | The one bold primary block (Today calories) |
| `tile tile-{calories,water,weight,workout,fasting,neutral}` | Metric tiles |
| `badge badge-{calories,water,weight,workout,fasting,warning,neutral,ink}` | Labels (old names `badge-terracotta/sage/plum/teal/stone/amber` are aliases) |
| `input`, `input-error` | Text fields |
| `nav-bar`, `nav-item` (`aria-current="page"`) | The floating ink bottom nav |

- **Focus:** a 2px `--focus-ring` (ink) outline, offset 2px.
- **Motion:**
  - Presses scale to 0.98 over 150ms.
  - Rings fill over 1s.
  - Nothing glows or pulses, except the active `StreakFlame`.
  - Respect `motion-reduce`.

---

## 5. Dark mode

Dark mode is the `.dark` class on `<html>`. Every semantic token above has a designed dark value. Before using a CSS variable, confirm `index.css` defines it under both `:root` and `.dark`. In dark mode:
- `surface` is close to `background`, so keep card borders;
- `primary` brightens and takes dark foreground text;
- `ink` flips to cream.

---

## 6. Don'ts

- Pure white or black surfaces; translucent white cards; blur.
- Opacity-faded text, uppercase eyebrows, serif headings, Nunito for body copy.
- More than one solid primary block per screen.
- White text on pastel fills. Use the `*-foreground` / `*-text` partner.
- Red or rose for calorie overages.
- Emoji in UI copy. Use the `StreakFlame` icon instead of 🔥.
