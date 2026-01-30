# Implementation Plan - Phase 3: Planner UI (Union View)

**Goal**: Update the Planner UI to display a "Union View" of family meals.
**Source PRD**: `.agent/prds/family-features.prd.md`
**Phase**: 3

---

## Mandatory Reading

- [x] `components/Planner.tsx` (Current inline implementation)
- [x] `services/storageService.ts` (New `getFamilyPlansInRange`)

## Proposed Changes

### 1. Refactor `MealCard`
Currently, the meal card UI is hardcoded inside `Planner.tsx` (lines 398-482). We typically would extract this, but to minimize regression risk in a "Fast" mode, we will **Keep it inline for now** but modify it to handle the `isShared` property.

**Visual Changes**:
- **Border**: If `meal.isShared` is true, use a distinct border color (e.g., `border-blue-200` or a specific "Partner" color).
- **Avatar/Label**: Add a small Pill indicating "Partner's Meal" (or their name).
- **Actions**: If `meal.isShared` is true, **HIDE** the Delete and Edit buttons. (Read-Only).

### 2. Update `Planner.tsx` Data Fetching
- **Replace** `getUpcomingPlan(7)` with `getFamilyPlansInRange(today, today+7)`.
- **Replace** `getDayPlan(date)` with a logic that utilizes the family fetch (or update `getDayPlan` to also be family aware? No, `getDayPlan` is single user. We should probably use the range fetcher for the selected day too to get the merged view).
    - *Decision*: We will switch `Planner` to primarily use `getFamilyPlansInRange` for both the week view AND the day view.

## Step-by-Step Tasks

### Task 1: UPDATE `Planner.tsx` Logic
- Import `getFamilyPlansInRange`.
- Update `useEffect` to call `getFamilyPlansInRange` for the week.
- Update the "Refresh" logic when a meal is added/removed to reload the family range.

### Task 2: UPDATE `Planner.tsx` UI (Meal Rendering)
- In the `.map((meal, index) => ...)` loop:
    - Check `meal.isShared` (boolean).
    - Check `meal.ownerName`.
- **Conditional Rendering**:
    - If `isShared`:
        - Background: slightly different shade?
        - Actions: Hide "Remove", "Toggle Packed". Keep "Cooking Mode"? (Yes, I can cook my partner's meal).
        - Add "Owner Pill": Small badge showing `ownerName` (e.g. "Jon's Meal").

---

## Validation Checkpoints

### 1. Manual Verification
1.  **Shared View**: Log in as User A. See User A's meals.
2.  **Partner View**: User B (in same group) adds a meal.
3.  **Union View**: User A refreshes. Should see User B's meal with "User B" badge.
4.  **Security**: Try to delete User B's meal (button should be missing).

---

## Verification Plan

### Manual Verification
- We will assume a "Happy Path" verification where we mock the data if we can't easily switch users in dev.
- *Or* we rely on the `isShared` flag being correctly set by the service we tested in Phase 2.
