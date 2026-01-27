# Feature: Desktop Food Logging via Split Widgets

## Summary

Enable users to log food on desktop by adding the `CaloriesRemainingCard` to the dashboard, sharing space with the `FastingCard`. We will modify the top-right slot of the desktop grid to contain **two half-width widgets** side-by-side: `CaloriesRemainingCard` (for logging) and `FastingCard` (for status). This requires making `FastingCard` responsive with a `size="sm"` prop.

## User Story

As a Desktop User
I want to be able to log my meals from the dashboard
So that I can track my calories without losing visibility of my fasting timer

## Problem Statement

-   Desktop currently shows a full-width `FastingCard` in the top-right slot.
-   There is no "Log Food" button on desktop (the `CaloriesRemainingCard` is hidden).
-   User wants **both** the fasting info and the ability to log food in that same visual area.

## Solution Statement

1.  **Update `FastingCard`**: Add a `size` prop ('sm' | 'md'). In 'sm' mode, use smaller fonts and padding to fit in a half-width container.
2.  **Update `TrackToday`**: Split the top-right grid cell (Row 1, Col 2) into a 2-column nested grid. Place `CaloriesRemainingCard` (size="sm") and `FastingCard` (size="sm") side-by-side.

## Metadata

| Field | Value |
| -- | -- |
| Type | ENHANCEMENT |
| Complexity | LOW |
| Systems Affected | `components/BentoGrid.tsx`, `components/TrackToday.tsx` |
| Dependencies | None |
| Estimated Tasks | 2 |

---

## UX Design

### Before State

```
┌────────────────────────────────────────┐
│  Desktop Grid (Right Side)             │
│  ┌──────────────────┐  ┌─────────────┐ │
│  │                  │  │ FastingCard │ │
│  │ ActivityCard     │  │ (Full Width)│ │
│  │                  │  │             │ │
│  └──────────────────┘  └─────────────┘ │
│  ┌──────────────────┐  ┌─────────────┐ │
│  │ HydrationCard    │  │ WeightCard  │ │
│  └──────────────────┘  └─────────────┘ │
└────────────────────────────────────────┘
```

### After State

```
┌────────────────────────────────────────┐
│  Desktop Grid (Right Side)             │
│  ┌──────────────────┐  ┌──────┬──────┐ │
│  │                  │  │ Cal  │ Fast │ │
│  │ ActivityCard     │  │ Card │ Card │ │
│  │                  │  │ (1/2)| (1/2)| │
│  └──────────────────┘  └──────┴──────┘ │
│  ┌──────────────────┐  ┌─────────────┐ │
│  │ HydrationCard    │  │ WeightCard  │ │
│  └──────────────────┘  └─────────────┘ │
└────────────────────────────────────────┘
```

**Interaction**:
-   **Cal Card**: Click "+" or card to Log Food.
-   **Fast Card**: Read-only status (consistent with existing behavior).

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
| -- | -- | -- | -- |
| P1 | `components/BentoGrid.tsx` | 53-71 | `FastingCard` implementation |
| P2 | `components/TrackToday.tsx` | 275-322 | Grid layout structure |

---

## Patterns to Mirror

**COMPACT_CARD_PATTERN:**

```tsx
// SOURCE: components/BentoGrid.tsx
export const Widget: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => {
  return (
    <div className={`glass-card ... ${size === 'sm' ? 'min-h-[160px]' : 'h-56'}`}>
       <p className={size === 'sm' ? 'text-2xl' : 'text-3xl'}>Value</p>
    </div>
  )
}
```

---

## Files to Change

| File | Action | Justification |
| -- | -- | -- |
| `components/BentoGrid.tsx` | UPDATE | Add `size` prop to `FastingCard` and style for compact mode. |
| `components/TrackToday.tsx` | UPDATE | Split top-right grid cell and insert both widgets. |

---

## Step-by-Step Tasks

### Task 1: UPDATE `components/BentoGrid.tsx` (`FastingCard`)

-   **ACTION**: Add `size` prop support
-   **IMPLEMENT**:
    -   Add `size?: 'sm' | 'md'` to props (default 'md').
    -   Update classes:
        -   Container height: `size === 'sm' ? 'min-h-[160px]' : 'h-56'`
        -   Font sizes: `text-2xl` for sm, `text-4xl` for md.
-   **VALIDATE**: `npx tsc --noEmit`

### Task 2: UPDATE `components/TrackToday.tsx`

-   **ACTION**: Split Grid Slot
-   **IMPLEMENT**:
    -   In the desktop grid, locate the `FastingCard`.
    -   Wrap it in a `div className="grid grid-cols-2 gap-4"`.
    -   First child: `<CaloriesRemainingCard size="sm" ... />` (Interactive).
    -   Second child: `<FastingCard size="sm" ... />`.
-   **VALIDATE**: `npm run dev` - Verify layout is balanced and both cards render correctly on desktop.

---

## Testing Strategy

### Validation Checks

| Check | Method | Success Criteria |
| -- | -- | -- |
| **Split Layout** | Manual | Top-right area shows two equal-width cards |
| **Card Data** | Manual | Calories card shows correct remaining; Fasting card shows correct timer |
| **Interactivity** | Manual | "Log Food" button works on the small Calories card |
| **Mobile Check** | Manual | Mobile view remains unchanged |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| -- | -- | -- | -- |
| Text Overflow | MED | LOW | Use `truncate` or smaller fonts in `sm` mode to ensure fit |
