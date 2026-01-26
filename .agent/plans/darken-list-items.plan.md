# Feature: Darken List Items Further

## Summary
The user reports that the list items in "From Your Plan" and "Today's Log" are still the "wrong color" compared to the "No meals planned" placeholder.
Both are currently set to `dark:bg-white/5`.
However, because list items are *inside* a container that might already have a background (or stacking context), they might appear lighter.
To ensure they look "darker" or more subtle (as list rows often do compared to empty states), I will reduce their opacity to `dark:bg-white/[0.02]` (2% opacity).
This ultra-low opacity allows the dark background of the parent card to show through more, effectively making them darker.

## Proposed Changes

### Components

#### [MODIFY] [DualTrackSection.tsx](file:///Users/jon/Development/github/vista/components/DualTrackSection.tsx)
- Change list item backgrounds from `dark:bg-white/5` to `dark:bg-white/[0.02]`
- Change list item borders from `dark:border-white/10` to `dark:border-white/[0.05]` (5% border)
- This affects:
    - Uncompeleted Meal Items
    - Logged Food Items
    - Logged Workout Items

## Verification Plan

### Automated
- Run `npx tsc --noEmit` to ensure no regressions.

### Manual
- Visual check: List items should now be very subtle/dark, likely matching the intended "deep" look the user wants.
