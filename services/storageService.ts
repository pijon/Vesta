import { Recipe, DayPlan, UserStats, ShoppingState, DailyLog, PantryInventory, EnhancedShoppingState, FastingState, FastingEntry } from "../types";
import { DEFAULT_USER_STATS } from "../constants";

const RECIPES_KEY = "fast800_recipes";
const PLAN_KEY = "fast800_plan";
const STATS_KEY = "fast800_stats";
const SHOPPING_STATE_KEY = "fast800_shopping_state";
const PANTRY_KEY = "fast800_pantry";
const ENHANCED_SHOPPING_KEY = "fast800_enhanced_shopping";
const LOGS_KEY = "fast800_logs";
const FASTING_STATE_KEY = "fast800_fasting_state";
const FASTING_HISTORY_KEY = "fast800_fasting_history";

// --- Recipes ---
export const getRecipes = (): Recipe[] => {
  const stored = localStorage.getItem(RECIPES_KEY);
  if (!stored) return [];

  let recipes = JSON.parse(stored);
  let hasChanges = false;

  // Migration: Convert lunch/dinner to main meal
  const migratedRecipes = recipes.map((r: any) => {
    if (r.type === 'lunch' || r.type === 'dinner') {
      hasChanges = true;
      return { ...r, type: 'main meal' };
    }
    return r;
  });

  if (hasChanges) {
    localStorage.setItem(RECIPES_KEY, JSON.stringify(migratedRecipes));
  }

  return migratedRecipes;
};

export const saveRecipe = (recipe: Recipe) => {
  const recipes = getRecipes();
  const index = recipes.findIndex(r => r.id === recipe.id);
  if (index >= 0) {
    recipes[index] = recipe;
  } else {
    recipes.push(recipe);
  }
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
};

export const deleteRecipe = (id: string) => {
  const recipes = getRecipes().filter(r => r.id !== id);
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
};

// --- Planning ---
export const getWeeklyPlan = (): Record<string, DayPlan> => {
  const stored = localStorage.getItem(PLAN_KEY);
  if (!stored) return {};

  let plan = JSON.parse(stored);
  let hasChanges = false;

  // Migration: Convert lunch/dinner to main meal in existing plans
  Object.keys(plan).forEach(date => {
    const day = plan[date];
    if (day.meals) {
      day.meals = day.meals.map((m: any) => {
        if (m.type === 'lunch' || m.type === 'dinner') {
          hasChanges = true;
          return { ...m, type: 'main meal' };
        }
        return m;
      });
    }
  });

  if (hasChanges) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  }

  return plan;
};

export const getDayPlan = (date: string): DayPlan => {
  const plan = getWeeklyPlan();
  return plan[date] || { date, meals: [], completedMealIds: [] };
};

export const saveDayPlan = (dayPlan: DayPlan) => {
  const plan = getWeeklyPlan();
  plan[dayPlan.date] = dayPlan;
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
};

// --- Stats (Weight) ---
export const getUserStats = (): UserStats => {
  const stored = localStorage.getItem(STATS_KEY);
  const stats = stored ? JSON.parse(stored) : DEFAULT_USER_STATS;

  // Migration: Ensure dailyWaterGoal exists
  if (typeof stats.dailyWaterGoal === 'undefined') {
    stats.dailyWaterGoal = DEFAULT_USER_STATS.dailyWaterGoal;
  }

  return stats;
};

export const saveUserStats = (stats: UserStats) => {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
};

// --- Shopping List State ---
export const getShoppingState = (): ShoppingState => {
  const stored = localStorage.getItem(SHOPPING_STATE_KEY);
  return stored ? JSON.parse(stored) : { checked: [], removed: [] };
};

export const saveShoppingState = (state: ShoppingState) => {
  localStorage.setItem(SHOPPING_STATE_KEY, JSON.stringify(state));
};

// --- Pantry Inventory ---
export const getPantryInventory = (): PantryInventory => {
  const stored = localStorage.getItem(PANTRY_KEY);
  return stored ? JSON.parse(stored) : { items: [], lastUpdated: Date.now() };
};

export const savePantryInventory = (inventory: PantryInventory) => {
  localStorage.setItem(PANTRY_KEY, JSON.stringify(inventory));
};

export const addToPantry = (ingredientName: string, persistent: boolean = true) => {
  const inventory = getPantryInventory();

  // Check if already exists
  const existingIndex = inventory.items.findIndex(item => item.name === ingredientName);

  if (existingIndex >= 0) {
    // Update existing
    inventory.items[existingIndex] = {
      name: ingredientName,
      markedAt: Date.now(),
      persistent
    };
  } else {
    // Add new
    inventory.items.push({
      name: ingredientName,
      markedAt: Date.now(),
      persistent
    });
  }

  inventory.lastUpdated = Date.now();
  savePantryInventory(inventory);
};

export const removeFromPantry = (ingredientName: string) => {
  const inventory = getPantryInventory();
  inventory.items = inventory.items.filter(item => item.name !== ingredientName);
  inventory.lastUpdated = Date.now();
  savePantryInventory(inventory);
};

export const isInPantry = (ingredientName: string): boolean => {
  const inventory = getPantryInventory();
  return inventory.items.some(item => item.name === ingredientName);
};

// --- Enhanced Shopping State ---
export const getEnhancedShoppingState = (): EnhancedShoppingState => {
  const stored = localStorage.getItem(ENHANCED_SHOPPING_KEY);
  return stored ? JSON.parse(stored) : {
    pantryChecks: {},
    purchased: [],
    removed: [],
    lastGeneratedDate: '',
    cachedPurchasableItems: []
  };
};

export const saveEnhancedShoppingState = (state: EnhancedShoppingState) => {
  localStorage.setItem(ENHANCED_SHOPPING_KEY, JSON.stringify(state));
};

// --- Migration ---
export const migrateShoppingState = () => {
  const oldState = getShoppingState();
  const newState = getEnhancedShoppingState();

  // If old state exists but new state is empty, migrate
  if ((oldState.checked.length > 0 || oldState.removed.length > 0) &&
    newState.purchased.length === 0 && newState.removed.length === 0) {

    newState.purchased = oldState.checked;
    newState.removed = oldState.removed;
    saveEnhancedShoppingState(newState);
  }
};

// --- Daily Logs ---
export const getDailyLog = (date: string): DailyLog => {
  const stored = localStorage.getItem(LOGS_KEY);
  const logs = stored ? JSON.parse(stored) : {};
  const log = logs[date] || { date, items: [], workouts: [] };

  // Migration: Ensure workouts array exists
  if (!log.workouts) {
    log.workouts = [];
  }

  // Migration: Ensure waterIntake exists
  if (typeof log.waterIntake === 'undefined') {
    log.waterIntake = 0;
  }

  return log;
};

export const saveDailyLog = (log: DailyLog) => {
  const stored = localStorage.getItem(LOGS_KEY);
  const logs = stored ? JSON.parse(stored) : {};
  logs[log.date] = log;
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
};

// --- Daily Summaries ---
export interface DailySummary {
  date: string;
  caloriesConsumed: number;
  caloriesBurned: number;
  netCalories: number;
  workoutCount: number;
}

export const getAllDailySummaries = (): DailySummary[] => {
  const stored = localStorage.getItem(LOGS_KEY);
  if (!stored) return [];

  const logs = JSON.parse(stored);
  const summaries: DailySummary[] = [];

  Object.keys(logs).forEach(date => {
    const log = logs[date];
    const caloriesConsumed = (log.items || []).reduce((sum: number, item: any) => sum + item.calories, 0);
    const caloriesBurned = (log.workouts || []).reduce((sum: number, w: any) => sum + w.caloriesBurned, 0);

    summaries.push({
      date,
      caloriesConsumed,
      caloriesBurned,
      netCalories: caloriesConsumed - caloriesBurned,
      workoutCount: (log.workouts || []).length
    });
  });

  // Sort by date
  return summaries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// --- Data Portability ---
export const exportAllData = (): string => {
  const data = {
    recipes: localStorage.getItem(RECIPES_KEY),
    plan: localStorage.getItem(PLAN_KEY),
    stats: localStorage.getItem(STATS_KEY),
    shopping: localStorage.getItem(SHOPPING_STATE_KEY),
    logs: localStorage.getItem(LOGS_KEY),
    fastingState: localStorage.getItem(FASTING_STATE_KEY),
    fastingHistory: localStorage.getItem(FASTING_HISTORY_KEY),
    version: 1
  };
  return JSON.stringify(data, null, 2);
};

export const importAllData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);

    if (data.recipes) localStorage.setItem(RECIPES_KEY, data.recipes);
    if (data.plan) localStorage.setItem(PLAN_KEY, data.plan);
    if (data.stats) localStorage.setItem(STATS_KEY, data.stats);
    if (data.shopping) localStorage.setItem(SHOPPING_STATE_KEY, data.shopping);
    if (data.logs) localStorage.setItem(LOGS_KEY, data.logs);
    if (data.fastingState) localStorage.setItem(FASTING_STATE_KEY, data.fastingState);
    if (data.fastingHistory) localStorage.setItem(FASTING_HISTORY_KEY, data.fastingHistory);

    return true;
  } catch (e) {
    console.error("Failed to import data", e);
    return false;
  }
};

// --- Fasting ---
export const getFastingState = (): FastingState => {
  const stored = localStorage.getItem(FASTING_STATE_KEY);
  if (!stored) {
    return {
      isFasting: false,
      startTime: null,
      endTime: null,
      config: {
        protocol: '16:8',
        targetFastHours: 16
      }
    };
  }
  return JSON.parse(stored);
};

export const saveFastingState = (state: FastingState) => {
  localStorage.setItem(FASTING_STATE_KEY, JSON.stringify(state));
};

export const getFastingHistory = (): FastingEntry[] => {
  const stored = localStorage.getItem(FASTING_HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const addFastingEntry = (entry: FastingEntry) => {
  const history = getFastingHistory();
  history.push(entry);
  localStorage.setItem(FASTING_HISTORY_KEY, JSON.stringify(history));
};