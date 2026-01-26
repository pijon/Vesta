# Feature: Align List Item Colors

## Summary
The user requested that list items in "From Your Plan" and "Today's Log" match the color of the "No meals planned for tomorrow" placeholder.
Inspection reveals the placeholder uses `dark:bg-white/5` and `dark:border-white/10`.
Currently, list items use `dark:bg-white/[0.02]` and `dark:border-white/[0.03]`.
I will update the list items to match the placeholder's brighter/higher-contrast style (5% bg, 10% border).

## Proposed Changes

### Components

#### [MODIFY] [DualTrackSection.tsx](file:///Users/jon/Development/github/vista/components/DualTrackSection.tsx)
- Update Uncompleted Meal Item container:
    - Change `dark:bg-white/[0.02]` to `dark:bg-white/5`
    - Change `dark:border-white/[0.03]` to `dark:border-white/10`
- Update Logged Food Item container:
    - Change `dark:bg-white/[0.02]` to `dark:bg-white/5`
    - Change `dark:border-white/[0.03]` to `dark:border-white/10`
- Update Logged Workout Item container:
    - Change `dark:bg-white/[0.02]` to `dark:bg-white/5`
    - Change `dark:border-white/[0.03]` to `dark:border-white/10`

## Verification Plan

### Automated
- Run `npx tsc --noEmit` to ensure no regressions.

### Manual
- Verify visually that the list items now have the same background/border intensity as the placeholder (in dark mode).
