# Walkthrough: Family Meal Planning

**Goal**: Enable collaborative meal planning and shared grocery lists for partners.
**Version**: 1.0 (MVP)

---

## 1. Union Planner View

The **Planner** now displays meal plans from **all family members** (you and your partner).

-   **Your Meals**: Standard view, full edit controls.
-   **Partner's Meals**:
    -   Displayed in the same list.
    -   Marked with a **Badge** (e.g., "PARTNER").
    -   **Read-Only**: You cannot delete or edit them (preserving their autonomy).
    -   **Cooking Mode**: You *can* open them in Cooking Mode (to cook for the family).

## 2. Shared Shopping List

The **Shopping List** generator now aggregates potential ingredients from **everyone's meals** for the next 2 weeks.

-   **Selection Screen**: When you go to select meals for the list, you will see your partner's planned meals as selectable options.
-   **Generation**: Ingredients from selected partner meals are added to your list.
-   **Note**: "Checking off" items is currently local to your device (V1 limitation), but the *list content* is shared.

---

## 3. Technical Implementation

### Firestore Rules
-   Updated `firestore.rules` to allow `read` access to `days` and `shopping` collections for any user in the same `groupId`.
-   Write access remains restricted to the owner (preventing accidental overwrites).

### Service Layer (`storageService.ts`)
-   **New Function**: `getFamilyPlansInRange(startDate, endDate)`.
-   **Logic**:
    1.  Fetches user's Group.
    2.  Fetches `days` for all members in parallel.
    3.  Hydrates recipes.
    4.  Tags meals with `ownerId`, `ownerName`, and `isShared` flag.
    5.  Merges into a single `DayPlan` object per date (preserving current user's metadata like "Fast Day" status).

### UI Layer
-   **Planner**: Uses `getFamilyPlansInRange` exclusively. Renders badges for shared meals.
-   **ShoppingList**: Uses `getFamilyPlansInRange` to populate the "Select Meals" list.
