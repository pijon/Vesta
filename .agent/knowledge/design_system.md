# Vesta Design System — "Market day"

> **Version:** 4.0 (October 2026). Replaces direction C ("bright and modern").
> **Principle:** Nourishment over Numbers: never clinical, never shaming.
> **Full spec, with live component previews:** https://claude.ai/artifact/W9cu6wcRWW9agjtjn7EJU1
> **Tokens in code:** `index.css` (`@theme` plus `:root` / `.dark` in `@layer base`).

The look has five parts:
- a warm **butter** page with cream surfaces, and cards set apart by colour rather than lines;
- **one bold block per screen**, usually the bright **tomato** hero (Today has two: the tomato hero and the green Tonight card);
- **ink** pills for the main action and for every selected state;
- round shapes: round plates and icon tiles, fully round buttons, chips and badges;
- soft metric tints that colour-code calories, water, weight, workouts and fasting.

It should feel like a sunny market stall: generous, bright and friendly, not clinical.

---

## 1. Colour

### Grounds and text
| Token / utility | Light | Dark | Use |
|---|---|---|---|
| `bg-background` | #FFF1D6 (butter) | #1A1714 | Page canvas |
| `bg-surface` | #FFF9EC (cream) | #24201B | Cards, sheets, the tab bar and sidebar panel |
| `bg-surface-sunken` | #F7E3BB | #1F1B17 | Wells, filled secondary buttons and chips, empty states |
| `border-border` | #F1E3C4 | #3A332A | Decorative hairline (dark-mode cards, dividers) |
| `border-border-control` | #8A7650 | #7A6E5C | Input edges (3:1 or better) |
| `text-main` | #1B1B1B | #FFF1D6 | All primary text |
| `text-muted` | #6B5A3A | #BBAE96 | Secondary text (4.5:1 or better at any size) |

- `charcoal` means Ink (#1B1B1B), and dark mode re-points it to cream.
- `stone`/`stone-50` is the canvas colour (butter, or the dark page in dark mode).
- **Never fade text with opacity** (`text-charcoal/60`). Use `text-muted`.

### Bold colour and controls
- `hero` is bright tomato **#FF5533** (#FF6A4A in dark) with ink text (`--hero-foreground`). The `hero` class uses it.
- `primary` is a deeper tomato, **#C9351A** in light mode (#FF6A4A in dark), so it also passes as text and small marks. Text on it is `text-primary-foreground`.
- `secondary` is leaf green: #17714A light / #4CC38A dark, with `text-secondary-foreground`. The Tonight card and the coach card use it.
- `bg-ink text-on-ink`: the primary button and **every selected state**: the current tab and sidebar item, the current segment, selected chips, today's date in the planner.
- Use at most **one bold block per screen** (tomato hero, or a green block). Today is the exception with two: the tomato calories hero and the green Tonight card side by side.

### Metrics
Every metric has a mark colour (rings, bars and charts, never text), a tint for tiles and round icons, and a text colour for use on the tint:

| Metric | Mark (light) | Tint | Text on tint |
|---|---|---|---|
| Calories | `calories` #FF5533 tomato | `calories-bg` #FFD9CC | `calories-text` #8A2A12 |
| Water | `water` #3D8BD9 sky | `water-bg` #D6EBFF | `water-text` #1E4E80 |
| Weight | `weight` #17714A leaf | `weight-bg` #D3EEDC | `weight-text` #145A3B |
| Workouts | `workout` #E86A92 pink | `workout-bg` #FFD9E4 | `workout-text` #7A2D48 |
| Fasting | `fasting` #E0A800 butter | `fasting-bg` #FFE9A8 | `fasting-text` #6B5310 |

Use them as `tile-*` (tint and text together), `bg-*-bg` with `text-*-text`, or `badge-*`. The chart order is `--chart-1` to `--chart-5`: calories, water, weight, workouts, fasting. Tinted cards (the evening "Did you eat as planned?" card, the weekend card) are `rounded-[24px] bg-*-bg p-5` with a round `bg-surface` icon.

### Status
- `warning` is a saturated dark amber (#A05200 light / #F5B83D dark) for over-limit and caution. Over target is never `error`, and never red.
- `error` (rose) is for real errors and destructive actions only.

### Scales
The 50–900 families (`terracotta`, `sage`, `ocean`, `plum`, `amber`, `rose`, `stone`) remain for illustration and charts. Stock Tailwind palettes are banned. Text on light grounds uses step 700 or darker.

---

## 2. Typography

Two families, loaded in `index.html`:
- **DM Sans** (`font-sans`, the default) for body and UI text, at weights 400–700.
- **Bricolage Grotesque** (`font-display`, weight 800) for view titles, headings, big figures and the navigation labels.

`h1`–`h6` and the `heading-*` classes use `font-display` automatically. Add `font-display` to any other `font-extrabold` figure. `font-serif` is an alias of `font-display`, kept for older markup; don't use it in new code.

The small sizes are larger than Tailwind's: **`text-xs` is 13px and `text-sm` is 15px** (set in `@theme`), so captions and list rows read comfortably.

| Use | Classes |
|---|---|
| Today greeting (Header `large`) | `text-[40px] leading-[1] tracking-[-0.04em] md:text-5xl` |
| View title (Header) | `font-display text-[32px] leading-9 font-extrabold tracking-tight` |
| Section / modal title | `heading-2` (26/32, weight 800) |
| Card title | `heading-3` (19/24, weight 800) |
| Body | `text-base` |
| Secondary | `text-sm text-muted` |
| Caption / badge | `text-xs font-semibold` |
| Hero figure | `font-display font-extrabold text-[80px] leading-[0.9] tracking-[-0.05em]` |
| Strip / tile figure | `font-display font-extrabold text-[22px] leading-7 tracking-tight` |

- **Sentence case everywhere.** No uppercase eyebrows, no `tracking-widest`, no Title Case buttons. (The sidebar's "vesta" wordmark is lowercase on purpose.)
- Figures are tabular (set on `body`).

---

## 3. Shape, space, elevation

- **Corners:**
  - Buttons, chips, badges, the tab bar, avatars, meal plates and icon tiles: `rounded-full`.
  - The hero and the Tonight card: 28px. Cards: 24px (`rounded-3xl` resolves to 24px). Tinted cards: 24px.
  - Tiles: 20px. Inputs: 16px.
  - Sheets and modals: 32px (top corners only on phones).
  - The sidebar panel: 28px.

  The `rounded-organic-*` classes are aliases kept for old markup; don't add new hand-molded corners.
- **Spacing:** a 4px grid. Cards use `p-4 md:p-6`, tinted cards `p-5 md:p-6`, and sections are `space-y-6` to `space-y-8`.
- **Borderless in light mode.** Cards (`card`, `card-hover`, `glass-card`) have no visible border in light mode: cream on butter is enough. Dark mode keeps the `border-border` hairline, as the surface is close to the page.
- **Flat by default.** Only floating UI gets real elevation: the tab bar (`--elev-md`) and sheets (`--elev-lg`).
- **No glass:** `glass-card` renders as a solid surface. Don't use `backdrop-blur`, `bg-white/NN` or gradients.
- **Mobile-first** at 375px. Every tappable control is at least 44px (`touch-target`, `min-h-11`, or the `hit-target` / `btn-sm` invisible tap area).

---

## 4. Components (classes in `index.css`)

These live in `@layer components`, so Tailwind utilities in markup override them: `md:hidden` on an `icon-btn`, `py-8` on a `tile`, `size-9` on an `icon-btn`. No `!` or wrapper `<span>` is needed. Add new component classes there, not to `@layer utilities`.

| Class | What |
|---|---|
| `btn-primary` | Ink pill, the main action (one per view). 48px tall, 16px text |
| `btn-accent` | Tomato pill, for brand moments only, never next to a hero |
| `btn-secondary` | Filled `surface-sunken` pill, no border |
| `btn-ghost` | Low emphasis |
| `btn-sm`, `btn-lg`, `btn-block` | Size and width modifiers (`btn-sm` is 40px with a 44px tap area) |
| `icon-btn` | 44px round icon button on `surface`, no border (needs `aria-label`) |
| `chip` | Borderless sunken pill; selected (`aria-pressed`/`aria-checked`) is ink |
| `segmented`, `segment` | Switch between sibling views; the current segment is an ink pill |
| `card`, `card-hover`, `card-padding` | Solid cream containers (borderless in light mode) |
| `hero` | The one bold block: tomato with ink text (Today calories, Analytics weight, Settings account, the shopping list) |
| `tile tile-{calories,water,weight,workout,fasting,neutral}` | Metric tiles |
| `icon-tile` | A small round icon on a tint beside a row or card title |
| `badge badge-{calories,water,weight,workout,fasting,warning,neutral,ink}` | Round labels (old names `badge-terracotta/sage/plum/teal/stone/amber` are aliases) |
| `input`, `input-error` | Text fields |
| `tab-bar`, `tab-item`, `tab-label` (`aria-current="page"`) | Phones: a floating pill in the card colour above the bottom edge, icon over label, the current tab an ink pill. The page leaves `6rem` plus the safe area under it |
| `side-nav`, `side-item`, `side-label` (`aria-current="page"`) | From `md` up: a floating card-colour panel inset 12px from the window edges (icon rail on tablets, labelled on desktop), the current item an ink pill, Settings pinned at the bottom |

- **Logo:** `components/VestaMark.tsx`: a butter (#FFD23F) flame over a cream (#FFF1D6) bowl on a tomato (#FF5533) tile with 30/100 corners. The static icons (`public/favicon.svg`, `favicon.ico`, the PWA and Apple icons, `public/resources/logo_*.png`) are the same mark; their sources are in `assets/icon/`.
- **Focus:** a 2px `--focus-ring` (ink) outline, offset 2px.
- **Motion:**
  - Presses scale to 0.98 over 150ms.
  - Rings and bars fill over about 1s.
  - Nothing glows or pulses, except the active `StreakFlame`.
  - Respect `motion-reduce`.

---

## 5. Dark mode

Dark mode is the `.dark` class on `<html>`. Every semantic token above has a designed dark value: a warm near-black page, brighter tomato and leaf, and pastel text on deep metric tints. Before using a CSS variable, confirm `index.css` defines it under both `:root` and `.dark` (or once in `@theme` when it doesn't change, like the type sizes and radii). In dark mode:
- `surface` is close to `background`, so cards keep their border;
- `primary` and `hero` brighten and keep ink (#1B1B1B) text;
- `ink` flips to cream, so selected states become cream pills with dark text.

---

## 6. Don'ts

- Pure white or black surfaces; translucent white cards; blur; gradients.
- Opacity-faded text, uppercase eyebrows, serif headings, Bricolage for body copy.
- More than one bold block per screen (Today's hero and Tonight card are the one exception).
- Borders on light-mode cards, or square corners on buttons, chips and badges.
- White text on pastel fills. Use the `*-foreground` / `*-text` partner.
- Red or rose for calorie overages.
- Emoji in UI copy. Use the `StreakFlame` icon instead of 🔥.
