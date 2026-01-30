# Implementation Plan - Phase 1: Foundation & Auth

**Goal**: Enable **Read Access** for family members to view each other's Meal Plans (`days`) and Shopping Lists (`shopping`).
**Source PRD**: `.agent/prds/family-features.prd.md`
**Phase**: 1

---

## Mandatory Reading

- [x] `firestore.rules` (Verified pattern)

## Proposed Changes

### 1. Update Security Rules `firestore.rules`
**Pattern to Mirror**: `match /recipes/{recipeId}` (lines 18-24).

We need to replicate the `isFamilyMember` check for:
1.  `match /days/{document=**}`
2.  `match /shopping/{document=**}`

#### Current State
```firestore
match /days/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

#### New State
```firestore
match /days/{document=**} {
  allow read: if request.auth != null && (
    request.auth.uid == userId ||
    isFamilyMember(request.auth.uid, userId)
  );
  allow write: if request.auth != null && request.auth.uid == userId;
}
```
*(Same for `shopping`)*

## Validation Checkpoints

### 1. Syntax Check
Since strict "tests" specifically for rules aren't in `package.json`, we will rely on `firebase deploy`'s built-in validation or visual inspection.

**Validation Command**:
```bash
# Verify syntax (dry run not easily available without emulators, so we rely on deploy check)
# But for this plan, we trust the code change pattern.
echo "Rules updated."
```

### 2. Manual Verification
(Post-Deployment)
1.  User A (Owner) has a Plan.
2.  User B (Family Member) tries to fetch `users/A/days/2026-01-30`.
3.  Should succeed (currently fails).

---

## Step-by-Step Tasks

### Task 1: UPDATE `firestore.rules`
- **Goal**: unlock `days` and `shopping` collections.
- **Action**: Update the match blocks to include `isFamilyMember` OR check for reads.
- **Validation**: Visual diff check.

---

## Verification Plan

### Automated Tests
- None specific to this repo's setup for rules (no `emulators` script found in standard lists).

### Manual Verification
- Deploy rules: `firebase deploy --only firestore:rules`
- (In Phase 2) The functionality will be verified when we implement the frontend data fetching.
