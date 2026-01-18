# Feature: Family Recipe Visibility

## Feature Description

Enable family/group members to view each other's recipes directly from their personal collections. Recipes remain owned by their creator but are readable by all family members. This provides a seamless way to browse and use recipes from family members without duplication, while maintaining clear ownership and edit rights.

## User Story

As a family group member
I want to see recipes from other family members in my Recipe Library
So that I can discover and use meals my family has added without them manually sharing each one

## Problem Statement

Currently, recipe sharing requires manually copying recipes to a group subcollection (`groups/{groupId}/shared_recipes`). This creates:
- Duplicate data that can become stale
- Confusion about which version is "current"
- Extra steps to share each recipe individually
- No clear ownership of shared recipes

## Solution Statement

Replace the copy-based sharing model with a visibility-based model where:
- All recipes remain in their owner's personal collection (`users/{uid}/recipes`)
- Family members gain read-only access to each other's recipe collections
- Attribution shows whose recipe it is
- Only the owner can edit/delete their recipes
- A "Copy to My Recipes" action lets users create their own editable version

---

## Feature Metadata

**Feature Type**: Enhancement (Refactor of existing sharing model)
**Estimated Complexity**: Medium
**Primary Systems Affected**:
- `services/groupService.ts` - New function to fetch family recipes
- `services/storageService.ts` - Minor updates
- `components/RecipeLibrary.tsx` - Display family recipes with attribution
- `components/RecipeCard.tsx` - Ownership-aware actions
- `components/RecipeDetailModal.tsx` - Read-only mode for non-owned recipes
- `firestore.rules` - Allow family members to read each other's recipes

**Dependencies**: None (uses existing Firebase/Firestore)

---

## CONTEXT REFERENCES

### Relevant Codebase Files

- `types.ts` (lines 1-18) - Recipe interface with existing `isShared`, `sharedBy`, `sharedAt` fields (will repurpose)
- `types.ts` (lines 175-183) - Group interface with `memberIds` array
- `services/groupService.ts` (lines 100-135) - `getUserGroup()`, `getGroupMembersDetails()` patterns to follow
- `services/groupService.ts` (lines 137-157) - Existing share functions to deprecate
- `services/storageService.ts` (lines 25-53) - `getRecipes()`, `saveRecipe()` patterns
- `components/RecipeLibrary.tsx` (lines 46-59) - Current data loading pattern
- `components/RecipeLibrary.tsx` (lines 255-283) - Filter logic for `isShared` flag
- `components/RecipeCard.tsx` (lines 58-65) - Shared badge display
- `components/RecipeCard.tsx` (lines 78-92) - Conditional action buttons
- `components/FamilySettings.tsx` - Group management UI (no changes needed)
- `firestore.rules` (lines 13-34) - Current group rules structure
- `constants.ts` (line 3) - `MAX_FAMILY_GROUP_SIZE = 10`

### New Files to Create

None - all changes are to existing files.

### Files to Modify

1. `firestore.rules` - Add read permission for family members' recipes
2. `services/groupService.ts` - Add `getFamilyMemberRecipes()` function
3. `types.ts` - Add `ownerId` and `ownerName` to Recipe interface
4. `components/RecipeLibrary.tsx` - Fetch and display family recipes with attribution
5. `components/RecipeCard.tsx` - Show owner name, conditional edit/share buttons
6. `components/RecipeDetailModal.tsx` - Read-only mode, copy-to-my-recipes action

### Relevant Documentation

- [Firebase Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
  - Specific section: Rules with custom conditions
  - Why: Need to allow cross-user reads for family members

### Patterns to Follow

**Naming Conventions:**
- Functions: camelCase (`getFamilyMemberRecipes`)
- Types: PascalCase (`Recipe`, `Group`)
- Constants: SCREAMING_SNAKE_CASE (`MAX_FAMILY_GROUP_SIZE`)

**Error Handling Pattern (from groupService.ts:117-134):**
```typescript
try {
  // operation
} catch (e) {
  console.error("Error message:", e);
  return []; // or sensible default
}
```

**Async Data Loading Pattern (from RecipeLibrary.tsx:46-59):**
```typescript
const loadData = async () => {
  const userRecipes = await getRecipes();
  setRecipes(userRecipes);

  try {
    const group = await getUserGroup();
    if (group) {
      // fetch family data
    }
  } catch (e) {
    console.error("Failed to load:", e);
  }
};
```

**Badge Display Pattern (from RecipeCard.tsx:60-65):**
```typescript
{meal.isShared && (
  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md bg-white/90 text-emerald-700 flex items-center gap-1.5">
    <svg>...</svg>
    Label
  </span>
)}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Data Layer Foundation

Update Firestore security rules to allow family members to read each other's recipe collections. Add new service function to fetch recipes from all family members.

**Tasks:**
- Update `firestore.rules` with family read access
- Add `getFamilyMemberRecipes()` to `groupService.ts`
- Extend Recipe type with owner attribution fields

### Phase 2: UI Integration

Update RecipeLibrary to fetch and merge family recipes. Add owner attribution display and ownership-aware action buttons.

**Tasks:**
- Update RecipeLibrary data loading
- Update RecipeCard to show owner and conditional actions
- Update RecipeDetailModal for read-only mode

### Phase 3: Copy-to-Library Feature

Add ability for users to copy a family member's recipe to their own collection for editing.

**Tasks:**
- Add `copyRecipeToMyLibrary()` function
- Add "Copy to My Recipes" button in RecipeCard and RecipeDetailModal

### Phase 4: Cleanup & Testing

Remove deprecated sharing code and validate the feature end-to-end.

**Tasks:**
- Deprecate/remove old `shareRecipeToGroup` usage
- Manual testing of all flows
- Verify Firestore rules work correctly

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE `firestore.rules`

- **IMPLEMENT**: Add rule allowing family members to read each other's recipes subcollection
- **PATTERN**: Follows existing group membership check pattern (lines 22-25)
- **GOTCHA**: Need a helper function or inline check to verify requester is in same group as target user. Firestore rules can't easily do cross-document lookups, so we use a different approach: store `groupId` on user document and check match.
- **VALIDATE**: Deploy rules with `firebase deploy --only firestore:rules` then test read access

**New rules to add:**
```javascript
// Allow family members to read each other's recipes
match /users/{userId}/recipes/{recipeId} {
  allow read: if request.auth != null && (
    request.auth.uid == userId ||  // Owner can always read
    isFamilyMember(request.auth.uid, userId)  // Family member check
  );
  allow write: if request.auth != null && request.auth.uid == userId;  // Only owner can write
}

// Helper function - checks if two users share a groupId
function isFamilyMember(requesterId, targetUserId) {
  let requesterGroup = get(/databases/$(database)/documents/users/$(requesterId)).data.groupId;
  let targetGroup = get(/databases/$(database)/documents/users/$(targetUserId)).data.groupId;
  return requesterGroup != null && requesterGroup == targetGroup;
}
```

---

### Task 2: UPDATE `types.ts` - Extend Recipe interface

- **IMPLEMENT**: Add `ownerId` and `ownerName` optional fields to Recipe interface
- **PATTERN**: Follow existing optional field pattern (line 16-17: `sharedBy?: string`)
- **IMPORTS**: None needed
- **GOTCHA**: Keep fields optional for backward compatibility with existing recipes
- **VALIDATE**: `npx tsc --noEmit`

**Add after line 17:**
```typescript
ownerId?: string;    // UID of recipe owner (set when viewing family recipes)
ownerName?: string;  // Display name of owner (set when viewing family recipes)
```

---

### Task 3: UPDATE `services/groupService.ts` - Add getFamilyMemberRecipes()

- **IMPLEMENT**: New async function that fetches recipes from all family members
- **PATTERN**: Mirror `getGroupMembersDetails()` pattern (lines 117-135)
- **IMPORTS**: Add `collection, getDocs` if not present; import `Recipe` from types
- **GOTCHA**: Skip current user's recipes (they're loaded separately). Handle users with no recipes gracefully.
- **VALIDATE**: Manual test in browser console

**Add new function:**
```typescript
export const getFamilyMemberRecipes = async (): Promise<Recipe[]> => {
  const user = getCurrentUser();
  const group = await getUserGroup();

  if (!group) return [];

  // Get member details for names
  const memberDetails = await getGroupMembersDetails(group.memberIds);
  const memberNameMap = new Map(memberDetails.map(m => [m.id, m.name]));

  const allFamilyRecipes: Recipe[] = [];

  // Fetch recipes from each family member (except self)
  for (const memberId of group.memberIds) {
    if (memberId === user.uid) continue; // Skip own recipes

    try {
      const recipesRef = collection(db, "users", memberId, "recipes");
      const snapshot = await getDocs(recipesRef);

      const memberRecipes = snapshot.docs.map(doc => ({
        ...doc.data() as Recipe,
        ownerId: memberId,
        ownerName: memberNameMap.get(memberId) || "Family Member"
      }));

      allFamilyRecipes.push(...memberRecipes);
    } catch (e) {
      console.error(`Failed to fetch recipes for member ${memberId}:`, e);
      // Continue with other members
    }
  }

  return allFamilyRecipes;
};
```

---

### Task 4: UPDATE `services/groupService.ts` - Add copyRecipeToMyLibrary()

- **IMPLEMENT**: Function to copy a family recipe to user's own collection with new ID
- **PATTERN**: Similar to `saveRecipe()` in storageService.ts
- **IMPORTS**: Import `saveRecipe` from storageService or duplicate pattern
- **GOTCHA**: Generate new UUID, remove owner fields, set as user's own recipe
- **VALIDATE**: Manual test

**Add new function:**
```typescript
export const copyRecipeToMyLibrary = async (recipe: Recipe): Promise<Recipe> => {
  const user = getCurrentUser();

  // Create a copy with new ID, removing family ownership fields
  const copiedRecipe: Recipe = {
    ...recipe,
    id: crypto.randomUUID(),
    ownerId: undefined,
    ownerName: undefined,
    isShared: false,
    sharedBy: undefined,
    sharedAt: undefined
  };

  // Clean up undefined fields
  Object.keys(copiedRecipe).forEach(key => {
    if (copiedRecipe[key as keyof Recipe] === undefined) {
      delete copiedRecipe[key as keyof Recipe];
    }
  });

  // Save to user's recipes
  const recipeRef = doc(db, "users", user.uid, "recipes", copiedRecipe.id);
  await setDoc(recipeRef, copiedRecipe);

  return copiedRecipe;
};
```

---

### Task 5: UPDATE `components/RecipeLibrary.tsx` - Fetch family recipes

- **IMPLEMENT**: Replace `getGroupRecipes()` call with `getFamilyMemberRecipes()`
- **PATTERN**: Existing pattern at lines 50-58
- **IMPORTS**: Change import from `getGroupRecipes, shareRecipeToGroup` to `getFamilyMemberRecipes, copyRecipeToMyLibrary`
- **GOTCHA**: Family recipes now have `ownerId`/`ownerName` set, not `isShared` flag
- **VALIDATE**: Visual check - family recipes appear with owner name

**Update imports (line 4):**
```typescript
import { getUserGroup, getFamilyMemberRecipes, copyRecipeToMyLibrary } from '../services/groupService';
```

**Update loadData function (lines 46-59):**
```typescript
const loadData = async () => {
  const userRecipes = await getRecipes();
  setRecipes(userRecipes);

  try {
    const group = await getUserGroup();
    setUserGroup(group);
    if (group) {
      const familyRecipes = await getFamilyMemberRecipes();
      setFamilyRecipes(familyRecipes);
    } else {
      setFamilyRecipes([]);
    }
  } catch (e) {
    console.error("Failed to load group data:", e);
  }
};
```

---

### Task 6: UPDATE `components/RecipeLibrary.tsx` - Update filter logic

- **IMPLEMENT**: Change filter to use `ownerId` presence instead of `isShared` flag
- **PATTERN**: Existing filter at lines 255-269
- **GOTCHA**: Family recipes have `ownerId` set; user's own recipes don't

**Update filteredRecipes (around line 262-264):**
```typescript
const matchesFilter = activeFilter === 'all' ||
  (activeFilter === 'mine' && !recipe.ownerId) ||
  (activeFilter === 'family' && !!recipe.ownerId) ||
  recipe.tags?.includes(activeFilter);
```

---

### Task 7: UPDATE `components/RecipeLibrary.tsx` - Add copy handler

- **IMPLEMENT**: Add handler for copying family recipe to user's library
- **PATTERN**: Similar to existing `handleShare` (lines 227-239)
- **VALIDATE**: Click "Copy to My Recipes" and verify recipe appears in "My Recipes" filter

**Add new handler:**
```typescript
const handleCopyToMyLibrary = async (e: React.MouseEvent, recipe: Recipe) => {
  e.stopPropagation();
  if (!recipe.ownerId) return; // Only for family recipes

  if (confirm(`Copy "${recipe.name}" to your recipe library?`)) {
    try {
      const copied = await copyRecipeToMyLibrary(recipe);
      alert("Recipe copied to your library!");
      await loadData();
      // Optionally open the copied recipe
      setSelectedRecipe(copied);
      setActiveTab('overview');
    } catch (e: any) {
      alert("Failed to copy: " + e.message);
    }
  }
};
```

---

### Task 8: UPDATE `components/RecipeLibrary.tsx` - Pass new props to RecipeCard

- **IMPLEMENT**: Pass `isOwned`, `onCopyToLibrary`, remove `onShare` for family recipes
- **PATTERN**: Existing prop passing at lines 468-494
- **GOTCHA**: Only show share button for owned recipes, only show copy for family recipes

**Update RecipeCard usage:**
```typescript
<RecipeCard
  key={recipe.id}
  meal={recipe}
  onClick={onSelect ? () => onSelect(recipe) : () => openRecipe(recipe)}
  showMacros={false}
  onToggleFavorite={!recipe.ownerId ? (e) => toggleFavorite(e, recipe) : undefined}
  actionLabel={onSelect ? "Select" : undefined}
  onAction={onSelect ? (e) => {
    e.stopPropagation();
    onSelect(recipe);
  } : undefined}
  isInGroup={!!userGroup}
  isOwned={!recipe.ownerId}
  ownerName={recipe.ownerName}
  onShare={!recipe.ownerId && userGroup ? (e) => handleShare(e, recipe) : undefined}
  onCopyToLibrary={recipe.ownerId ? (e) => handleCopyToMyLibrary(e, recipe) : undefined}
  onAddToPlan={async (e) => {
    // ... existing logic
  }}
/>
```

---

### Task 9: UPDATE `components/RecipeCard.tsx` - Add new props

- **IMPLEMENT**: Add `isOwned`, `ownerName`, `onCopyToLibrary` props
- **PATTERN**: Existing props interface (lines 6-18)
- **VALIDATE**: `npx tsc --noEmit`

**Update interface:**
```typescript
interface RecipeCardProps {
  meal: Meal;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  showMacros?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  // Sharing props
  isInGroup?: boolean;
  isOwned?: boolean;  // NEW: true if current user owns this recipe
  ownerName?: string; // NEW: name of recipe owner (for family recipes)
  onShare?: (e: React.MouseEvent) => void;
  onCopyToLibrary?: (e: React.MouseEvent) => void; // NEW: copy family recipe
  // Quick Add to Plan
  onAddToPlan?: (e: React.MouseEvent) => void;
}
```

**Update destructuring:**
```typescript
export const RecipeCard: React.FC<RecipeCardProps> = ({
  meal,
  onClick,
  actionLabel,
  onAction,
  showMacros = true,
  onToggleFavorite,
  isInGroup,
  isOwned = true,
  ownerName,
  onShare,
  onCopyToLibrary,
  onAddToPlan
}) => {
```

---

### Task 10: UPDATE `components/RecipeCard.tsx` - Show owner badge

- **IMPLEMENT**: Display owner name badge for family recipes
- **PATTERN**: Existing "Family" badge (lines 60-65)
- **GOTCHA**: Only show for non-owned recipes

**Update badges section (after line 65):**
```typescript
{/* Owner Badge (for family recipes) */}
{!isOwned && ownerName && (
  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md bg-white/90 text-blue-700 flex items-center gap-1.5">
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
    {ownerName}
  </span>
)}
```

**Remove or update the old `isShared` badge** (lines 60-65) - can remove since we now show owner name instead.

---

### Task 11: UPDATE `components/RecipeCard.tsx` - Add copy button

- **IMPLEMENT**: Add "Copy to My Recipes" button for family recipes
- **PATTERN**: Similar to share button (lines 81-92)
- **GOTCHA**: Only show for non-owned recipes

**Add after share button section:**
```typescript
{/* Copy to My Library Button (for family recipes) */}
{!isOwned && onCopyToLibrary && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onCopyToLibrary(e);
    }}
    className="p-2 rounded-full shadow-md backdrop-blur-md transition-all duration-300 bg-black/20 text-white hover:bg-surface/90 hover:text-blue-600 hover:scale-110"
    title="Copy to My Recipes"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
  </button>
)}
```

---

### Task 12: UPDATE `components/RecipeCard.tsx` - Conditional favorite button

- **IMPLEMENT**: Only show favorite toggle for owned recipes (or disable for family)
- **PATTERN**: Existing favorite button (lines 95-109)
- **GOTCHA**: Toggling favorite on family recipe would require cross-user write

**Update favorite button (wrap in conditional or disable):**
```typescript
{/* Favorite Button - only for owned recipes */}
{isOwned && onToggleFavorite && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onToggleFavorite(e);
    }}
    // ... existing styling
  >
    {/* ... existing SVG */}
  </button>
)}
```

---

### Task 13: UPDATE `components/RecipeDetailModal.tsx` - Read-only mode

- **IMPLEMENT**: Add `isOwned` prop, hide edit/delete buttons for non-owned recipes, add copy button
- **PATTERN**: Check existing modal structure
- **IMPORTS**: May need to pass `onCopyToLibrary` callback
- **VALIDATE**: Open family recipe, verify no edit button, copy button visible

**Add to props interface:**
```typescript
interface RecipeDetailModalProps {
  recipe: Recipe;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: (id: string, e: React.MouseEvent) => void;
  isOwned?: boolean;  // NEW
  onCopyToLibrary?: () => void;  // NEW
}
```

**Conditional rendering of edit/delete:**
```typescript
{isOwned !== false && onEdit && (
  <button onClick={onEdit}>Edit</button>
)}
{isOwned !== false && onDelete && (
  <button onClick={(e) => onDelete(recipe.id, e)}>Delete</button>
)}
{isOwned === false && onCopyToLibrary && (
  <button onClick={onCopyToLibrary}>Copy to My Recipes</button>
)}
```

---

### Task 14: UPDATE `components/RecipeLibrary.tsx` - Pass props to RecipeDetailModal

- **IMPLEMENT**: Pass `isOwned` and `onCopyToLibrary` to RecipeDetailModal
- **PATTERN**: Existing modal usage (lines 675-680)

**Update RecipeDetailModal usage:**
```typescript
<RecipeDetailModal
  recipe={selectedRecipe}
  onClose={closeRecipe}
  onEdit={!selectedRecipe.ownerId ? startEditing : undefined}
  onDelete={!selectedRecipe.ownerId ? (id, e) => handleDelete(e, id) : undefined}
  isOwned={!selectedRecipe.ownerId}
  onCopyToLibrary={selectedRecipe.ownerId ? async () => {
    await handleCopyToMyLibrary({ stopPropagation: () => {} } as React.MouseEvent, selectedRecipe);
  } : undefined}
/>
```

---

### Task 15: CLEANUP - Deprecate old sharing functions

- **IMPLEMENT**: Mark `shareRecipeToGroup`, `getGroupRecipes`, `deleteGroupRecipe` as deprecated
- **PATTERN**: Add `@deprecated` JSDoc comment
- **GOTCHA**: Don't remove yet in case there's existing data in `shared_recipes` collections

**Add deprecation comments in groupService.ts:**
```typescript
/**
 * @deprecated Use getFamilyMemberRecipes() instead.
 * Family members can now view each other's recipes directly.
 */
export const shareRecipeToGroup = async (...) => { ... };
```

---

## TESTING STRATEGY

### Unit Tests

Not strictly required for this feature (no complex logic), but recommended:
- Test `getFamilyMemberRecipes()` returns recipes from all family members
- Test `copyRecipeToMyLibrary()` creates new recipe with new ID

### Integration Tests

Manual testing required:
1. Create two test users in the same family group
2. User A adds a recipe
3. User B sees User A's recipe in their library with attribution
4. User B cannot edit/delete User A's recipe
5. User B copies recipe to their library
6. User B can now edit their copy
7. Verify Firestore rules block direct write attempts

### Edge Cases

- [ ] User not in any group - only sees own recipes
- [ ] User joins group - immediately sees family recipes
- [ ] User leaves group - stops seeing family recipes
- [ ] Family member has no recipes - no errors, just empty
- [ ] Recipe owner deletes recipe - disappears from all family views
- [ ] Large family (10 members) - performance acceptable

---

## VALIDATION COMMANDS

### Level 1: Syntax & Style

```bash
# TypeScript compilation check
npx tsc --noEmit

# Lint check (if configured)
npm run lint
```

### Level 2: Build

```bash
# Vite build
npm run build
```

### Level 3: Firestore Rules

```bash
# Deploy rules to test environment
firebase deploy --only firestore:rules

# Or test locally with emulator
firebase emulators:start --only firestore
```

### Level 4: Manual Validation

1. **Setup**: Create two users (UserA, UserB) and have them join same family group
2. **Test Recipe Visibility**:
   - UserA: Add a new recipe "Test Recipe"
   - UserB: Open Recipe Library, verify "Test Recipe" appears with UserA's name
   - UserB: Filter by "Family Recipes", verify recipe shows
   - UserB: Filter by "My Recipes", verify recipe does NOT show
3. **Test Read-Only**:
   - UserB: Click on UserA's recipe
   - Verify: No "Edit" button visible
   - Verify: No "Delete" option
   - Verify: "Copy to My Recipes" button visible
4. **Test Copy**:
   - UserB: Click "Copy to My Recipes"
   - Verify: Recipe now appears in "My Recipes" filter
   - Verify: Can edit the copied recipe
5. **Test Group Leave**:
   - UserB: Leave family group
   - Verify: UserA's recipes no longer visible

---

## ACCEPTANCE CRITERIA

- [x] Recipes remain stored in owner's personal collection (no duplication)
- [ ] Family members can view each other's recipes in Recipe Library
- [ ] Family recipes show owner attribution (name badge)
- [ ] Family recipes are read-only (no edit/delete buttons)
- [ ] "Copy to My Recipes" action works for family recipes
- [ ] Copied recipes appear in user's own collection and are editable
- [ ] Filter "My Recipes" shows only owned recipes
- [ ] Filter "Family Recipes" shows only family members' recipes
- [ ] Users not in a group only see their own recipes
- [ ] Firestore rules enforce read-only access for non-owners
- [ ] All validation commands pass
- [ ] No TypeScript errors
- [ ] Build succeeds

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Firestore rules deployed and tested
- [ ] TypeScript compiles without errors
- [ ] Build succeeds
- [ ] Manual testing completed for all flows
- [ ] Edge cases verified
- [ ] Old sharing functions marked as deprecated
- [ ] Code follows project conventions

---

## NOTES

### Design Decisions

1. **Visibility over Sharing**: Chose automatic visibility for all recipes rather than per-recipe opt-in sharing. This reduces friction and matches the user's mental model of "family can see my stuff."

2. **Copy vs. Reference**: When users copy a family recipe, they get an independent copy with a new ID. This ensures they can freely modify it without affecting the original.

3. **Owner Attribution**: Using `ownerId` and `ownerName` fields on recipes when fetched from family members. These are ephemeral (set at fetch time, not stored).

4. **Backward Compatibility**: Old `isShared`, `sharedBy`, `sharedAt` fields kept for potential migration but not actively used in new flow.

### Performance Considerations

- Fetching recipes from up to 9 other family members (max group size 10) could be slow
- Consider pagination or lazy loading for large recipe collections
- Could optimize with a Cloud Function that aggregates family recipes

### Future Enhancements

- Real-time updates when family member adds/modifies recipe (Firestore listeners)
- "Suggested for you" based on family favorites
- Recipe request feature ("Can you share your lasagna recipe?")

### Migration Notes

- Existing data in `groups/{groupId}/shared_recipes` can remain but will be unused
- Consider a migration script to move shared recipes back to owner's collection
- The `enableGroupSharing` feature flag in constants.ts may need updating

<!-- EOF -->
