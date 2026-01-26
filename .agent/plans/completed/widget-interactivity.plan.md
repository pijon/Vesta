# Feature: Bento Widget Interactivity

## Summary

Enable direct interactivity on the Bento Grid widgets:
1.  **Activity Widget**: Click (+) to open Workout Modal.
2.  **Weight Widget**: Click (+) to open Weight Modal.

## User Story

As a user
I want to log workouts and weight directly from the dashboard widgets
So that I don't have to look for the floating action button or mobile bar, making logging faster.

## Solution Statement

We will update `BentoGrid.tsx` components to accept `onAdd` handlers and add a visual trigger (a small plus button or making the whole card interactive).

1.  **ActivityCard**: Add `onAddWorkout` prop. Add a (+) button in the top right.
2.  **WeightCard**: Add `onAddWeight` prop. Add a (+) button in the top right.
3.  **TrackToday**: Pass `onOpenWorkoutModal` and `onOpenWeightModal` to these cards.

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | LOW                                               |
| Systems Affected | `components/BentoGrid.tsx`, `components/TrackToday.tsx` |
| Estimated Tasks  | 2                                                 |

---

## Files to Change

| File                             | Action | Justification                            |
| -------------------------------- | ------ | ---------------------------------------- |
| `components/BentoGrid.tsx`       | UPDATE | Add callback props and UI buttons        |
| `components/TrackToday.tsx`      | UPDATE | Pass handlers to the card components     |

---

## Step-by-Step Tasks

### Task 1: Update Bento Grid Components

- **ACTION**: Update `ActivityCard` and `WeightCard` interfaces.
- **implement**:
    -   `ActivityCard`: Add `onAddWorkout: () => void`. Add a small 'plus' button in the header (next to the title?), similar to the Hydration card.
    -   `WeightCard`: Add `onAddWeight: () => void`. Add a small 'plus' button in the header.
    -   *Styling*: Use `bg-white/50 dark:bg-black/10 p-1.5 rounded-full hover:bg-white` pattern from HydrationCard.

### Task 2: Integrate in TrackToday

- **ACTION**: Pass handlers in `TrackToday.tsx`.
- **IMPLEMENT**:
    -   Pass `() => onOpenWorkoutModal()` to `ActivityCard`.
    -   Pass `onOpenWeightModal` to `WeightCard`.

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
npx tsc --noEmit
```
