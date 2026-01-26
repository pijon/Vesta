# Feature: Fix Hydration Widget Calculation

## Summary

The hydration widget in the Bento Grid (`HydrationCard`) currently uses a hardcoded goal of 2.5 Liters for calculating the progress bar height. This causes the visual representation to be incorrect for users with different hydration goals. We will update the component to accept a dynamic goal prop and use the user's actual `dailyWaterGoal` from global stats.

## User Story

As a user
I want the hydration widget to reflect my actual daily goal
So that the visual progress bar accurately represents my hydration status

## Problem Statement

The `HydrationCard` component in `components/BentoGrid.tsx` calculates the liquid fill height using `(liters / 2.5) * 100`, where `2.5` is a hardcoded value. This ignores the user's configured `dailyWaterGoal`.

## Solution Statement

We will:
1.  Update `HydrationCard` interface to accept a `goal` prop.
2.  Update the height calculation to use this `goal` prop.
3.  Pass the calculated goal (converted from mL to L) from `TrackToday.tsx` to the `HydrationCard`.

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | BUG_FIX                                           |
| Complexity       | LOW                                               |
| Systems Affected | `components/BentoGrid.tsx`, `components/TrackToday.tsx` |
| Dependencies     | None                                              |
| Estimated Tasks  | 2                                                 |

---

## UX Design

### Before State
The hydration widget always assumes a 2.5L goal. If a user has a 5L goal and drinks 2.5L, the widget shows 100% full, which is misleading.

### After State
The hydration widget uses the user's actual goal. If a user has a 5L goal and drinks 2.5L, the widget shows 50% full.

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `components/BentoGrid.tsx` | Hardcoded 2.5L limit | Dynamic `goal` limit | Visual accuracy |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `components/BentoGrid.tsx` | 65-103 | To understand current `HydrationCard` implementation |
| P0 | `components/TrackToday.tsx` | 312-315 | To see how `HydrationCard` is instantiated |
| P0 | `types.ts` | 46 | To confirm `UserStats` structure for `dailyWaterGoal` |

---

## Files to Change

| File                             | Action | Justification                            |
| -------------------------------- | ------ | ---------------------------------------- |
| `components/BentoGrid.tsx`       | UPDATE | Add `goal` prop and logic                |
| `components/TrackToday.tsx`      | UPDATE | Pass `goal` from stats                   |

---

## Step-by-Step Tasks

### Task 1: Update `HydrationCard` Component

- **ACTION**: Modify `HydrationCard` in `components/BentoGrid.tsx`.
- **IMPLEMENT**:
    -   Add `goal?: number` to props.
    -   Update height calculation to `Math.min((liters / (goal || 2.5)) * 100, 100)`.
    -   Update `2.5L` text label if necessary (it currently says `L` statically, maybe shows goal? No, it just shows current liters. The hardcoded 2.5 was only in calculation).
- **VALIDATE**: `npx tsc --noEmit` (will fail until Task 2 is done if prop is required, so make optional or do strictly). Let's make it required for correctness, but we can default in destructuring if we want to be safe. Better to make it required in Typescript to force update.

### Task 2: Update `TrackToday` Implementation

- **ACTION**: Modify `TrackToday` in `components/TrackToday.tsx`.
- **IMPLEMENT**:
    -   Calculate `goalLiter = stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5`.
    -   Pass `goal={goalLiter}` to `HydrationCard`.
- **VALIDATE**: `npx tsc --noEmit`.

---

## Testing Strategy

### Validation Checks

| Check                                    | Method                     | Success Criteria |
| ---------------------------------------- | -------------------------- | ---------------- |
| **Visual Accuracy**                      | Manual (Browser)           | Widget fill % matches `current / goal`. |
| **Code Compilation**                     | Static Analysis            | `npx tsc --noEmit` passes. |

### Edge Cases Checklist

- [ ] `dailyWaterGoal` is undefined/null (should fallback to 2.5).
- [ ] `dailyWaterGoal` is 0 (should avoid division by zero).

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
npx tsc --noEmit
```

### Level 3: BROWSER_VALIDATION
1.  Open App.
2.  Go to Profile/Settings (if available) or assume default stats.
3.  Manually change `dailyWaterGoal` in `App.tsx` state or `storageService` (or just verify logic).
4.  Observe Hydration Widget fill level.
