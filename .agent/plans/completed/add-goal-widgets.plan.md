# Feature: Goal Progress Widgets

## Summary

Add two new widgets to the Bento Grid to provide actionable insights into weight loss progress:
1.  **Remaining Widget**: Shows weight left to lose (Current - Goal).
2.  **Projection Widget**: Shows estimated days or date to reach the goal.

## User Story

As a user
I want to see how much weight I have left to lose and when I might reach my goal
So that I stay motivated and can track my long-term progress visually

## Problem Statement

Currently, the dashboard shows current weight and weekly change, but doesn't explicitly show the "Gap" to the goal or the time horizon. Users have to calculate this mentally.

## Solution Statement

We will add two new React components to `components/BentoGrid.tsx` and integrate them into `components/TrackToday.tsx`:

1.  `RemainingWeightCard`:
    -   Displays `currentWeight - goalWeight`.
    -   Visual: Simple stat card with a progress ring or bar.
2.  `GoalProjectionCard`:
    -   Displays `daysToGoal` (from `analyzeWeightTrends`).
    -   Visual: Calendar icon or countdown style.

We will use the existing `analyzeWeightTrends` utility which already calculates `daysToGoal` and `remainingLoss`.

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | NEW_FEATURE                                       |
| Complexity       | LOW                                               |
| Systems Affected | `components/BentoGrid.tsx`, `components/TrackToday.tsx` |
| Dependencies     | `utils/analytics.ts`                              |
| Estimated Tasks  | 3                                                 |

---

## UX Design

### Visuals
-   **Remaining**: Large number for kg left. Subtext "to goal".
-   **Projection**: Large number for Days or Date. Subtext "estimated".
-   **Style**: Glassmorphism, consistent with existing cards.

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `utils/analytics.ts` | 95-194 | Logic for `analyzeWeightTrends` |
| P0 | `components/BentoGrid.tsx` | all | Widget patterns |

---

## Files to Change

| File                             | Action | Justification                            |
| -------------------------------- | ------ | ---------------------------------------- |
| `components/BentoGrid.tsx`       | UPDATE | Add new card components                  |
| `components/TrackToday.tsx`      | UPDATE | Instantiate new widgets in the grid      |

---

## Step-by-Step Tasks

### Task 1: Create New Widget Components

- **ACTION**: Add `RemainingWeightCard` and `GoalProjectionCard` to `components/BentoGrid.tsx`.
- **IMPLEMENT**:
    -   `RemainingWeightCard`: Props `{ remaining: number; totalLoss: number; startWeight: number; currentWeight: number }`.
    -   `GoalProjectionCard`: Props `{ days: number | null; date: string | null }`.
    -   Use `absolute inset-0` centering pattern established in previous tasks.
- **VALIDATE**: `npx tsc --noEmit`.

### Task 2: Integrate into TrackToday

- **ACTION**: Modify `components/TrackToday.tsx`.
- **IMPLEMENT**:
    -   Call `analyzeWeightTrends(stats)` to get data.
    -   Add the new cards to the Bento Grid layout.
    -   *Layout Adjustment*: The grid might need resizing or reordering to fit 2 new small cards. Maybe perform a swap or add a new row.
    -   *Proposal*: Add them as smaller 2-col span cards or a new row of 1x1 cards.
- **VALIDATE**: `npx tsc --noEmit`.

---

## Testing Strategy

### Validation Checks

| Check                                    | Method                     | Success Criteria |
| ---------------------------------------- | -------------------------- | ---------------- |
| **Visual Integration**                   | Manual                     | Widgets appear correctly on dashboard. |
| **Data Accuracy**                        | Manual                     | Numbers match `analytics.ts` output. |

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
npx tsc --noEmit
```
