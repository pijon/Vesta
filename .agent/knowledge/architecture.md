# Architecture Overview

**Source:** `CLAUDE.md`

## Application Structure
- **Entry:** `index.tsx` → `App.tsx` (Single Page App)
- **State Pattern:**
    - **Global State:** Centralized in `App.tsx` (simple view-based state).
    - **Persistence:** `storageService.ts` syncs `App.tsx` state to Firebase Firestore.
    - **Auth:** `AuthContext` handles Firebase Authentication.
    - **No Redux/Zustand:** Intentionally simple per `rules.md`.

## Key Data Flows
### 1. Meal Tracking Loop
1. User checks meal in **Today View**.
2. `App.tsx`: `toggleMeal()` updates `DayPlan`.
3. `App.tsx`: `handleLogMeal()` syncs to `DailyLog` (Food History).
4. `storageService`: Persists both Plan and Log to Firebase.
5. UI Updates.

### 2. Calorie Calculation
- **Consumed:** Sum of `DailyLog.items`.
- **Burned:** Sum of `DailyLog.workouts`.
- **Net:** Consumed - Burned.
- **Target:** `UserStats.dailyCalorieGoal` (usually 800) + Burned (optional logic).

## Component Architecture
- **Views:** Managed by `AppView` enum (TODAY, ANALYTICS, PLANNER, etc.).
- **Family navigation:** Family has tabs for its members/updates and its shared shopping list.
  Shopping keeps the `/shopping` route and selects Family in the mobile bar and desktop sidebar.
  Planner focuses on the meal plan and has no secondary tabs.
- **Experiences:** one app shell (`TrackerApp` in `App.tsx`) serves both "Plan meals" and "Plan meals
  and track nutrition", from `setup.preferences.experience`. Plan meals' nav is Today, Planner, Recipes,
  Shopping and Family (`navItemsFor` in `MobileBottomNav`): no Analytics (its route opens Today), and
  Shopping is its own item, so Family has no Family/Shopping tabs there (`isNavCurrent` takes the
  experience). It gets its own meal-focused Today (`PlanToday`: the next meal
  in the hero, today's meals with "not eating" for family meals, shortcuts and tomorrow; no calories or
  ticks), passes `experience` to Planner (no calories, fast
  days or calorie-driven planning) and RecipeLibrary (recipes keep their calories; the editor has no
  nutrition fields), and has no eaten action. Switching
  only changes what's shown, so nothing remounts: `AccountApp` applies the choice at once and saves it
  behind, switching back if the save fails. Setup reads from a refresh are dropped if the setup changed
  here after they started (`setupVersion`), and saved stats merge into the current setup (`onStatsChange`).
- **Reminders and experience:** the scheduled `sendReminders` function (`functions/src/reminders.ts`)
  reads `users/{uid}/data/preferences` via `reminderMode` (`functions/src/reminderMode.ts`). Plan meals (or
  unfinished tracking setup) is quiet: due reminders are marked sent without sending, so switching back
  doesn't deliver a backlog. No saved choice means tracking (older accounts); an unreadable one sends
  nothing and is logged. Reminder settings in `reminders/{uid}` are kept as they are.
- **Modals:** Rendered via `Portal` component.
- **Widgets:** Self-contained UI blocks (e.g., `CaloriesHero`, `TodayStrip`, `CoachCard`) getting props from `App.tsx`.

## Tech Stack
- **Framework:** React 19 + Vite
- **Language:** TypeScript (Strict)
- **Styling:** TailwindCSS v4
- **AI:** Google Gemini 2.0 (`geminiService.ts`)
- **Backend:** Firebase (Auth + Firestore)
