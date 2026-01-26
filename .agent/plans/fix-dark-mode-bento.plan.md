# Feature: Bento Grid Dark Mode Fix

## Problem
The "Activity" widget becomes bright white in dark mode (likely due to a hover state conflict or improper class). Text contrast on all widgets is suboptimal in dark mode.

## Solution
1.  **Remove Aggressive Hover**: Replace `hover:bg-white` with `hover:bg-white/60` (light) and `dark:hover:bg-white/10` (dark).
2.  **Fix Text Contrast**: Use `dark:text-stone-200` for primary numbers and `dark:text-stone-400` for labels to ensure readability against dark backgrounds.
3.  **Button Styling**: Update the new (+) buttons to be visible but subtle in dark mode.

## Files to Change
-   `components/BentoGrid.tsx`

## Step-by-Step
1.  Modify `ActivityCard` container classes.
2.  Modify `WeightCard` container classes.
3.  Update text classes in all 4 cards to ensure high contrast in dark mode.
4.  Standardize the "plus" button style (bg-white/10 in dark mode).

## Validation
-   Static analysis (TSC).
-   Visual check (implicit via instruction to user).
