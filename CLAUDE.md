# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Vesta** is a family-centric nutrition and meal-planning PWA ("Digital Hearth"): meal plans, food/workout/weight/hydration logging, fasting, recipes, shopping lists and family groups. React 19 + Vite + TypeScript + Tailwind v4, backed by Firebase (Auth, Firestore, Storage, Hosting) with Google Gemini for AI features. `agents.md` holds the long-form agent persona and rules; this file summarizes what matters.

## Commands

```bash
npm install
npm run dev          # Vite dev server on http://localhost:3000
npm run build        # writes public/version.json, then vite build → dist/
npm run preview
npx tsc --noEmit     # type check (there is no lint or test script)
firebase deploy --only hosting            # serves dist/ (SPA rewrite to index.html)
firebase deploy --only firestore:rules    # also firestore:indexes, storage
```

- `.env.local` (gitignored) must define `VITE_GOOGLE_GENAI_API_KEY` and the six `VITE_FIREBASE_*` keys; `npm run build` fails if any is missing. Recover the Firebase values with `npx firebase-tools apps:sdkconfig WEB`.
- There is no test runner. `scripts/test-recipe-parsing.ts` is an ad-hoc script.
- Admin scripts in `scripts/` (`copyRecipes.cjs`, `setDeveloperClaim.cjs <uid>`) need `scripts/serviceAccountKey.json`, which is gitignored. See `scripts/README.md`.

## Architecture

Flat layout with no `src/`: `App.tsx`, `index.tsx`, `types.ts` and `constants.ts` live at the root, alongside `components/`, `services/`, `contexts/`, `hooks/` and `utils/`. The `@/` alias maps to the repo root.

- **State lives in `App.tsx`.** It holds today's and tomorrow's `DayPlan`, `DailyLog`, `UserStats`, `FastingState`, dark mode and modal state, and passes them down as props. Do not add Redux or Zustand. Contexts exist only for auth (`AuthContext`) and dev-mode feature flags (`DevModeContext`).
- **Views and routing:** the `AppView` enum in `types.ts` (TODAY, ANALYTICS, PLANNER, RECIPES, SHOPPING, SETTINGS) is mapped by hand to react-router paths in `App.tsx` (`/today`, `/mealplanner`, …). To add a view, update the enum, both path maps in `App.tsx`, the `MobileBottomNav` items (the only primary navigation) and the `AnimatePresence` switch.
- **Persistence (`services/storageService.ts`):** every Firestore read and write goes through this file, under `users/{uid}/…`. Collections include `recipes`, `days/{YYYY-MM-DD}`, `data/*` (stats, shopping, etc.), `summaries`, `pantry` and `fasting`.
  - **Cache-first:** `utils/cacheService.ts` mirrors data in localStorage (`fast800_cache_*` keys, kept from the app's earlier Fast800 name). `App.tsx` initializes state from the cache, then refreshes from Firestore. Saves update the cache optimistically before writing.
  - **Normalized day plans:** `DayPlan.meals` is stored as `PlannedMeal[]` (references) and hydrated into full `Recipe[]` on read (`hydratePlannedMeals` / `dehydrateMeal`). Never write full recipes into `days` docs. Each planned meal carries a `slot` (breakfast, lunch, dinner, snack), an `instanceId` (what `completedMealIds` stores), `cookingServings`, sides and packed/leftover flags; helpers live in `utils/planUtils.ts`. Days are nourish days unless `type: 'fast'`.
  - **Migrations run at read time,** or through the `migrate*` functions triggered by `components/MigrationRunner.tsx`. Legacy shapes still exist in production data.
  - Recipe images go to Firebase Storage at `users/{uid}/recipe-images/`, not base64 in Firestore.
- **Family groups (`services/groupService.ts`):** `groups/{groupId}` with `shared_recipes` and `dinners/{YYYY-MM-DD}` (the family's shared dinner plan: meals planned in the dinner slot while in a group are stored there, keyed by `instanceId`, and merged into every member's `DayPlan` with `familyDinner: true`; `saveDayPlan` splits them back out). Users carry a `groupId`. Family plans and recipes are read across member uids, so check `firestore.rules` whenever you add a cross-user read.
- **Security rules:** a new Firestore subcollection needs a matching `match` block in `firestore.rules`, or reads fail at runtime.
- **AI (`services/geminiService.ts`):** uses `@google/genai` with JSON `responseSchema` structured output. Model IDs are in `constants.ts` (`GEMINI_TEXT_MODEL`, `GEMINI_FAST_MODEL`). Generate IDs locally with `crypto.randomUUID()`; never trust IDs returned by the AI.
- **Feature flags:** `useDevMode().isFeatureEnabled('flag')` from `contexts/DevModeContext.tsx`. Dev status comes from a Firebase custom claim set by `scripts/setDeveloperClaim.cjs`. See `.agent/skills/feature-switch/SKILL.md`.
- **Modals** render through `components/Portal.tsx`.

## Rules

- **Design system (direction C, "bright and modern"):** read [.agent/knowledge/design_system.md](.agent/knowledge/design_system.md) before styling. The full spec is the Vesta design system artifact (https://claude.ai/artifact/W9cu6wcRWW9agjtjn7EJU1).
  - Type: Figtree for body and UI text (`font-sans`); Nunito (`font-display`, weight 800) for titles, headings and big figures. `font-serif` is an alias of `font-display` kept for old markup. Solid surfaces (`bg-surface` + `border-border`), no glass, blur or gradients.
  - One bold `primary` block per screen; primary buttons are ink (`btn-primary`); metrics use `tile-*` / `*-bg` / `*-text` tokens.
  - Use semantic tokens. Stock Tailwind palette colors (`blue-*`, `red-*`, `emerald-*`) are banned. Never fade text with opacity (`text-charcoal/60`); use `text-muted`.
  - No pure white surfaces, no uppercase eyebrows, and no red "shame" states for calories (over target is `warning`).
- **Dark mode:** before using a CSS variable, confirm `index.css` defines it under both `:root` and `.dark`. Many recent fixes were dark-mode regressions.
- **Mobile-first** (around 375px). Build layouts with `flex-col md:flex-row`.
- **Types and IDs:** no `any`. Types go in `types.ts` or the component file. Store dates as `YYYY-MM-DD` strings. Create IDs with `crypto.randomUUID()`.
- Functional components only, in PascalCase, in a flat `components/` folder (subfolders: `achievements/`, `analytics/`; `_archive/` is dead code).

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
