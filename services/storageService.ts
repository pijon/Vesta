import { Recipe, DayPlan, UserStats } from "../types";
import { DEFAULT_USER_STATS } from "../constants";

const RECIPES_KEY = "fast800_recipes";
const PLAN_KEY = "fast800_plan";
const STATS_KEY = "fast800_stats";
const LOGS_KEY = "fast800_logs_legacy"; // Keeping for safety, though structure changes

// --- Recipes ---
export const getRecipes = (): Recipe[] => {
  const stored = localStorage.getItem(RECIPES_KEY);
  return stored ? JSON.parse(stored) : [];
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
  return stored ? JSON.parse(stored) : {};
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
