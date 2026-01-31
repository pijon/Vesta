# Feature: Recipe Quick View in Planner

## Summary

Enable users to view full recipe details (ingredients, instructions) directly from the Meal Planner by clicking on a meal card. This will reuse the existing `RecipeDetailModal` component.

## User Story

As a user
I want to click on a meal in my daily planner
So that I can quickly check ingredients or instructions without navigating to the Recipe Library/Search

## Problem Statement

Currently, meals in the planner show name/calories/tags but are not interactive. To see the details, the user has to navigate away to the Recipes tab and search for the meal again, which is friction-heavy.

## Solution Statement

-   Update `Planner.tsx` to make the meal list items clickable.
-   Wire the click event to set the `selectedRecipe` state, which already triggers the `RecipeDetailModal`.
-   Ensure existing action buttons (Cook, Delete, Toggle Packed) do not trigger the modal (stop propagation).

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | LOW                                               |
| Systems Affected | `Planner.tsx`                                     |
| Dependencies     | `RecipeDetailModal` (already imported)            |
| Estimated Tasks  | 1                                                 |

---

## UX Design

### Interaction Changes
| Location        | Before          | After       | User Impact        |
| --------------- | --------------- | ----------- | ------------------ |
| `Planner.tsx`   | Meal card is static | Meal card is clickable | Opens Recipe Detail Modal |
| `Planner.tsx` (Cook/Delete Buttons) | Click triggers action | Click triggers action AND stops propagation | Prevents modal from opening when clicking specific actions |

---

## Mandatory Reading

| Priority | File | Why Read This |
|----------|------|---------------|
| P0 | `components/Planner.tsx` | Main logic to modify |
| P1 | `components/RecipeDetailModal.tsx` | To understand props (view-only mode?) |

---

## Patterns to Mirror

**EVENT_PROPAGATION:**
```tsx
// SOURCE: components/Planner.tsx (existing pack toggle)
onClick={(e) => { e.stopPropagation(); togglePacked(index); }}
```

**MODAL_TRIGGER:**
```tsx
// PATTERN:
<div onClick={() => setSelectedRecipe(meal)} ...>
```

---

## Files to Change

| File                             | Action | Justification                            |
| -------------------------------- | ------ | ---------------------------------------- |
| `components/Planner.tsx`         | UPDATE | Add onClick to meal cards, add e.stopPropagation to buttons |

---

## Step-by-Step Tasks

### Task 1: Wire up Click Handler in `Planner.tsx`

-   **ACTION**: Modify the meal card rendering loop.
-   **IMPLEMENT**:
    -   Add `cursor-pointer` to the meal container `div`.
    -   Add `onClick={() => setSelectedRecipe(meal)}` to the meal container `div`.
    -   Update "Start Cooking Mode" button: Add `e.stopPropagation()`.
    -   Update "Delete/Remove" button: Add `e.stopPropagation()`.
    -   (Verify "Top-Right Packed Toggle" already has `stopPropagation`).
-   **VALIDATE**:
    -   `npm run build`
    -   Manual verification: Click card opens modal. Click delete deletes (and doesn't open modal).

---

## Testing Strategy

### Validation Checks

| Check                                    | Method                     | Success Criteria |
| ---------------------------------------- | -------------------------- | ---------------- |
| **Open Modal**                           | Manual (Browser)           | Clicking anywhere on the meal card (except buttons) opens the modal. |
| **Button Isolation**                     | Manual (Browser)           | Clicking "Cook" or "Delete" performs the action causing the modal to appear. |
| **Modal Content**                        | Manual (Browser)           | Modal shows correct recipe details (ingredients/instructions). |

---

## Acceptance Criteria

- [ ] Meal cards in Planner are clickable and show `cursor-pointer` on hover.
- [ ] Clicking a meal opens the `RecipeDetailModal`.
- [ ] Clicking "Cook", "Delete", or "Toggle Packed" does NOT open the detail modal.
- [ ] No visual regressions in Planner layout.

---
