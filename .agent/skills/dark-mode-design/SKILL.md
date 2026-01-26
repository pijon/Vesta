---
name: dark-mode-design
description: Guidelines for implementing Vesta's "Evening Firelight" dark mode. Use when adding new UI components, fixing dark mode bugs, or styling elements to ensure they match the warm, earthy aesthetic and avoid harsh bright colors.
---

# Dark Mode Design (Evening Firelight)

Vesta's dark mode is NOT just inverted colors. It is an "Evening Firelight" theme designed to be warm, low-contrast, and restful.

## Core Principles

1.  **NO PURE BLACK**: Backgrounds are Warm Charcoal (`#1A1714` / `stone-950`).
2.  **NO PURE WHITE**: Text is lightly warmed Stone (`#F4F1DE` / `stone-200` or `stone-300`).
3.  **NO BRIGHT COLORS**:
    -   Avoid neon/standard tailwind colors like `blue-500`, `red-500`.
    -   **Use Muted equivalents**: `sky-300`, `rose-400`, `emerald-400`.
    -   colors should feel like they are "lit by firelight," not a computer screen.

## CSS / Tailwind Patterns

### 1. Element Backgrounds
-   **Cards**: Use extremely low opacity white to create depth.
    -   *Standard*: `dark:bg-white/5` (matches "No meals planned" placeholder).
    -   *Nested*: `dark:bg-white/[0.02]` (for items *inside* cards to prevent whiteness buildup).
-   **Borders**: faint white opacity.
    -   *Standard*: `dark:border-white/10`.
    -   *Subtle*: `dark:border-white/[0.05]`.

### 2. Text Colors
-   **Headings**: `dark:text-stone-200`.
-   **Body**: `dark:text-stone-400` (muted).
-   **Highlights**: `dark:text-flame` (#F2CC8F) for active states.

### 3. Explicit Overrides (STRICT RULES)
Always prefer semantic tokens over ad-hoc opacity stacking.
-   ❌ `bg-white dark:bg-white/5` (BANNED: causes contrast/stacking issues)
-   ✅ `bg-[var(--card-bg)]` (Preferred: handles both modes automatically)
-   ✅ `bg-neutral-100 dark:bg-white/5` (Acceptable for nested items)

### 4. Implementation Safety
If Tailwind classes behave unpredictably (e.g., stacking contexts causing lightness), use **Style Objects** for critical exact matches:

```tsx
style={{
  // Ensure visual match with designated placeholders
  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : undefined
}}
```

### 5. ANTI-PATTERNS (DO NOT USE)
-   **DO NOT** use `bg-white` with `dark:bg-white/5` on top-level cards. It often creates a "milky" washout effect. Always use the semantic token `bg-[var(--card-bg)]`.
-   **DO NOT** guess opacity values (e.g., `dark:bg-white/10` or `dark:bg-gray-800`). Use the defined system opacities (5% for surface, 2% for nested).

## Reference Palette
-   **Background**: `#1A1714`
-   **Card Surface**: `rgba(255, 255, 255, 0.05)`
-   **Primary Action**: `#E07A5F` (Hearth) - Keep legible but not neon.

## Color Methodology (MANDATORY)
**CRITICAL**: You **MUST** use the guide below when selecting ANY new colors. Do not guess.
[UI Colors Guide](file:///Users/jon/Development/github/vista/.agent/knowledge/ui_colors.md)
