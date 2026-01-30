# Family Features: Union Meal Plan

## Problem Statement

Vesta is currently an isolated experience. Users with families or partners cannot see what their household is eating, leading to coordination friction ("What's for dinner?"), duplicate grocery purchases, and a disjointed meal planning process.

## Evidence

- **User Insight**: "The app is very isolated. When my partner has planned a meal, I want to be able to see what meal, so I know I don't need to make food."
- **Market Standard**: Top family apps (AnyList, Cozi) center entirely around shared lists/calendars. This is a baseline expectation for the "Digital Hearth".

## Proposed Solution

Implement a **"Union" Family View** in the Planner.
Instead of a single "Shared Document" (like Google Docs), we will overlay the user's data with their partner's data.
- **My Plan**: Editable, primary view.
- **Partner's Plan**: Read-only overlay on my calendar.
- **Result**: I can see that Partner planned "Spaghetti" for Tuesday, so I won't plan a duplicate meal or buy extra ingredients.

## Key Hypothesis

We believe **visible partner plans** will **eliminate duplicate planning** for users.
We'll know we're right when users report less friction in weekly planning (qualitative).

## What We're NOT Building

- **Shared Pantry**: Users confirmed this is not needed yet.
- **Shared Stats**: Weight/Health data remains strictly private.
- **Notifications**: No push alerts for updates in V1.
- **Real-time Editing of Partner's Plan**: MVP is Read-Only view of partner's data.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| **Family Setup Rate** | 20% | % of active users who join a Group |
| **Active Viewing** | N/A | Frequency of viewing weeks where partner has data |

## Open Questions

- [ ] **Data Merging**: How do we handle conflicts if both partners plan a "Main Meal" for the same slot? (Current assumption: Show both, let users resolve verbally).
- [ ] **Privacy Granularity**: Is "Read Only" enough, or do users need to hide specific "Surprise" meals? (MVP: No hiding).

---

## Users & Context

**Primary User**
- **Who**: The "Planner" in a household (partner/spouse).
- **Current behavior**: Asks partner verbally "What are we eating?", or checks a physical note.
- **Trigger**: Planning the week's grocery shop or starting dinner prep.
- **Success state**: Opening Vesta and seeing the full household context immediately.

**Job to Be Done**
When **I am planning the week**, I want to **see what my partner has already planned**, so I can **shop efficiently and avoid cooking twice**.

**Non-Users**
- **Kids/Guests**: This is for the core household management team (Partners) only.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| **Must** | **Group/Family Setup** | Foundation for connections (already technically exists). |
| **Must** | **View Partner's Meals** | The core value prop (Overlay in Planner). |
| **Should** | **Shared Grocery List** | "Nice to have" but high value for the "Shop" trigger. |
| **Won't** | **Edit Partner's Meals** | Complexity reduction for MVP. |

### MVP Scope

1.  **Invite Flow**: Ability to invite a partner via code (reuse existing Group logic).
2.  **Planner Update**: Fetch and display `Plan` documents for all group members in the `Planner` view.
3.  **Visual Distinction**: Distinct visual style for "Partner's Meal" vs "My Meal" (e.g., specific border color or avatar icon).

### User Flow

1.  User A goes to Settings -> Family -> "Create Group" -> Gets Code.
2.  User B goes to Settings -> Family -> "Join Group" -> Enters Code.
3.  User A opens Planner -> Sees User B's "Taco Night" on Tuesday.
4.  User A adds "Side Salad" to Tuesday (My Plan).
5.  Combined view shows [Taco Night (User B)] + [Side Salad (User A)].

---

## Technical Approach

**Feasibility**: **HIGH**

**Architecture Notes**
- **Firestore Strategy**: Retain user-isolation for writes. Use `isFamilyMember` rule to allow viewing user to `read` partner's `days` collection.
- **Frontend Logic**: `usePlanner` hook will now fetch `Promise.all([myPlan, partnerPlan])`.
- **Merging**: `Planner.tsx` will merge arrays for display. Conflict resolution is visual (stack them).

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| **Permissions Error** | Med | `firestore.rules` must be carefully tested for the `read` allowance. |
| **Performance** | Low | Fetching 2 plans instead of 1 is negligible overlay cost. |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | **Foundation & Auth** | Update `firestore.rules` for family-read access and verify Group Invite UI. | pending | - | - | - |
| 2 | **Planner Logic** | Update `storageService` to fetch family plans and `Planner.tsx` to handle multi-user state. | pending | - | 1 | - |
| 3 | **Planner UI** | "Rich Aesthetics" update to visualy distinguish and display partner meals in the calendar. | pending | - | 2 | - |
| 4 | **Shared Grocery (Bonus)** | Implement shared view for `shopping` collection if time permits. | pending | - | 3 | - |

### Phase Details

**Phase 1: Foundation & Auth**
- **Goal**: Ensure two users can be in a group and READ each other's data at the API level.
- **Scope**: `firestore.rules`, `GroupSettings.tsx` (ensure it works).
- **Success signal**: User A can raw-fetch User B's `days/2024-XX-XX` doc.

**Phase 2: Planner Logic**
- **Goal**: Frontend accurately holds state for multiple users.
- **Scope**: `storageService.ts` (`getFamilyPlan`), `types.ts`.
- **Success signal**: `Planner` logs contain merged meal data.

**Phase 3: Planner UI**
- **Goal**: Beautiful presentation of the union plan.
- **Scope**: `Planner.tsx`, `MealCard` updates (Avatar/Color coding).
- **Success signal**: Visual differentiation between "My Meal" and "Partner's Meal".

**Phase 4: Shared Grocery (Bonus)**
- **Goal**: Unified shopping list.
- **Scope**: `ShoppingList.tsx` merging.
- **Success signal**: Partner's ingredients appear in my list.
