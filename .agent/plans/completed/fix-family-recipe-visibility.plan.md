# Feature: Family Recipe Visibility Fix

## Summary

The current `hydratePlannedMeals` and `getRecipe` functions are hardcoded to fetch recipes only from the currently authenticated user's collection. This causes "Recipe Not Found" errors when viewing family assignments where the plan belongs to another family member. This plan enables fetching recipes from the plan owner's collection.

## User Story

As a family member
I want to see the details of meals planned by other family members
So that I know what is on the menu even if I didn't plan it

## Problem Statement

When `getFamilyPlansInRange` fetches plans from other family members, it attempts to hydrate the meal references using the *current user's* recipe library. Since the recipes exist in the family member's library (not the viewer's), the lookup fails, resulting in "Recipe Not Found" placeholders.

## Solution Statement

We will refactor `getRecipe` and `hydratePlannedMeals` to accept an optional `userId` parameter. When fetching family plans, we will pass the family member's ID to `hydratePlannedMeals`, enabling the system to look up recipes in the correct user's collection.

## Metadata

| Field            | Value                                             |
| ---------------- | ------------------------------------------------- |
| Type             | BUG_FIX                                           |
| Complexity       | MEDIUM                                            |
| Systems Affected | `services/storageService.ts`, Family Planner View |
| Dependencies     | Firestore Rules (Already verified)                |
| Estimated Tasks  | 3                                                 |

## UX Design

### Before State
The user sees "Recipe Not Found" cards when viewing days planned by other family members.

### After State
The user sees the correct recipe details (name, calories, etc.) for meals planned by other family members.

## Files to Change

| File                           | Action | Justification                                                    |
| ------------------------------ | ------ | ---------------------------------------------------------------- |
| `services/storageService.ts`   | UPDATE | Add `userId` support to `getRecipe` and `hydratePlannedMeals`    |

## Step-by-Step Tasks

### Task 1: Update `getRecipe` to support `userId`

- **ACTION**: Modify `getRecipe` signature to `getRecipe(id: string, userId?: string)`.
- **IMPLEMENT**:
    - If `userId` is provided, use `doc(db, 'users', userId, 'recipes', id)`.
    - If not, default to current logic (current user).
- **VALIDATE**: `npx tsc --noEmit`

### Task 2: Update `hydratePlannedMeals` to support `userId`

- **ACTION**: Modify `hydratePlannedMeals` signature to `hydratePlannedMeals(plannedMeals: PlannedMeal[], userId?: string)`.
- **IMPLEMENT**: Pass the `userId` down to the `getRecipe` calls.
- **VALIDATE**: `npx tsc --noEmit`

### Task 3: Update `getFamilyPlansInRange`

- **ACTION**: Pass `memberId` to `hydratePlannedMeals` inside the member loop.
- **MIRROR**:
  ```typescript
  // Inside getFamilyPlansInRange loop
  const hydratedMeals = rawPlan.meals 
    ? await hydratePlannedMeals(rawPlan.meals, memberId) // Pass memberId
    : [];
  ```
- **VALIDATE**: Build check and manual verification if possible.

## Verification Plan

### Automated Tests
- `npm run build` to ensure type safety.

### Manual Verification
1.  **Mock Test**: Since we cannot easily switch users in this environment, we will verify the code logic matches the `firestore.rules` structure.
2.  **Constraint Check**: Ensure `getRecipe` still defaults to `getUserId()` so existing calls (planner, library) remain unaffected.
