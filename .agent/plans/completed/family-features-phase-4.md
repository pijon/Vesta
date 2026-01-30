# Implementation Plan - Phase 4: Shared Grocery List

**Goal**: Enable the Shopping List to include ingredients from family/partner meals.
**Source PRD**: `.agent/prds/family-features.prd.md`
**Strategy**: Input Merging.
- We will update `ShoppingList.tsx` to fetch meals from **all family members** using `getFamilyPlansInRange`.
- This means when I generate a shopping list, it will include ingredients for my partner's meals too.
- *Note*: The "Checked" state of items will remain local to the current user for V1 (no real-time sync of checks yet), but the *content* will be comprehensive.

## Mandatory Reading

- [x] `components/ShoppingList.tsx`
- [x] `services/storageService.ts`

## Proposed Changes

### 1. Update `ShoppingList.tsx`
- **Import**: `getFamilyPlansInRange` from `storageService`.
- **Logic**: Replace `getUpcomingPlan(14)` with `getFamilyPlansInRange(today, today + 14)`.
    - *Detail*: `getUpcomingPlan` might have default logic we need to replicate (like start date). `getFamilyPlansInRange` requires explicit start/end dates.

## Step-by-Step Tasks

### Task 1: UPDATE `ShoppingList.tsx`
- Replace import.
- In `initializeShoppingList`:
    - Calculate `today` (YYYY-MM-DD).
    - Calculate `endDate` (today + 14 days).
    - Call `getFamilyPlansInRange(today, endDate)`.

## Validation Checkpoints

### 1. Manual Verification
1.  **Setup**: User A has meals. User B (partner) has meals.
2.  **Action**: User A goes to Shopping List.
3.  **Expectation**: User A sees User B's meals in the "Selection" phase.
4.  **Generation**: User A selects all -> Generate.
5.  **Result**: Shopping list includes ingredients from User B's meals.

---

## Verification Plan

### Manual Verification
- Verify the "Selection" screen shows meals from both users.
- Verify the generated list includes appropriate ingredients.
