---
name: firebase-ops
description: Operations and migration patterns for Firebase Firestore equality and data management.
---

# Firebase Operations & Data Integrity

## Data Structure
- `users/{uid}/data/stats` (UserStats)
- `users/{uid}/recipes/{recipeId}` (Collection)
- `users/{uid}/plans/{YYYY-MM-DD}` (Collection)
- `users/{uid}/logs/{YYYY-MM-DD}` (Collection)

## Migrations
When changing data structures (e.g., renaming a field):
1.  **Read-Time Migration:** In your `get` function, check for old fields and map them to new ones before returning.
2.  **Write-Back:** Save the migrated structure back to Firebase immediately or on next user save.

## Async Discipline
- **ALWAYS** use `await` for Firebase calls.
- **Error Handling:** Wrap in `try/catch` and expose user-friendly errors.

## Indexes
- Complex queries (e.g., "Recipes by tag sorted by date") require Firestore Indexes.
- Check the console output if a query fails; it often provides a direct link to create the index.
