# Shopping list actions: fix and verification

## Problem and evidence

Removing meals and clearing the basket leave the displayed list unchanged until Firestore
delivers another snapshot. `ShoppingList.run` previously only awaited the service; it never
updated local list state. Both services also read their inputs before writing, adding a network
round trip. Component tests with delayed saves reproduce the unchanged screen.

There was no reset action: `clearBasket` deliberately keeps unchecked items and upcoming meal
records. Meal removal controls were hidden in a collapsed section.

These paths originated in b4d9d85 (family shopping list, 2026-10-18). The pantry extension in
3647837 kept the same rendering contract. Normal live updates pass the existing service tests;
the missing behavior is feedback while those updates are delayed.

## Constraints

- [x] Use current Market day semantic tokens and existing button/sheet components.
- [x] Keep the existing family list, per-item writes and pantry schema.
- [x] Keep shared quantities and newer family changes intact.
- [x] Preserve the meal plan and pantry when resetting shopping.
- [x] Update immediately; show errors and roll back failed changes.
- [x] Expose meal removal and a reset action on mobile and desktop.
- [x] Use strict types and React state without a new state library.

## Implementation

1. Apply pending list changes with React's `useOptimistic`, rebased over live snapshots.
   Successful actions also update the underlying local state, so delayed snapshots do not require
   a reload. Failed actions fall back to the latest subscribed state.
2. Project meal removals with the same ingredient-removal rules as the service; leave the other
   meals' shares intact. Apply immediate feedback to basket and item actions too.
3. Add `resetShoppingList`: delete shopping items and the meal registry in bounded batches.
   Keep pantry documents and meal plans. Use the existing confirmation sheet to explain scope.
4. Expand the list of meals by default and put Reset list beside the list controls.

## Verification

Component regression tests cover delayed writes and snapshots, shared quantities, rollback with
concurrent family updates, basket clearing, reset, cancellation, reset failure and individual item
actions. Service tests cover reset propagation, preserved pantry, re-adding meals and more than
one batch of items. Run the full Vitest suite, TypeScript check, production build and responsive
browser inspection using disposable fixture data.

Verified on 2026-10-18: 296 tests pass across 25 files, `tsc --noEmit` passes and the production
build succeeds. The build retains its existing chunk-splitting/size and Browserslist warnings.
Browser checks at 375 × 812 and 1200 × 900 show no horizontal overflow or console warnings/errors.
With five-second fixture saves and no live snapshots, meal removal updates the quantity
immediately and confirmed reset shows the empty list with Add 2 planned meals.

## Follow-up: place shopping under Family

The family shares the shopping list; Planner already contains the meal-planning workflow.
Move the existing two-tab control to Family (Family / Shopping list), retain the five main
navigation items and existing routes, and highlight Family on `/shopping`. Use the same content
width on both Family tabs so the control stays aligned. Planner keeps its wider week layout.

Implemented by replacing PlannerTabs with FamilyTabs and updating App's header, tab placement
and shared navigation selection. All 296 tests, TypeScript and production build pass. Disposable
browser checks at phone and desktop widths confirm Family is selected while shopping, tabs
switch correctly, and the layout has no horizontal overflow or browser warnings/errors.
