# Feature: Design System Migration - Widget Standardization

## Summary

Migrate **35 components** from legacy design tokens (`text-muted`, `text-main`, `bg-surface`, `bg-background`) to the new **Digital Hearth** design system. This ensures consistent aesthetics, proper dark mode support, and unified typography across all widgets, modals, views, and cards.

## User Story

As a **Vesta user**
I want **all widgets to have consistent styling and proper dark mode support**
So that **the app feels warm, cohesive, and premium in both light and dark themes**

## Problem Statement

Multiple components still use legacy semantic tokens (`text-muted`, `text-main`, `bg-surface`) that don't properly support dark mode and don't align with the new "Digital Hearth" aesthetic. This causes visual inconsistencies and poor contrast in dark mode.

## Solution Statement

Systematically replace all legacy tokens with the new semantic Hearth colors as defined in `.agent/knowledge/design_system.md`. Each component will receive both light mode and dark mode class variants.

## Metadata

| Field            | Value                     |
| ---------------- | ------------------------- |
| Type             | REFACTOR                  |
| Complexity       | HIGH                      |
| Systems Affected | 35 Components (Widgets, Modals, Views, Cards) |
| Dependencies     | None                      |
| Estimated Tasks  | 35                        |

---

## Complete Component List

**Core Widgets (5):**
CaloriesWidget, HydrationWidget, WeightWidget, WorkoutWidget, CompactStatsWidget

**Modals (5):**
RecipeEditModal, FoodEntryModal, WorkoutEntryModal, WeightEntryModal, IngredientRecipeModal

**Views (6):**
SettingsView, ShoppingList, FamilySettings, OnboardingWizard, LoginScreen, WeeklySummary

**Cards (4):**
RecipeCard, RecipeDetailModal, ShoppingItem, IngredientReviewCard

**Track Views (5):**
Track, TrackToday, TrackAnalytics, DualTrackSection, Planner

**Other (3):**
Header, MobileActionCards, AnalyticsSection

**Analytics (7):**
BalanceBurnChart, GoalProjectionCard, ConsistencyOverviewCard, PeriodicComparison, WeeklyHabitPillars, GoalsHistoryChart, CalorieBalanceChart

---

## Migration Rules

Apply these replacements consistently across ALL components:

| Legacy Token | Light Mode | Dark Mode |
|--------------|------------|-----------|
| `text-main` | `text-charcoal` | `dark:text-stone-200` |
| `text-muted` | `text-charcoal/60` | `dark:text-stone-400` |
| `bg-surface` | `bg-white` | `dark:bg-white/5` |
| `bg-background` | `bg-stone-50` | `dark:bg-[#1A1714]` |
| `bg-[var(--card-bg)]` | `bg-white` | `dark:bg-white/5` |
| `border-border` | `border-charcoal/10` | `dark:border-white/10` |

**Typography Rules:**
- All widget headings (`h3`) should use `font-serif`
- Headings: `text-charcoal dark:text-stone-200`
- Labels: `text-charcoal/60 dark:text-stone-400`

---

## Step-by-Step Tasks

Execute these in order. Each task is one component migration.

### Phase 1: Core Widgets (High Visibility)

#### Task 1: CaloriesWidget.tsx
- **File**: `components/CaloriesWidget.tsx`
- **Changes**:
  - Line 26: `bg-[var(--card-bg)]` → `bg-white dark:bg-white/5`
  - Line 32: `text-main` → `text-charcoal dark:text-stone-200`
  - Line 57: `text-muted` → `text-charcoal/60 dark:text-stone-400`
  - Line 65: `text-muted` → `text-charcoal/60 dark:text-stone-400`
  - Line 30: `border-border/30` → `border-charcoal/10 dark:border-white/10`
- **VALIDATE**: `npm run build`

#### Task 2: HydrationWidget.tsx
- **File**: `components/HydrationWidget.tsx`
- **Changes**:
  - Line 33: `bg-[var(--card-bg)]` → `bg-white dark:bg-white/5`
  - Line 37: `text-main` → `text-charcoal dark:text-stone-200`
  - Line 77: `text-muted` → `text-charcoal/60 dark:text-stone-400`
  - Line 91: `bg-background` → `bg-stone-50 dark:bg-[#1A1714]`
- **VALIDATE**: `npm run build`

#### Task 3: WeightWidget.tsx
- **File**: `components/WeightWidget.tsx`
- **Changes**:
  - Line 23: `bg-[var(--card-bg)]` → `bg-white dark:bg-white/5`
  - Line 29: `text-main` → `text-charcoal dark:text-stone-200`
  - Line 50: `text-muted` → `text-charcoal/60 dark:text-stone-400`
- **VALIDATE**: `npm run build`

#### Task 4: WorkoutWidget.tsx
- **File**: `components/WorkoutWidget.tsx`
- **Changes**:
  - Line 19: `bg-[var(--card-bg)]` → `bg-white dark:bg-white/5`
  - Line 24: `text-main` → `text-charcoal dark:text-stone-200`
  - Line 44: `text-muted` → `text-charcoal/60 dark:text-stone-400`
  - Line 57: `text-muted` → `text-charcoal/60 dark:text-stone-400`
- **VALIDATE**: `npm run build`

#### Task 5: CompactStatsWidget.tsx
- **File**: `components/CompactStatsWidget.tsx`
- **ACTION**: Apply same migration pattern
- **VALIDATE**: `npm run build`

### Phase 2: Modals

#### Task 6: RecipeEditModal.tsx
- **File**: `components/RecipeEditModal.tsx`
- **ACTION**: Replace all `text-muted`, `text-main`, `bg-surface`, `bg-background`
- **VALIDATE**: `npm run build`

#### Task 7: FoodEntryModal.tsx
- **File**: `components/FoodEntryModal.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 8: WorkoutEntryModal.tsx
- **File**: `components/WorkoutEntryModal.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 9: WeightEntryModal.tsx
- **File**: `components/WeightEntryModal.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 10: IngredientRecipeModal.tsx
- **File**: `components/IngredientRecipeModal.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

### Phase 3: User-Facing Views

#### Task 11: SettingsView.tsx
- **File**: `components/SettingsView.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 12: ShoppingList.tsx
- **File**: `components/ShoppingList.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 13: FamilySettings.tsx
- **File**: `components/FamilySettings.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 14: OnboardingWizard.tsx
- **File**: `components/OnboardingWizard.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 15: LoginScreen.tsx
- **File**: `components/LoginScreen.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 16: WeeklySummary.tsx
- **File**: `components/WeeklySummary.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

### Phase 4: Analytics Components

#### Task 17: BalanceBurnChart.tsx
- **File**: `components/analytics/BalanceBurnChart.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 18: GoalProjectionCard.tsx
- **File**: `components/analytics/GoalProjectionCard.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 19: ConsistencyOverviewCard.tsx
- **File**: `components/analytics/ConsistencyOverviewCard.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 20: PeriodicComparison.tsx
- **File**: `components/analytics/PeriodicComparison.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 21: WeeklyHabitPillars.tsx
- **File**: `components/analytics/WeeklyHabitPillars.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 22: GoalsHistoryChart.tsx
- **File**: `components/analytics/GoalsHistoryChart.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 23: CalorieBalanceChart.tsx
- **File**: `components/analytics/CalorieBalanceChart.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

### Phase 5: Cards

#### Task 24: RecipeCard.tsx
- **File**: `components/RecipeCard.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 25: RecipeDetailModal.tsx
- **File**: `components/RecipeDetailModal.tsx`
- **ACTION**: Verify remaining legacy tokens and fix
- **VALIDATE**: `npm run build`

#### Task 26: ShoppingItem.tsx
- **File**: `components/ShoppingItem.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 27: IngredientReviewCard.tsx
- **File**: `components/IngredientReviewCard.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

### Phase 6: Track Views

#### Task 28: Track.tsx
- **File**: `components/Track.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 29: TrackToday.tsx
- **File**: `components/TrackToday.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 30: TrackAnalytics.tsx
- **File**: `components/TrackAnalytics.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 31: DualTrackSection.tsx
- **File**: `components/DualTrackSection.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 32: Planner.tsx
- **File**: `components/Planner.tsx`
- **ACTION**: Replace all legacy tokens (LARGE FILE - many occurrences)
- **VALIDATE**: `npm run build`

### Phase 7: Other Components

#### Task 33: Header.tsx
- **File**: `components/Header.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 34: MobileActionCards.tsx
- **File**: `components/MobileActionCards.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

#### Task 35: AnalyticsSection.tsx
- **File**: `components/AnalyticsSection.tsx`
- **ACTION**: Replace all legacy tokens
- **VALIDATE**: `npm run build`

---

## Validation Commands

### Level 1: Type Check
```bash
npm run build
```
**EXPECT**: Exit 0, no errors

### Level 2: Visual Verification
Manually verify each widget in both light and dark mode:
- [ ] Text is readable in both modes
- [ ] Backgrounds have proper contrast
- [ ] Borders are visible but subtle
- [ ] Headings use serif font

---

## Acceptance Criteria

- [ ] All 35 components migrated to new design tokens
- [ ] All `text-muted` → `text-charcoal/60 dark:text-stone-400`
- [ ] All `text-main` → `text-charcoal dark:text-stone-200`
- [ ] All `bg-surface` → `bg-white dark:bg-white/5`
- [ ] All `bg-background` → appropriate Hearth color
- [ ] Build passes with no errors
- [ ] Dark mode verified visually

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing dark mode | LOW | MEDIUM | Verify each component individually after change |
| Missing replacement in large file | MEDIUM | LOW | Use grep to confirm no legacy tokens remain |

---

## Notes

This is a bulk refactor. Each task follows the exact same pattern - find and replace legacy tokens with their Hearth equivalents. The complexity comes from the volume of files, not the difficulty of individual changes.

**Execute with:** `/prp-implement .agent/plans/design-migration-widgets.plan.md`
