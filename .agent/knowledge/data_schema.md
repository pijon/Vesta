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
