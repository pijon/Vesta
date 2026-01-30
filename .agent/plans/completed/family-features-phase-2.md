# Implementation Plan - Phase 2: Planner Logic

**Goal**: Implement data fetching logic to retrieve and merge Meal Plans from all family members.
**Source PRD**: `.agent/prds/family-features.prd.md`
**Phase**: 2

---

## Mandatory Reading

- [x] `services/storageService.ts` (Core logic)
- [x] `services/groupService.ts` (Reference for multi-user fetching)

## Proposed Changes

### 1. Update `services/storageService.ts`
**New Function**: `getFamilyPlansInRange(startDate, endDate)`

**Logic**:
1.  Fetch current user's Group (via `groupService.getUserGroup`).
2.  If no group, fall back to existing `getDayPlansInRange` (single user).
3.  If group exists:
    -   Fetch `memberDetails` (names).
    -   For each `memberId`:
        -   Query their `days` collection for the date range.
        -   Hydrate the meals (convert `PlannedMeal` -> `Recipe`).
        -   **Crucial**: Tag each meal with `ownerId` and `ownerName`.
    -   **Merge**: Combine all plans into a single `Record<string, DayPlan>`.
        -   Base object = Current User's plan (preserves my `tips`, `type`, etc.).
        -   `meals` array = My Meals + Partner Meals.

**Imports**:
- Need `getUserGroup`, `getGroupMembersDetails` from `./groupService`.

## Validation Checkpoints

### 1. Type Check
- Ensure `ownerId` and `ownerName` are correctly populated on `Recipe` objects (they are optional fields in `types.ts`).

### 2. Manual Verification
1.  User A and User B are in a group.
2.  User B adds a meal to "Tuesday".
3.  User A runs the app.
4.  Verify `getFamilyPlansInRange` returns Tuesday's plan containing User B's meal.
    - We will add a temporary `console.log` in `Planner.tsx` (in Phase 3 or temporarily here) to verify the data.

---

## Step-by-Step Tasks

### Task 1: UPDATE `services/storageService.ts`
- **Import**: `getUserGroup`, `getGroupMembersDetails` from `groupService`.
- **Implement**: `getFamilyPlansInRange`
    -   Iterate members.
    -   Re-use `getDayPlansInRange` logic (but directed at specific `uid`).
    -   *Refactor note*: Might need to extract the "fetch plans for specific user" logic from `getDayPlansInRange` into a helper `getUserPlansInRange(uid, start, end)`.

### Task 2: EXPORT `getFamilyPlansInRange`
- Ensure it's available for `Planner.tsx` to use in Phase 3.

---

## Verification Plan

### Automated Tests
- None.

### Manual Verification
- We will rely on existing `Planner.tsx` behavior in Phase 3.
- For this Phase, we can run a simple script or `console.log` check if requested, but typically we proceed to UI wiring.
