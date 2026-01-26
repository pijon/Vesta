# Feature: Align Component Widgets

## Summary

The Activity, Fasting, and Weight widgets in the Bento Grid currently have their main metrics aligned to the left or top-left. The goal is to center these important numbers within the widget, similar to the Hydration widget, to improve visual hierarchy and aesthetics.

## User Story

As a user
I want the key numbers in my dashboard widgets to be centered
So that the dashboard looks balanced and the important information is the focal point

## Problem Statement

Current widget layouts:
-   **ActivityCard**: Metric is left-aligned.
-   **FastingCard**: Metric is left-aligned.
-   **WeightCard**: Metric is left-aligned.

## Solution Statement

We will update the CSS classes in `components/BentoGrid.tsx` for each card:
1.  **ActivityCard**: Wrap metrics in a flex container that centers content vertically and horizontally.
2.  **FastingCard**: Add `items-center` and `text-center` to the existing flex container.
3.  **WeightCard**: Add flex column structure and center the weight display container.

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | LOW                                               |
| Systems Affected | `components/BentoGrid.tsx`                        |
| Dependencies     | TailwindCSS                                       |
| Estimated Tasks  | 3                                                 |

---

## UX Design

### Before State
-   Numbers stuck to the left side of the cards.

### After State
-   Numbers floating in the center of the cards (vertically and horizontally where appropriate), with headers staying at the top.

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `components/BentoGrid.tsx` | all | Target file |

---

## Files to Change

| File                             | Action | Justification                            |
| -------------------------------- | ------ | ---------------------------------------- |
| `components/BentoGrid.tsx`       | UPDATE | Align content center                     |

---

## Step-by-Step Tasks

### Task 1: Center ActivityCard Content

- **ACTION**: Modify `ActivityCard` in `components/BentoGrid.tsx`.
- **IMPLEMENT**:
    -   Wrap lines 30-31 (metrics) in a `div` with `className="flex-1 flex flex-col items-center justify-center text-center"`.
- **VALIDATE**: `npx tsc --noEmit` and visual verification.

### Task 2: Center FastingCard Content

- **ACTION**: Modify `FastingCard` in `components/BentoGrid.tsx`.
- **IMPLEMENT**:
    -   Add `items-center text-center` to the `div` at line 53.
- **VALIDATE**: `npx tsc --noEmit` and visual verification.

### Task 3: Center WeightCard Content

- **ACTION**: Modify `WeightCard` in `components/BentoGrid.tsx`.
- **IMPLEMENT**:
    -   Add `flex flex-col` to main container (line 153).
    -   Update the div wrapping the weight text (lines 161-163) to `className="relative z-10 flex-1 flex flex-col items-center justify-center text-center"`.
- **VALIDATE**: `npx tsc --noEmit` and visual verification.

---

## Testing Strategy

### Validation Checks

| Check                                    | Method                     | Success Criteria |
| ---------------------------------------- | -------------------------- | ---------------- |
| **Visual Alignment**                     | Manual (Browser)           | Content is centered. |
| **Code Compilation**                     | Static Analysis            | `npx tsc --noEmit` passes. |

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
npx tsc --noEmit
```
