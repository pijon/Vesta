# Data Schema Reference

Quick reference for core Fast800-Tracker data types.
**Source:** `src/types.ts`

## Core Domain

### Recipe (Meal)
**Primary unit of food content.**
```typescript
interface Recipe {
  id: string;             // UUID
  name: string;
  calories: number;       // kcal per serving
  protein?: number;
  fat?: number;
  carbs?: number;
  servings: number;
  ingredients: string[];  // Raw text lines
  instructions?: string[];
  tags: string[];         // e.g. "Breakfast", "High Protein"
  image?: string;         // Base64 or URL
  isFavorite?: boolean;
}
```

### DayPlan
**A planned day's meals.**
```typescript
interface DayPlan {
  date: string;           // YYYY-MM-DD
  meals: Recipe[];
  completedMealIds: string[]; // Track eaten status
  totalCalories?: number;
  type?: 'fast' | 'non-fast'; // Diet mode
}
```

### DailyLog
**Actual executed day (consumed + burned).**
```typescript
interface DailyLog {
  date: string;           // YYYY-MM-DD
  items: FoodLogItem[];   // Ad-hoc or synced items
  workouts: WorkoutItem[];
  waterIntake: number;    // ml
}
```

### Recipe nutrition availability
Calories can be unknown (a planning adult saves a recipe without them). `Recipe.calories` stays a
number for compatibility, so **never read it as a complete amount**: go through `utils/recipeNutrition.ts`.

- **Stored:** `calorieStatus?: 'known' | 'unknown'` and `caloriesEstimated?: boolean` on recipes and on
  custom meals in `days` docs. Unknown is stored as `calorieStatus: 'unknown'` (the number is a 0 slot);
  a known zero is `0` with `'known'`. Optional macros left blank are absent, not 0.
- **Derived:** `calorieAvailability(recipe)` is `known | unknown | unconfirmed`. Unknown wins over a stale
  number (`'unknown'`, `quick.noCalories`, `isMissing`, non-numeric). An unmarked historical library `0`
  is `unconfirmed` (shown as "needs confirmation"); it is never bulk-relabelled or written back on read.
- **Totals:** `mealNutrition` / `dayNutrition` add a root and all nested sides into `knownCalories`,
  `unknownParts`, `unconfirmedParts`, `complete`, `estimated`, `budget`. `mealCalories` / `dayCalories` are
  known subtotals only: anything that claims a fit, a remaining budget or a calorie sort checks `complete`.
  `DayPlan.totalCaloriesComplete` records whether the stored `totalCalories` was complete.
- **Writes:** `saveRecipe(recipe, { nutrition })` runs a transaction. `'preserve'` (the default for an existing
  recipe: name, photo or ingredient edits, image migration) keeps the latest stored nutrition, so a family
  member's edit can't overwrite newer values; `'replace'` is for an explicit nutrition edit, a new recipe or
  import, and backup restore. Text/URL import keeps missing nutrition unknown; AI generation marks its
  numbers `caloriesEstimated`.

### Eating a planned meal
Every "eaten" action (Today's tick, "ate what was planned", eating out, the Planner and cook mode) calls
App's `onRequestPlannedIntake(entries)`. A meal whose whole amount (root + sides) isn't known, or is only a
budget, asks this person for their amount (`MealCaloriesSheet`) first; nothing is written until every answer
is in. Skip drops one meal; closing cancels the batch. The result is `{ status: 'saved', loggedKeys,
skippedKeys, items } | { status: 'cancelled' }`. Once the answers are in, the ticks show at once while
saving (App's `todayPlan`, and the Planner through the `onTick` callback); a failed save takes back only
the ticks it added and throws, and unticking works the same way in reverse.

`services/mealLogService.ts` then commits one owner-only transaction: the `logs/{date}` entry (linked by
`planInstanceId`, deduplicated on retry), the tick in `days/{date}.completedMealIds`, and fasting
(`data/fasting`, `data/fasting_history`). It never writes the shared meal, recipe or `groups/*`: a personal
amount or estimate (`FoodLogItem.caloriesEstimated`) lives only in the diary. Unticking, deleting a linked
entry, its exact Undo and editing it go through the same service. Transactions need the network: offline,
the tick goes back and the answer stays in the sheet with a retry, rather than being reported as saved. Existing numeric logs,
workouts and summaries are unchanged.

## User & Stats

### UserStats
```typescript
interface UserStats {
  currentWeight: number;
  goalWeight: number;
  dailyCalorieGoal: number; // e.g. 800
  weightHistory: WeightEntry[];
  dietMode?: 'daily' | '5:2';
}
```

### FastingState
```typescript
interface FastingState {
  lastAteTime: number | null; // Timestamp
  config: {
    protocol: '16:8' | '14:10' | etc;
    targetFastHours: number;
  }
}
```
