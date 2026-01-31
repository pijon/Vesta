# Feature: Smart Goal Projection & Visualization

## Summary
We are upgrading the current "Goal Projection" feature from a simple "first/last" point calculation to a robust "Smart Projection" system. This enhancement introduces a Least Squares Regression (line of best fit) algorithm to smooth out daily weight fluctuations, providing a more accurate notification of progress. Additionally, we are introducing a new **WeightProjectionChart** that visually plots the user's historical weight against their projected path, creating a powerful "Digital Hearth" visual that encourages consistency.

## User Story
As a health-conscious user
I want to see a visual projection of when I will reach my weight goal based on my recent trends
So that I can feel motivated by my progress and understand if my current habits are effective.

## Problem Statement
The current projection logic uses only the first and last data points of the last 14 days. This is highly sensitive to daily fluctuations (water retention, heavy meals), leading to erratic "Days to Goal" estimates. Furthermore, the feedback is text-only; users cannot visually see "where they are heading," which reduces emotional engagement.

## Solution Statement
We will implement a `calculateTrendline` utility using the Least Squares Regression method on the last 14-30 days of data. We will then build a new `WeightProjectionChart` (Recharts) that displays:
1.  **History**: Actual weight readings (dots/line).
2.  **Projection**: A dashed line extending from the current date to the goal weight.
3.  **Goal**: A reference line for the target weight.

The existing `GoalProjectionCard` will be redesigned to host this chart while maintaining the "Digital Hearth" aesthetic.

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | MEDIUM                                            |
| Systems Affected | `analyticsService`, `GoalProjectionCard`, New Chart |
| Dependencies     | `recharts` (already installed)                    |
| Estimated Tasks  | 5                                                 |

---

## UX Design

### Before State
```
┌──────────────────────────────────────┐
│  Goal Projection                     │
│  "On track to reach goal!"           │
│                                      │
│  [ Total Lost: 5kg ]  [ Days: 45 ]   │
│                                      │
│  [ Progress Bar ............ ]       │
└──────────────────────────────────────┘
```
*Simple text feedback. No visual context of the "Curve".*

### After State
```
┌──────────────────────────────────────┐
│  Journey Projection                  │
│  "Dec 15th (42 Days)"                │
│                                      │
│      |      .  *   (Projection)      │
│   W  |   . * '      . - - - - - [Goal]
│   e  | .* '                          │
│   i  |*                              │
│   g  |                               │
│      └────────────────────────────   │
│         History       Future         │
│                                      │
│  [ Current Rate: -0.5kg/week ]       │
└──────────────────────────────────────┘
```
*Rich visual graph showing the trajectory. Motivational "Rate" context.*

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `GoalProjectionCard` | Text & Simple Numbers | Interactive Chart + Smart Stats | Users can visually see their "momentum" and path. |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `.agent/knowledge/design_system.md` | all | **MANDATORY** - Card styling, colors (`hearth`, `ocean`), and motion rules. |
| P0 | `components/analytics/GoalsHistoryChart.tsx` | all | Reference for Recharts styling in this codebase (gradients, tooltips). |
| P0 | `services/analyticsService.ts` | 68-100 | Existing projection logic to be replaced. |

---

## Patterns to Mirror

**CHART_STYLING (Recharts):**
```tsx
// SOURCE: components/analytics/GoalsHistoryChart.tsx
// COPY THIS PATTERN:
<ResponsiveContainer width="100%" height="100%">
    <AreaChart ...>
       <defs>
          <linearGradient id="colorCalories" ...>
       </defs>
       <Tooltip contentStyle={{ ...designSystemTokens }} />
    </AreaChart>
</ResponsiveContainer>
```

**MATH_HELPER:**
```typescript
// SOURCE: utils/analytics.ts (standard pattern)
export const calculateTrend = (data: Point[]): Line => { ... }
```

---

## Files to Change

| File | Action | Justification |
| --- | --- | --- |
| `utils/analytics.ts` | UPDATE | Add `leastSquaresRegression` helper function. |
| `services/analyticsService.ts` | UPDATE | Refactor `getGoalProjection` to use the new regression utility. |
| `components/analytics/WeightProjectionChart.tsx` | CREATE | New component for the visualization. |
| `components/analytics/GoalProjectionCard.tsx` | UPDATE | Embed the new chart and update stats display. |

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: IMPLEMENT Regression Logic

- **ACTION**: UPDATE `utils/analytics.ts`
- **IMPLEMENT**: Add `calculateRegressionLine(data: {date: string, value: number}[])` function.
- **LOGIC**: Use simple Least Squares method (x = timestamp, y = weight).
- **VALIDATE**: `npx tsc --noEmit`

### Task 2: UPDATE Service Logic

- **ACTION**: UPDATE `services/analyticsService.ts`
- **IMPLEMENT**: Update `getGoalProjection` to use `calculateRegressionLine`.
- **CHANGE**: Return `ratePerWeek`, `projectedDate`, and `confidence` (optional).
- **VALIDATE**: Manual check of logic export.

### Task 3: CREATE WeightProjectionChart Component

- **ACTION**: CREATE `components/analytics/WeightProjectionChart.tsx`
- **IMPLEMENT**: Recharts `ComposedChart` (Line for history, Dashed Line for projection).
- **SYTLE**: Use `var(--primary)` for history, `var(--primary)/50` for projection.
- **MIRROR**: `GoalsHistoryChart.tsx` for tooltip and grid styling.
- **VALIDATE**: Check component imports.

### Task 4: INTEGRATE into GoalProjectionCard

- **ACTION**: UPDATE `components/analytics/GoalProjectionCard.tsx`
- **IMPLEMENT**: layout changes to accommodate the chart (increase height/make responsive).
- **ADD**: "Rate of Loss" text (e.g., "Losing 0.5kg / week").
- **VALIDATE**: `npm run dev` -> visual check.

### Task 5: VERIFY & POLISH

- **ACTION**: MANAL VERIFICATION
- **CHECK**: Does the projection line align visually with the history line?
- **CHECK**: Dark mode contrast.
- **CHECK**: Empty state (what if user has < 2 logs?).

---

## Testing Strategy

### Validation Checks

| Check | Method | Success Criteria |
| --- | --- | --- |
| **Math Accuracy** | Manual Calc | Projection makes sense (e.g., if strictly losing 1kg/week, projection matches). |
| **Visual Continuity** | Browser | The dotted projection line should "connect" smoothly to the solid history line. |
| **Responsiveness** | Browser | Chart scales down on mobile without clipping. |

---

## Acceptance Criteria

- [ ] `getGoalProjection` uses linear regression (not just first/last).
- [ ] New `WeightProjectionChart` visualizes history + future.
- [ ] Card shows "Rate per week" metric.
- [ ] Design matches "Digital Hearth" (soft UI, correct colors).
