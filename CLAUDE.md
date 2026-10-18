# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Vesta** is a family-centric nutrition and meal-planning PWA ("Digital Hearth"): meal plans, food/workout/weight/hydration logging, fasting, recipes, shopping lists and family groups. React 19 + Vite + TypeScript + Tailwind v4, backed by Firebase (Auth, Firestore, Storage, Hosting) with Google Gemini for AI features. `agents.md` holds the long-form agent persona and rules; this file summarizes what matters.

## Commands

```bash
npm install
npm run dev          # Vite dev server on http://localhost:3000
npm run build        # writes public/version.json, then vite build → dist/
npm run preview
npm test             # Vitest, about 0.3 s (npm run test:watch to re-run on save)
npx tsc --noEmit     # type check (there is no lint script)
firebase deploy --only hosting            # serves dist/ (SPA rewrite to index.html)
firebase deploy --only firestore:rules    # also firestore:indexes, storage
```

- `.env.local` (gitignored) must define the six `VITE_FIREBASE_*` keys; `npm run build` fails if any is missing. Recover them with `npx firebase-tools apps:sdkconfig WEB`.
- The Gemini key lives only in the `GEMINI_API_KEY` Functions secret (`firebase functions:secrets:set GEMINI_API_KEY`). Never put it in a `VITE_` variable: those ship in the bundle.
- Tests are Vitest, in `*.test.ts` files next to the code they cover (`vitest.config.ts`, kept separate from `vite.config.ts`). They run in America/Los_Angeles so local-vs-UTC date bugs show up, with an in-memory `localStorage` (`test/setup.ts`). `services/storageService.test.ts` and `services/groupService.test.ts` run the real day-plan, recipe and family code against an in-memory Firestore (`test/fakeFirestore.ts`, which doesn't model security rules); extend them when changing how plans, recipes, family dinners or families are stored. No test needs Firebase, the network or Java. `scripts/test-recipe-parsing.ts` is an ad-hoc script, not part of `npm test`.
- Admin scripts in `scripts/` (`copyRecipes.cjs`, `setDeveloperClaim.cjs <uid>`) need `scripts/serviceAccountKey.json`, which is gitignored. See `scripts/README.md`.

## Architecture

Flat layout with no `src/`: `App.tsx`, `index.tsx`, `types.ts` and `constants.ts` live at the root, alongside `components/`, `services/`, `contexts/`, `hooks/` and `utils/`. The `@/` alias maps to the repo root.

- **State lives in `App.tsx`.** It holds today's and tomorrow's `DayPlan`, `DailyLog`, `UserStats`, `FastingState`, dark mode and modal state, and passes them down as props. Do not add Redux or Zustand. Contexts exist only for auth (`AuthContext`) and dev-mode feature flags (`DevModeContext`).
- **Views and routing:** the `AppView` enum in `types.ts` (TODAY, ANALYTICS, PLANNER, RECIPES, SHOPPING, FAMILY, SETTINGS) is mapped by hand to react-router paths in `App.tsx` (`/today`, `/mealplanner`, …). To add a view, update the enum, both path maps in `App.tsx`, the `NAV_ITEMS` in `MobileBottomNav` (shared by the phone tab bar and the `Sidebar`, which also holds Settings; Family is the fifth item). SHOPPING has no nav item of its own: `PlannerTabs` switches between it and PLANNER, and `isNavCurrent` keeps Planner highlighted and the `AnimatePresence` switch.
- **Persistence (`services/storageService.ts`):** every Firestore read and write goes through this file (group and family-recipe moves through `groupService.ts`), under `users/{uid}/…`. Collections include `days/{YYYY-MM-DD}`, `data/*` (stats, shopping, etc.), `summaries`, `pantry` and `fasting`. Recipes are the family's, in `groups/{groupId}/recipes` (see Family groups).
  - **Cache-first:** `utils/cacheService.ts` mirrors data in localStorage (`fast800_cache_*` keys, kept from the app's earlier Fast800 name). `App.tsx` initializes state from the cache, then refreshes from Firestore. Saves update the cache optimistically before writing.
  - **Normalized day plans:** `DayPlan.meals` is stored as `PlannedMeal[]` (references to the family's recipes; a legacy `ownerId` on a reference is ignored) and hydrated into full `Recipe[]` on read (`hydratePlannedMeals` / `dehydrateMeal`). Never write full recipes into `days` docs. Each planned meal carries a `slot` (breakfast, lunch, dinner, snack), an `instanceId` (what `completedMealIds` stores), sides and packed/leftover flags; helpers live in `utils/planUtils.ts`. Days are nourish days unless `type: 'fast'`.
  - **Migrations run at read time,** or through the `migrate*` functions in `components/MigrationRunner.tsx` (a manual tool that nothing renders at the moment). Legacy shapes still exist in production data.
  - Recipes keep their ingredient lines read for the shopping list in `parsedIngredients` (by line text). `saveRecipe` reads plain lines in code (`utils/ingredientParse.ts`); the shopping list sends only the rest to the AI and writes the result back to the recipe.
  - Recipe images go to Firebase Storage at `users/{uid}/recipe-images/`, not base64 in Firestore.
- **Family groups (`services/groupService.ts`):** every user has a family. `getMyGroupId()` creates a family of one on first use and copies a member's old `users/{uid}/recipes` into it once (tracked in the group's `legacyRecipesMoved`; the originals stay as a backup). Joining is only possible from a family of one, whose recipes move along; leaving starts a new family with copies of the recipes the user added or still has in their own day plans. The admin (`familyAdmin`: the owner, or the longest-standing member once the owner has left) can remove others with `removeMember`, which leaves copies of their recipes in `groups/{groupId}/departures/{uid}/recipes` (readable by them after removal, collected into their new family on next load) and replaces the invite code; an owner who leaves hands the family over. All recipes live in `groups/{groupId}/recipes`: any member can edit or delete them, `createdBy` records who added one, and favourites are per member (`favoritedBy`, read as `isFavorite`). Sharing (`familyData`, family meals) only switches on with two or more members. The group also holds `dinners/{YYYY-MM-DD}` (named when only dinners were shared): the family meals of that day, in any slot, keyed by `instanceId` and merged into every member's `DayPlan` with `familyMeal: true`; `saveDayPlan` splits them back out. New dinners start out as family meals, and the Planner's meal sheet switches any meal between Family and Just me. A member who isn't eating one is in its `notEating` (written only by `saveFamilyMealOut`); for them it sits in `DayPlan.familyMealsOut`, out of `meals` and the day's calories. The group's `activity/{id}` holds the family's updates (`services/activityService.ts`: recipe added, family meal planned, not eating, joined) for 30 days, shown on the Family page with an unread dot on its nav item; each update's id comes from what it's about, so undoing the thing removes it. The family shares one live shopping list (`services/shoppingService.ts`): one doc per item in `groups/{groupId}/shoppingItems`, each planned meal's share of an item under `sources.{instanceId}` (so members adding or ticking at once don't overwrite each other), and the meals added in `groups/{groupId}/shopping/list`. Amounts follow each recipe's servings and add up in `utils/shoppingList.ts`; members can also type their own items. What the family has at home is `groups/{groupId}/pantry` (one doc per food, by name whatever the unit); a mark counts for 30 days, and meal ingredients marked go to a collapsed "Probably at home" section (typed items never do). Each user's list and pantry from before (`users/{uid}/data/shopping` and `pantry`) move into the family's once. Users carry a `groupId`. Family plans and recipes are read across member uids, so check `firestore.rules` whenever you add a cross-user read.
- **Security rules:** a new Firestore subcollection needs a matching `match` block in `firestore.rules`, or reads fail at runtime.
- **AI (`services/geminiService.ts`):** builds the prompts and JSON `responseSchema`s, and sends every request through the `generateAi` callable (`functions/src/ai.ts`), which holds the key, allowlists models, enforces a per-user daily limit (`aiUsage/{uid}`) and falls back to Flash-Lite on 503/429. A new model ID must be added to that function's allowlist too. Model IDs are in `constants.ts` (`GEMINI_MODEL_PRIMARY`, `GEMINI_MODEL_STABLE`, and `GEMINI_FAST_MODEL` for quick calls). Generate IDs locally with `crypto.randomUUID()`; never trust IDs returned by the AI.
- **Food logging (`components/FoodEntryModal.tsx`):** the user's own numbers come first. `knownFoodsData` (`services/pageData.ts`) holds their recipes (per portion) and foods logged in the last 90 days; typing shows matches (`utils/foodMatch.ts`), an exact name skips the AI, and mentioned foods go into the AI prompt to be reused. Barcodes are read by `utils/barcode.ts` (native `BarcodeDetector`, else the zxing-wasm ponyfill with the `.wasm` served from the app) and looked up in Open Food Facts (`services/foodDatabase.ts`). `barcode-detector` and `zxing-wasm` are pinned to matching versions: upgrade them together.
- **Feature flags:** `useDevMode().isFeatureEnabled('flag')` from `contexts/DevModeContext.tsx`. Dev status comes from a Firebase custom claim set by `scripts/setDeveloperClaim.cjs`. See `.agent/skills/feature-switch/SKILL.md`.
- **Modals** render through `components/Portal.tsx`.

## Rules

- **Design system ("Market day"):** read [.agent/knowledge/design_system.md](.agent/knowledge/design_system.md) before styling. The full spec is the Vesta design system artifact (https://claude.ai/artifact/W9cu6wcRWW9agjtjn7EJU1).
  - Type: DM Sans for body and UI text (`font-sans`); Bricolage Grotesque (`font-display`, weight 800) for titles, headings, big figures and nav labels. `text-xs` is 13px and `text-sm` 15px (set in `@theme`). `font-serif` is an alias of `font-display` kept for old markup.
  - Palette: a butter page (`background`), cream `surface` cards with no border in light mode (dark mode keeps `border-border`), bright tomato `hero`, deep tomato `primary`, leaf green `secondary`, and a tint per metric (`tile-*` / `*-bg` / `*-text`). No glass, blur or gradients.
  - One bold block per screen (the tomato `hero`). On Today the next meal to eat is a highlighted row on Today's plate, not a second block. Primary buttons are ink (`btn-primary`), and every selected state is an ink pill (tabs, sidebar item, segments, chips, today's date).
  - Round shapes: buttons, chips, badges, meal plates and `icon-tile` are fully round; cards 24px, hero 28px, sheets 32px. On phones the tab bar is a floating card-colour pill; from the `nav:` variant (md width and 640px tall, so a phone in landscape keeps the pill) the sidebar is a floating card-colour panel. Use `nav:`, not `md:`, for anything that depends on which nav is showing. The logo is `components/VestaMark.tsx` (icon sources in `assets/icon/`).
  - Use semantic tokens. Stock Tailwind palette colors (`blue-*`, `red-*`, `emerald-*`) are banned. Never fade text with opacity (`text-charcoal/60`); use `text-muted`.
  - No pure white surfaces, no uppercase eyebrows, and no red "shame" states for calories (over target is `warning`).
- **Dark mode:** before using a CSS variable, confirm `index.css` defines it under both `:root` and `.dark`. Many recent fixes were dark-mode regressions.
- **Mobile-first** (around 375px). Build layouts with `flex-col md:flex-row`.
- **Types and IDs:** no `any`. Types go in `types.ts` or the component file. Store dates as `YYYY-MM-DD` strings. Create IDs with `crypto.randomUUID()`.
- Functional components only, in PascalCase, in a flat `components/` folder (one subfolder: `analytics/`).

## Agent resources

- **Knowledge:** [.agent/knowledge/](.agent/knowledge/) covers the design system, architecture, data schema, colors and spacing. The schema docs may lag the code; `storageService.ts` is authoritative. For example, `firebase-ops` still lists `plans`/`logs` collections where the code uses `days`.
- **Skills** are in [.agent/skills/](.agent/skills/): `development-guide`, `feature-switch`, `firebase-ops`, `frontend-design`, `dark-mode-design`, `design-system-audit`, `brainstorming` and others.
- **Workflows** are in [.agent/workflows/](.agent/workflows/), for example `create-feature.md` for new features and `bug-interactive.md` for bugs. Plans, PRDs and reports are kept in `.agent/plans`, `.agent/prds` and `.agent/reports`.

## Code exploration with dora

Use `dora` (installed globally) instead of Grep/Glob for code navigation. Use Grep only for non-code files or when dora fails. See `.agent/skills/dora/SKILL.md`.

```bash
dora status                       # index health
dora file <path>                  # symbols, deps, dependents
dora symbol <query>               # find symbols
dora refs <symbol>                # find references
dora deps|rdeps <path> [--depth N]
dora changes <ref>                # impact of changes since a git ref
dora treasure | lost | cycles     # hotspots, unused exports, cycles
dora docs search <query>
dora query "<sql>"                # read-only SQL over the index
```
