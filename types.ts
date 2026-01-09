export interface Recipe {
  id: string;
  name: string;
  description?: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  ingredients: string[];
  instructions?: string[];
  type: 'breakfast' | 'main meal' | 'snack' | 'light meal' | 'any';
  servings: number;
  image?: string; // base64 data URL or external URL
}

export type Meal = Recipe;

export interface DayPlan {
  date: string; // YYYY-MM-DD
  meals: Recipe[];
  completedMealIds: string[]; // IDs of meals marked as eaten
  tips?: string;
  totalCalories?: number;
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface UserStats {
  startWeight: number;
  currentWeight: number;
  goalWeight: number;
  dailyCalorieGoal: number;
  dailyWaterGoal: number; // in ml
  weightHistory: WeightEntry[];
}

export interface GroceryItem {
  name: string;
  checked: boolean;
}

export interface ShoppingState {
  checked: string[];
  removed: string[];
}

// Enhanced shopping list types
export interface ParsedIngredient {
  id: string;
  originalText: string;  // e.g., "2 tbsp olive oil"
  name: string;          // e.g., "olive oil"
  quantity: number;      // e.g., 2
  unit: string;          // e.g., "tbsp"
  recipeId: string;
  recipeName: string;
}

export interface AggregatedIngredient {
  name: string;
  totalQuantity: number;
  unit: string;
  recipes: Array<{ id: string; name: string; quantity: number }>;
  originalIngredients: ParsedIngredient[];
}

export interface PurchasableItem {
  ingredientName: string;
  requiredQuantity: string;      // e.g., "3 tbsp"
  purchasableQuantity: string;   // e.g., "500ml bottle"
  purchasableSize: string;       // e.g., "500ml"
  rationale?: string;
}

export interface PantryInventory {
  items: PantryItem[];
  lastUpdated: number;
}

export interface PantryItem {
  name: string;
  markedAt: number;
  persistent: boolean;
}

export interface EnhancedShoppingState {
  pantryChecks: Record<string, boolean>;
  purchased: string[];
  removed: string[];
  lastGeneratedDate: string;
  cachedPurchasableItems: PurchasableItem[];
}

export interface FoodLogItem {
  id: string;
  name: string;
  calories: number;
  timestamp: number;
}

export interface WorkoutItem {
  id: string;
  type: string;
  caloriesBurned: number;
  timestamp: number;
}

export interface DailyLog {
  date: string;
  items: FoodLogItem[];
  workouts: WorkoutItem[];
  waterIntake: number; // in ml
}

export interface DailySummary {
  date: string;
  caloriesConsumed: number;
  caloriesBurned: number;
  netCalories: number;
  workoutCount: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  PLANNER = 'PLANNER',
  RECIPES = 'RECIPES',
  SHOPPING = 'SHOPPING',
  JOURNAL = 'JOURNAL',
  ANALYTICS = 'ANALYTICS'
}

// --- Fasting ---
export type FastingProtocol = '12:12' | '16:8' | '14:10' | '18:6' | '20:4' | 'custom';

export interface FastingConfig {
  protocol: FastingProtocol;
  targetFastHours: number;
}

export interface FastingState {
  isFasting: boolean;
  startTime: number | null; // Timestamp when current fast started
  endTime: number | null;   // Timestamp when last fast ended (or planned end)
  config: FastingConfig;
}

export interface FastingEntry {
  id: string;
  startTime: number;
  endTime: number;
  durationHours: number;
  isSuccess: boolean; // Reached target?
}