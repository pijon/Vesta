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
  tags: string[];
  servings: number;
  image?: string; // base64 data URL or external URL
  isFavorite?: boolean;
  isShared?: boolean;
  sharedBy?: string; // UID of sharer
  sharedAt?: number;
}

export type Meal = Recipe;


export interface DayPlan {
  date: string; // YYYY-MM-DD
  meals: Recipe[];
  completedMealIds: string[]; // IDs of meals marked as eaten
  tips?: string;
  totalCalories?: number;
  type?: 'fast' | 'non-fast'; // For 5:2 diet
}

export interface WeightEntry {
  date: string;
  weight: number;
}

export interface UserStats {
  startWeight: number; // @deprecated - derived from weightHistory[0]
  currentWeight: number;
  goalWeight: number;
  name?: string; // New field for user name
  dailyCalorieGoal: number; // Used for "fast" days in 5:2, or every day in daily mode
  dailyWaterGoal: number; // in ml
  weightHistory: WeightEntry[];
  dietMode?: 'daily' | '5:2'; // Default 'daily'
  nonFastDayCalories?: number; // Target for non-fast days (e.g. 2000)
  dailyWorkoutCalorieGoal?: number; // Daily calorie burn target for workouts
  dailyWorkoutCountGoal?: number; // Daily target for number of workouts (default 1)
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
  // Note: recipes are looked up from aggregatedIngredients dynamically
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
  cachedParsedIngredients: ParsedIngredient[];
  cachedAggregatedIngredients: AggregatedIngredient[];
  ingredientsHash: string;
  selectedMealIds?: string[];
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
  TODAY = 'TODAY',          // Real-time daily tracking
  ANALYTICS = 'ANALYTICS',  // Historical trends & insights (merged TRENDS + WEEKLY)
  PLANNER = 'PLANNER',
  RECIPES = 'RECIPES',
  SHOPPING = 'SHOPPING',
  SETTINGS = 'SETTINGS',
  // Deprecated - for migration only
  DASHBOARD = 'TODAY',      // Alias
  TRENDS = 'ANALYTICS',     // Alias
  WEEKLY = 'ANALYTICS'      // Alias
}

// --- Fasting ---
export type FastingProtocol = '12:12' | '16:8' | '14:10' | '18:6' | '20:4' | 'custom';

export interface FastingConfig {
  protocol: FastingProtocol;
  targetFastHours: number;
}

export interface FastingState {
  lastAteTime: number | null; // Timestamp of last food log - used to calculate time since last ate
  config: FastingConfig;
}

export interface FastingEntry {
  id: string;
  startTime: number;
  endTime: number;
  durationHours: number;
  isSuccess: boolean; // Reached target?
}

// --- Group / Family ---
export interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  inviteCode: string; // 6-digit code
  memberIds: string[];
}

// --- Developer Mode ---
export interface FeatureFlags {
  enableExperimentalRecipes: boolean;
  enableAdvancedAnalytics: boolean;
  enableGroupSharing: boolean;
  enableAIFeatures: boolean;
  showDebugInfo: boolean;
}

export interface DevSettings {
  featureFlags: FeatureFlags;
}