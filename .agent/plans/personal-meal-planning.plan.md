# PRP: Personal meal planning preference

> **Superseded by the scoped [PRD](/Users/jon/.prp/vesta-53fb8f5a/prds/personal-meal-planning.prd.md), 18 October 2026.** This earlier outline is background only. The user subsequently confirmed adults-only v1, a small scope and stronger privacy work deferred separately; the privacy migration below is not a v1 requirement. Generate phase plans from the PRD before implementation.

## 🎯 Objective

**User story:** As a family member, I can plan meals, cook and shop without tracking nutrition, while another member can track their own intake from the same meals.

Each person chooses **“Plan meals”** or **“Plan meals and track nutrition.”** This is a reversible preference, independent of family membership and editing permissions.

**Visual goal:** Use the current “Market day” design system: meal imagery, cream cards, ink actions and a meal-focused hero for planning users. Follow the October 2026 design system over older glass/serif guidance.

## What each person sees

| Area | Plan meals | Plan meals and track nutrition |
|---|---|---|
| Setup | Name and family setup/join; no weight or calorie questions | Same setup, followed by personal tracking goals |
| Today | Tonight’s meal, other planned meals, who is eating, and shortcuts to plan or shop; an empty day offers “Plan a meal” | Existing nutrition dashboard, personal logs and today’s meals |
| Navigation | Today, Planner, Recipes, Shopping, Family | Existing Today, Analytics, Planner, Recipes, Family; shopping remains available within Family |
| Planner | Meals, dates, participation and leftovers; no calorie totals, budgets, fasting labels or “fits calories” filters | Same shared meals, with personal nutrition context and intake actions |
| Recipes | Photos, ingredients, dietary tags, servings and instructions; nutrition values and inputs hidden | Same recipes, with available nutrition information |
| Shopping | Same live family list, planned ingredients and manual items | Same live family list |
| Settings | Account, family, reminders and experience preference | Those settings plus tracking goals and health settings |

**Example:** Alex plans pasta and Sam shops for it. Neither action logs food. A tracking member chooses “I ate this” for their own intake; nobody else’s diary changes. Do not introduce a shared “cooked” status in the first release.

## 🛡️ Hazards & constraints

- [ ] One shared meal/recipe/list foundation; no duplicate plans for the two experiences.
- [ ] No automatic intake logging, historical backfill or fabricated weight data for planning users. Pause personal tracking prompts/reminders while in planning mode.
- [ ] Switching preserves existing history and shared meals. Enabling tracking requests any missing setup; disabling it returns to meal-focused Today.
- [ ] Meal edits by a planning user preserve existing recipe nutrition. Missing nutrition stays unknown; it must not silently count as zero for trackers.
- [ ] Hiding information is not privacy protection: personal calorie/completion/fasting fields currently exist in family-readable day documents.
- [ ] Semantic tokens, current fonts, 44px touch targets, reduced motion and light/dark support; verify at 375px and 1200px.
- [ ] Keep state in App.tsx and persistence in services; strict types, UUIDs and YYYY-MM-DD dates. Preserve unrelated work in progress.

## 📋 Implementation plan

### Phase 1: Data, setup and switching

- Add typed, owner-only user preferences for experience and explicit setup completion, persisted through the existing storage/cache patterns. Keep preferences independent of weight history and family settings; scope caches by signed-in user.
- Update onboarding and Settings with the two choices. Preserve the tracking experience for existing accounts; new members choose before health questions. Load preferences before rendering health content and handle a failed load/save visibly.
- Allow planning users to add recipes and quick meals without entering calories. Preserve known values on edits and explicitly represent unavailable nutrition for trackers.
- Main files: [types.ts](/Users/jon/dev/Vesta/types.ts), [storageService.ts](/Users/jon/dev/Vesta/services/storageService.ts), [OnboardingWizard.tsx](/Users/jon/dev/Vesta/components/OnboardingWizard.tsx), [SettingsView.tsx](/Users/jon/dev/Vesta/components/SettingsView.tsx).

### Phase 2: Screens and shared actions

- Render a focused meal Today view in App.tsx; share existing meal data and actions rather than duplicating storage. Use one preference-aware navigation definition for phone and desktop, with correct active states for Shopping and Family.
- Apply the preference consistently to planner, recipe cards/details/editors and add-meal sheets. Planning users get manual planning first; omit calorie-driven automatic planning and tracking-only routes/prompts, including direct links.
- Main files: [App.tsx](/Users/jon/dev/Vesta/App.tsx), [MobileBottomNav.tsx](/Users/jon/dev/Vesta/components/MobileBottomNav.tsx), [Sidebar.tsx](/Users/jon/dev/Vesta/components/Sidebar.tsx), [Planner.tsx](/Users/jon/dev/Vesta/components/Planner.tsx), [RecipeLibrary.tsx](/Users/jon/dev/Vesta/components/RecipeLibrary.tsx), and their sheets/modals.

### Phase 3: Personal data boundaries

- Move family consumers off personal day documents onto shared meal data plus narrowly scoped planning/participation data. Migrate required legacy planning fields before removing family access to personal day documents; verify existing family planning and shopping still work.
- Test Firestore permissions before claiming private tracking. This can be delivered as a separate prerequisite, but is a release requirement for that promise.
- Keep existing recipe ingredient quantities and manual shopping edits for this release; household headcount scaling needs a separate, verified quantity model.
- Main files: [storageService.ts](/Users/jon/dev/Vesta/services/storageService.ts), [groupService.ts](/Users/jon/dev/Vesta/services/groupService.ts), [firestore.rules](/Users/jon/dev/Vesta/firestore.rules).

### Phase 4: Verification and pilot

- Add targeted tests for planning onboarding without weight, preference persistence/account isolation, switching with retained history, unknown nutrition and edits that preserve nutrition. Verify shared edits never create another member’s intake log.
- Use emulator rule tests for owner-only health records and permitted shared actions. Exercise a mixed household across two accounts, including legacy data and a tracker resuming setup.
- Run relevant Vitest checks, the TypeScript check and production build; inspect both experiences on mobile/desktop and light/dark. Specifically check for calorie content flashing before preferences load and tracking prompts continuing in planning mode.
- Pilot with a mixed household: both people should independently plan or shop, while the tracker can still record intake. Defer voting, chores, child accounts and automatic portion scaling.

Based on the [research report](</Users/jon/dev/Vesta/reports/Family meal planning mode.md>). This is a short implementation outline; application code has not been changed.
