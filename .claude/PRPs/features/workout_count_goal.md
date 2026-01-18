# PRP: Implement Workout Count Goal

## 🎯 Objective
**User Story:** As a user, I want to track the number of workouts I finish per day (e.g., aim for 1 session) rather than an arbitrary calorie burn target, while still seeing my total burned active calories.

**Visual Goal:** Update the `WorkoutWidget` to emphasize the workout count (e.g., "1 / 1 Sessions") as the primary progress indicator. The progress bar fills as I complete sessions. Active calories are displayed as a secondary metric to the widget.

## 🛡️ Hazards & Gotchas (Strict Enforcement)
* [x] **Aesthetics:** Retain the existing `var(--workout)` color theme (Purple/Pink/Orange) defined in CSS variables.
* [x] **Data Integrity:** Add `dailyWorkoutCountGoal` to `UserStats` without breaking existing `dailyWorkoutCalorieGoal` (optional: deprecate it or keep it unused).
* [x] **Responsiveness:** Ensure the new text layout fits within the widget on mobile and desktop.
* [x] **Defaults:** Ensure `dailyWorkoutCountGoal` defaults to `1` if undefined.

## 📋 Implementation Plan
### Phase 1: Data & Types
* **File:** `src/types.ts`
  * Add `dailyWorkoutCountGoal?: number` to `UserStats`.
* **File:** `src/constants.ts`
  * Add `dailyWorkoutCountGoal: 1` to `DEFAULT_USER_STATS`.

### Phase 2: Logic & Settings Component
* **File:** `src/components/SettingsView.tsx`
  * Change the "Daily Workout Goal (kcal)" input to "Daily Workout Target (sessions)".
  * Bind the input to `formStats.dailyWorkoutCountGoal`.
  * Default to `1` if value is missing.
  * (Optional) Keep or remove the calorie goal input? User explicitly said "better to set a target of number of workouts". I will replace the input to avoid confusion.

### Phase 3: Widget Update
* **File:** `src/components/WorkoutWidget.tsx`
  * Update interface `WorkoutWidgetProps` to take `dailyCountGoal` (number) instead of `dailyGoal` (calories).
  * Calculate `workoutCount` = `workouts.length`.
  * Update Progress Bar: `(workoutCount / dailyCountGoal) * 100`.
  * **Main Text:** Display `workoutCount` (Large) with `/ {dailyCountGoal}` (Small).
  * **Secondary Text:** Display `{caloriesBurned} kcal burned` (highlighted badge or similar).
  * **Indicator:** Checkmark if `workoutCount >= dailyCountGoal`.

### Phase 4: Integration
* **File:** `src/components/TrackToday.tsx`
  * Pass `dailyCountGoal={stats.dailyWorkoutCountGoal ?? 1}` to `WorkoutWidget`.
