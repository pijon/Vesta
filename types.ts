export interface Recipe {
  id: string;
  name: string;
  description?: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  ingredients: string[];
  /** Ingredient lines read for the shopping list (by text; lines not read yet are missing) */
  parsedIngredients?: ParsedIngredientLine[];
  instructions?: string[];
  tags: string[];
  servings: number;
  image?: string; // base64 data URL or external URL
  /** Derived on read from favoritedBy: whether the current user favourited it. Never stored. */
  isFavorite?: boolean;
  /** Uids of the family members who favourited this recipe */
  favoritedBy?: string[];
  /** Uid of the member who added it to the family's recipes */
  createdBy?: string;
  isShared?: boolean;
  sharedBy?: string; // UID of sharer
  sharedAt?: number;
  ownerId?: string;    // UID of the member whose plan a meal comes from (family shopping list)
  ownerName?: string;  // Display name of that member, or of the member who added a recipe
  originalRecipeId?: string; // Reference to the original library recipe for hydration
  isLeftover?: boolean; // If true, this is a leftover from a previous meal
  isPacked?: boolean;   // If true, this is a packed lunch/meal
  sides?: Recipe[];     // Nested side dishes associated with this meal
  // Set on meals inside a DayPlan (see PlannedMealMeta)
  slot?: MealSlot;
  instanceId?: string;
  familyMeal?: boolean;
  addedBy?: string;
  /** Uids of the family members not eating a family meal */
  notEating?: string[];
  /** Planned reference whose library recipe no longer exists */
  isMissing?: boolean;
  /** Set on planned meals with no library recipe behind them (quick meals) */
  quick?: QuickMealInfo;
}

/** What a quick meal is: cooked at home (can have shopping items), eaten out, or ready-made */
export type QuickMealKind = 'home' | 'out' | 'ready';

export interface QuickMealInfo {
  /** Undefined on quick meals planned before kinds existed */
  kind?: QuickMealKind;
  /** Calories are a size preset or an AI estimate, shown with ≈ */
  estimated?: boolean;
  /** No calories given; `calories` is 0 and the UI says "kcal not set" */
  noCalories?: boolean;
  /** Eating out with the place still undecided: `calories` is a budget to stay within, not an estimate */
  budget?: boolean;
  /** The budget shrinks by its share of any unplanned eating (see withLiveBudgets) */
  autoBudget?: boolean;
  /** Only on a plan shown with live budgets: the budget as planned, which is what gets saved */
  plannedBudget?: number;
  /** On a decided eating-out meal that was eaten: the budget it was planned at */
  budgeted?: number;
  /** Where and what, kept apart so eating it can add the dish to the user's eating-out history */
  place?: string;
  dish?: string;
}

/** A dish the user has eaten out, remembered so it can be planned or picked again */
export interface EatingOutDish {
  id: string;
  place: string;
  /** Empty when only the place was given */
  dish: string;
  calories: number;
  protein?: number;
  /** How many times it was eaten */
  times: number;
  /** YYYY-MM-DD it was last eaten */
  lastHad: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Meal = Recipe;

// --- Normalized Meal Planning (Database Optimization) ---

/** Per-instance fields stored with every planned meal (all optional for legacy data) */
export interface PlannedMealMeta {
  slot?: MealSlot;
  /** Unique per planned meal; completedMealIds and leftovers point at it */
  instanceId?: string;
  isPacked?: boolean;
  isLeftover?: boolean;
  sides?: PlannedMeal[];
  /** Shared family meal, in any slot (stored in groups/{groupId}/dinners/{date}) */
  familyMeal?: boolean;
  /** Uid of the member who planned it */
  addedBy?: string;
  /** Uids of the family members not eating a family meal */
  notEating?: string[];
}

/** Lightweight reference to a library recipe */
export interface RecipeReference extends PlannedMealMeta {
  type: 'reference';
  /** Legacy: the library owner from when recipes lived under users/{uid}/recipes. Ignored on read. */
  ownerId?: string;
  recipeId: string;      // Points to groups/{groupId}/recipes/{id}
  servings: number;      // User's planned servings for this meal

  // OPTIONAL: Only present if user customized THIS specific meal instance
  overrides?: {
    calories?: number;   // If they manually adjusted
    name?: string;       // If they renamed this instance
  };
}

/** One-off custom meals not in the library */
export interface CustomMealInstance extends PlannedMealMeta {
  type: 'custom';
  id: string;            // Generated UUID
  name: string;
  /** Undefined when not given */
  calories?: number;
  caloriesEstimated?: boolean;
  /** Eating out, place undecided: `calories` is a budget */
  budget?: boolean;
  /** The budget shrinks by its share of any unplanned eating */
  autoBudget?: boolean;
  /** Set when eaten: the budget it was planned at */
  budgeted?: number;
  place?: string;
  dish?: string;
  kind?: QuickMealKind;
  /** Items to buy; hydrated into `ingredients` so the shopping list reads them */
  shopping?: string[];
  protein?: number;
  fat?: number;
  carbs?: number;
  tags: string[];
  servings: number;
}

export type PlannedMeal = RecipeReference | CustomMealInstance;


export interface DayPlan {
  date: string; // YYYY-MM-DD
  meals: Recipe[]; // UI layer uses Recipe[], storage converts to PlannedMeal[]
  completedMealIds: string[]; // IDs of meals marked as eaten
  tips?: string;
  totalCalories?: number;
  type?: 'fast' | 'non-fast'; // For 5:2 diet
  /**
   * Family meals the user said they're not eating: shown muted and left out of the day's meals and
   * calories. They stay in the group's doc and are never saved in the user's own day doc.
   */
  familyMealsOut?: Recipe[];
}

export interface WeightEntry {
  date: string;
  weight: number;
}

/** How much of a workout's calories is added back to the day's budget: all, half or none */
export type WorkoutCalorieCredit = 1 | 0.5 | 0;

export interface UserStats {
  startWeight: number; // @deprecated - derived from weightHistory[0]
  currentWeight: number;
  goalWeight: number;
  name?: string; // New field for user name
  /** Shown to the family through profile/public; a default is drawn without one */
  avatar?: Avatar;
  dailyCalorieGoal: number; // Used for "fast" days in 5:2, or every day in daily mode
  dailyWaterGoal: number; // in ml
  weightHistory: WeightEntry[];
  dietMode?: 'daily' | '5:2'; // Default 'daily'
  nonFastDayCalories?: number; // Target for non-fast days (e.g. 2000)
  dailyWorkoutCalorieGoal?: number; // Daily calorie burn target for workouts
  weeklyLossGoal?: number; // kg per week the suggested calorie target aims for (default 0.5)
  workoutCalorieCredit?: WorkoutCalorieCredit; // Share of workout calories added to the day's budget (default 1)
  dailyProteinGoal?: number; // grams; defaults to 1.6 g per kg of goal weight (see proteinTarget)
  streaks?: {
    // Global "Perfect Day" Streak
    currentStreak: number;
    bestStreak: number;
    lastLogDate: string;
    perfectDaysCount: number;

    // Per-Category Streaks
    calories?: { current: number; best: number; lastLogDate: string };
    water?: { current: number; best: number; lastLogDate: string };
    fasting?: { current: number; best: number; lastLogDate: string };
  };
}

// Enhanced shopping list types
/** An ingredient line read into what to buy, kept on its recipe so it's read once for the family */
export interface ParsedIngredientLine {
  /** The line as written in the recipe; a line edited since needs reading again */
  text: string;
  name: string;
  quantity: number;
  unit: string;
}

/** What one planned meal needs of a shopping list item */
export interface ShoppingListSource {
  date: string;
  /** The meal's name */
  meal: string;
  quantity: number;
  unit: string;
}

/** One thing to buy on the family's shopping list (groups/{groupId}/shoppingItems/{id}) */
export interface ShoppingListItem {
  id: string;
  /** Items with the same key add up (see itemKey in utils/shoppingList.ts) */
  key: string;
  name: string;
  /** What each planned meal on the list needs, by the meal's instanceId */
  sources: Record<string, ShoppingListSource>;
  /** An amount typed in: an own item's, or one changed by hand. Shown instead of the meals' total */
  amount?: string;
  addedBy: string;
  addedAt: number;
  checked?: boolean;
  checkedBy?: string;
}

/** A planned meal on the family's shopping list */
export interface ShoppingListMeal {
  date: string;
  name: string;
}

/** The family's shopping list: its items, and the planned meals added to it (by instanceId) */
export interface ShoppingList {
  items: ShoppingListItem[];
  meals: Record<string, ShoppingListMeal>;
}

/** Legacy: the per-user shopping list's ingredients (moved to the family's list) */
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
  /** Portions to buy for, by planned meal, where the user changed them from the recipe's servings */
  portions?: Record<string, number>;
}

/** A food the user already has numbers for: one of their recipes (per portion) or something they logged */
export interface KnownFood {
  name: string;
  calories: number;
  protein?: number;
  source: 'recipe' | 'log';
}

export interface FoodLogItem {
  id: string;
  name: string;
  calories: number;
  /** Grams of protein, when known (AI estimate, recipe or typed in) */
  protein?: number;
  timestamp: number;
  type?: string;        // e.g. "Breakfast", "Lunch"
  tags?: string[];      // To capture ["Dinner"] etc if type isn't explicit
  isLeftover?: boolean;
  isPacked?: boolean;
  /** The planned meal (its mealKey) this entry was logged from, so Today shows it once and unticking removes it */
  planInstanceId?: string;
}

export interface WorkoutItem {
  id: string;
  type: string;
  caloriesBurned: number;
  timestamp: number;
}

/** The user's own word on a day's food log; unset means judged from calories (see isCompleteDay) */
export type DayLogStatus = 'complete' | 'incomplete';

export interface DailyLog {
  date: string;
  items: FoodLogItem[];
  workouts: WorkoutItem[];
  waterIntake: number; // in ml
  maxFastingHours?: number; // Maximum fast achieved/broken on this day
  status?: DayLogStatus;
}

export interface DailySummary {
  date: string;
  caloriesConsumed: number;
  caloriesBurned: number;
  netCalories: number;
  workoutCount: number;
  workoutTypes?: string[]; // List of workout types (e.g. ["Walking", "HIIT"])
  waterIntake?: number; // in ml
  maxFastingHours?: number; // Fasting hours achieved
  proteinConsumed?: number; // grams, from items with a known protein amount
  status?: DayLogStatus;
}

export interface DailyProgress {
  calories: {
    current: number;
    target: number;
    status: 'under' | 'perfect' | 'over'; // <90%, 90-100%, >100%
  };
  water: {
    current: number;
    target: number;
    isMet: boolean;
  };
  fasting: {
    hours: number;
    target: number;
    isMet: boolean;
  };
  isPerfectDay: boolean;
}

export enum AppView {
  TODAY = 'TODAY',          // Real-time daily tracking
  ANALYTICS = 'ANALYTICS',  // Historical trends & insights (merged TRENDS + WEEKLY)
  PLANNER = 'PLANNER',
  RECIPES = 'RECIPES',
  SHOPPING = 'SHOPPING',
  FAMILY = 'FAMILY',
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
  /** Food logged at or under this many kcal (e.g. a coffee) doesn't end the fast; unset uses the default */
  fastBreakCalories?: number;
}

/** Guidance tips marked as read: finding id → the YYYY-MM-DD it was read */
export type CoachReadState = Record<string, string>;

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
/** A metric tint (`tile-*` classes, `--*-bg` / `--*-text`); avatars sit on one */
export type Tint = 'calories' | 'water' | 'weight' | 'workout' | 'fasting';

/** A member's avatar: a hand-drawn figure drawn from `seed`, on a tint (components/MemberAvatar.tsx) */
export interface Avatar {
  seed: string;
  tint: Tint;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  inviteCode: string; // 8-char code, resolved through groupInvites/{code}
  memberIds: string[];
  /** Members whose recipes from users/{uid}/recipes have been copied into the family */
  legacyRecipesMoved?: string[];
}

// --- Developer Mode ---
export interface FeatureFlags {
  useGeminiExperimental: boolean;
  /** Plan meals without a recipe from the planner search */
  quickMeals: boolean;
}

/** Push reminder choices, stored in reminders/{uid} (the scheduled function reads them) */
export interface ReminderSettings {
  /** Evening reminder, sent only when nothing is logged that day */
  log: { enabled: boolean; time: string };
  /** Morning weigh-in reminder on the chosen weekdays (0 = Sunday), only without a weigh-in that day */
  weighIn: { enabled: boolean; time: string; days: number[] };
  /** A nudge to log what you ate, this long after an eating-out meal's usual time, unless it's logged */
  eatingOut: { enabled: boolean; delayMinutes: number };
}
