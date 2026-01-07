import { Recipe, DayPlan, UserStats, ShoppingState, DailyLog } from "../types";
import { DEFAULT_USER_STATS } from "../constants";

const RECIPES_KEY = "fast800_recipes";
const PLAN_KEY = "fast800_plan";
const STATS_KEY = "fast800_stats";
const SHOPPING_STATE_KEY = "fast800_shopping_state";
const LOGS_KEY = "fast800_logs";

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
  return stored ? JSON.parse(stored) : DEFAULT_USER_STATS;
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

// --- Daily Logs ---
export const getDailyLog = (date: string): DailyLog => {
  const stored = localStorage.getItem(LOGS_KEY);
  const logs = stored ? JSON.parse(stored) : {};
  return logs[date] || { date, items: [] };
};

export const saveDailyLog = (log: DailyLog) => {
  const stored = localStorage.getItem(LOGS_KEY);
  const logs = stored ? JSON.parse(stored) : {};
  logs[log.date] = log;
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
};