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
- **Modals:** Rendered via `Portal` component.
- **Widgets:** Self-contained UI blocks (e.g., `HydrationWidget`) getting props from `App.tsx`.

## Tech Stack
- **Framework:** React 19 + Vite
- **Language:** TypeScript (Strict)
- **Styling:** TailwindCSS v4
- **AI:** Google Gemini 2.0 (`geminiService.ts`)
- **Backend:** Firebase (Auth + Firestore)
