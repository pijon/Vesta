# Feature: Weight Trend Time Range Toggle

## Summary

Add a segmented toggle control to the Weight Trend chart in the Analytics page, allowing users to switch between "Last 7 Days" and "Last 30 Days" views. This provides better context for weight trends over different time periods.

## User Story

As a **Vesta user tracking my weight**
I want to **toggle between last 7 days and last 30 days** when viewing my weight trend
So that **I can see both short-term fluctuations and longer-term progress**

## Problem Statement

Currently, the weight trend chart in `TrackAnalytics.tsx` is hardcoded to show only the last 7 days (lines 61-67). Users cannot see their month-long progress without manually tracking dates.

## Solution Statement

Add a local state toggle to `TrackAnalytics.tsx` that switches between 7-day and 30-day filters, displayed as a pill-style segmented control above the chart. This matches existing UI patterns in the codebase.

## Metadata

| Field            | Value                    |
| ---------------- | ------------------------ |
| Type             | ENHANCEMENT              |
| Complexity       | LOW                      |
| Systems Affected | TrackAnalytics           |
| Dependencies     | None                     |
| Estimated Tasks  | 2                        |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════╗
║  Your Progress                                                ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Weight Trend                                                 ║
║  ┌──────────────────────────────────────────────────────────┐ ║
║  │                                                          │ ║
║  │    [Last 7 days only - no time range option]            │ ║
║  │                                                          │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  PAIN_POINT: User cannot see 30-day trend without scrolling  ║
║              back through old weight entries manually.        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════╗
║  Your Progress                                                ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Weight Trend                                                 ║
║             ┌──────────────────────────┐                      ║
║             │ [ 7 Days ] [ 30 Days ◄ ] │  ← New toggle        ║
║             └──────────────────────────┘                      ║
║  ┌──────────────────────────────────────────────────────────┐ ║
║  │                                                          │ ║
║  │    [Chart responds to selected time range]               │ ║
║  │                                                          │ ║
║  └──────────────────────────────────────────────────────────┘ ║
║                                                               ║
║  VALUE_ADD: Users can toggle between short-term and          ║
║             month-long progress view instantly.               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `TrackAnalytics.tsx` - Weight Trend | Fixed 7-day view | Toggle for 7/30 days | Can see longer trends |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `.agent/knowledge/design_system.md` | all | **MANDATORY** - Digital Hearth colors, button styles |
| P1 | `components/TrackAnalytics.tsx` | 60-170 | Current weight chart implementation |
| P1 | `components/RecipeDetailModal.tsx` | 16-35 | TabButton pattern to mirror for pills |

---

## Patterns to Mirror

**TAB/PILL TOGGLE PATTERN:**
```tsx
// SOURCE: components/RecipeDetailModal.tsx:22-35
// ADAPT for horizontal pill toggle:

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-6 py-4 text-sm font-bold transition-all border-b-2 relative ${active
            ? 'border-hearth text-hearth'
            : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
    >
        {children}
    </button>
);
```

**PILL BUTTON STYLING (adapted for this feature):**
```tsx
// Use rounded-full pill style with bg instead of underline
// Active: bg-hearth text-white
// Inactive: bg-transparent text-charcoal/60 hover:bg-charcoal/5
```

---

## Files to Change

| File                             | Action | Justification                            |
| -------------------------------- | ------ | ---------------------------------------- |
| `components/TrackAnalytics.tsx`  | UPDATE | Add state, toggle UI, filter logic       |

---

## NOT Building (Scope Limits)

Explicit exclusions to prevent scope creep:

- **NOT** adding time range to other charts (calories, workouts) - can be done later
- **NOT** persisting the time range preference to localStorage - ephemeral state is fine
- **NOT** adding custom date ranges - only 7 and 30 days

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: ADD State and Toggle UI

- **ACTION**: UPDATE `components/TrackAnalytics.tsx`
- **IMPLEMENT**:
  1. Add `weightTimeRange` state: `useState<'7d' | '30d'>('7d')`
  2. Add segmented pill toggle between the `<h4>` heading and the chart
  3. Style pills using design system colors (hearth active, charcoal inactive)
- **MIRROR**: `components/RecipeDetailModal.tsx:22-35` for button logic pattern
- **STYLING REQUIREMENTS**:
  - Container: `inline-flex rounded-full bg-charcoal/5 dark:bg-white/5 p-1`
  - Active pill: `bg-hearth text-white rounded-full px-4 py-1.5 text-sm font-medium`
  - Inactive pill: `text-charcoal/60 dark:text-stone-400 px-4 py-1.5 text-sm hover:text-charcoal dark:hover:text-stone-200`
- **VALIDATE**: `npm run dev` → Toggle appears and switches visually

### Task 2: UPDATE Chart Filter Logic

- **ACTION**: UPDATE filter logic in `components/TrackAnalytics.tsx`
- **IMPLEMENT**:
  1. Replace hardcoded `sevenDaysAgo` with dynamic calculation based on `weightTimeRange`
  2. If `weightTimeRange === '30d'`, use 30-day window; else 7-day window
- **CURRENT CODE** (lines 61-67):
  ```tsx
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weightChartData = allWeightData
      .filter(entry => new Date(entry.date) >= sevenDaysAgo)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  ```
- **NEW CODE**:
  ```tsx
  const daysToShow = weightTimeRange === '30d' ? 30 : 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToShow);

  const weightChartData = allWeightData
      .filter(entry => new Date(entry.date) >= cutoffDate)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  ```
- **VALIDATE**: `npm run dev` → Switching toggle changes chart data range

---

## Testing Strategy

### Validation Checks

| Check                                    | Method                     | Success Criteria |
| ---------------------------------------- | -------------------------- | ---------------- |
| **Design System Compliance**             | Manual Review              | Hearth orange active state, charcoal/60 inactive, dark mode variants |
| **Visual Polish**                        | Browser (Manual)           | Pills are rounded-full, warm colors, consistent with Vesta aesthetic |
| **Toggle Functionality**                 | Browser (Interact)         | Clicking toggles between 7d/30d and chart updates |
| **Mobile Responsiveness**                | Browser (Resize)           | Toggle fits on mobile, no overflow |
| **No Console Errors**                    | Browser Console            | Clean console log |

### Edge Cases Checklist

- [x] Empty weight data (existing empty state handles this)
- [x] Only 1-2 data points (chart still renders)
- [x] More data in 30d than 7d (correctly shows more points)
- [x] Dark mode styling works correctly

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
npx tsc --noEmit
```

**EXPECT**: Exit 0, no errors

### Level 2: BUILD_CHECK

```bash
npm run build
```

**EXPECT**: Build completes successfully

### Level 3: BROWSER_VALIDATION

Use Browser tool to verify:

1. Navigate to Analytics page (`/analytics` or `/track` tab)
2. Scroll to "Your Progress" section
3. Verify toggle appears with "7 Days" and "30 Days" options
4. Click each option and verify chart updates
5. Check dark mode - toggle should have correct colors

### Level 4: MANUAL_VALIDATION

**User steps to test:**

1. Open app in browser at `http://localhost:5173`
2. Navigate to "Track" tab → "Your Progress" section
3. Look for pill toggle above "Weight Trend" chart
4. **Test 7 Days**: Should show ~7 data points (if logged)
5. **Test 30 Days**: Should show more data points spanning a month
6. **Dark mode test**: Toggle dark mode and verify pill colors remain visible

---

## Acceptance Criteria

- [x] Toggle control appears above weight trend chart
- [x] Two options: "7 Days" (default) and "30 Days"
- [x] Active state uses Hearth Orange background with white text
- [x] Inactive state uses charcoal/60 text on transparent background
- [x] Chart data updates when toggle is clicked
- [x] Works in both light and dark mode
- [x] Level 1 & 2 validation commands pass with exit 0

---

## Completion Checklist

- [ ] Task 1 completed: State and UI toggle added
- [ ] Task 2 completed: Filter logic uses toggle state
- [ ] Level 1: `npx tsc --noEmit` passes
- [ ] Level 2: `npm run build` succeeds
- [ ] Level 3/4: Browser/Manual validation passes
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | --------------------------------------- |
| Missing dark mode styling | LOW | MEDIUM | Use design system tokens consistently |
| Chart renders poorly with many points | LOW | LOW | Recharts handles this; XAxis already has minTickGap |

---

## Notes

- This is a low-complexity enhancement that follows existing patterns
- Future enhancement could add this toggle to other charts (calories, workouts)
- Could also persist preference to localStorage in future iteration
