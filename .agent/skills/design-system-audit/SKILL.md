---
name: design-system-audit
description: Verify compliance with the Vesta Design System using `dora` and manual checks. Use this when updating UI or investigating regressions.
---

# Design System Audit

This workflow ensures all UI components adhere to the "Digital Hearth" aesthetic and technical requirements.

## 1. Core Verification Steps

When auditing a file or component:

1.  **Check for "Illegal" Text Colors:**
    -   `text-muted` (Legacy) -> MUST BE replaced with `text-charcoal/60 dark:text-stone-400`
    -   `text-stone-500` (Dark Mode) -> MUST BE `dark:text-stone-400` (Stone-500 is too dark for text on dark backgrounds)
    -   `text-gray-*` -> BANNED. Use `text-charcoal` or `text-stone`.

2.  **Check for "Illegal" Backgrounds:**
    -   `bg-white` (Light Mode) ->
        -   ALLOWED for **Card Surfaces**.
        -   BANNED for **Inner Cards** (use `bg-charcoal/5` or `bg-charcoal/[0.03]`).
    -   `dark:bg-white/5` -> REQUIRED for Dark Mode surfaces/cards.

3.  **Check Semantic Variable Usage:**
    -   Any use of `bg-calories-bg`, `bg-workout-bg` etc. MUST be verified in `index.css`.
    -   Primitives (e.g. `var(--terracotta-100)`) MUST be defined or avoided in favor of explicit RGBA colors.

## 2. Common Regressions

-   **Dark Mode Visibility:**
    -   Ensure primary text is `dark:text-stone-200`.
    -   Ensure secondary text is `dark:text-stone-400`.
    -   Ensure borders are `dark:border-white/5` or `dark:border-white/10`.

-   **Glass Effect:**
    -   Use `glass-card` class, but override carefully.
    -   Dark mode glass should be subtly lighter than background: `dark:bg-white/5`.

## 3. Reference Table

| Element | Light Mode | Dark Mode |
| :--- | :--- | :--- |
| **Page BG** | `bg-stone-50` | `bg-[#1A1714]` |
| **Card BG** | `bg-white` | `bg-white/5` |
| **Inner Item BG** | `bg-charcoal/5` | `bg-white/5` |
| **Primary Text** | `text-charcoal` | `text-stone-200` |
| **Secondary Text** | `text-charcoal/60` | `text-stone-400` |
| **Borders** | `border-charcoal/5` | `border-white/5` |

## 4. Audit Command (Manual)

Run `grep` to find violations:

```bash
# Find legacy text-muted
grep -r "text-muted" src/components

# Find incorrect dark mode text
grep -r "dark:text-stone-500" src/components

# Find hardcoded grays
grep -r "text-gray-" src/components
```
