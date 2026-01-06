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
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';
  servings: number;
}

export type Meal = Recipe;

export interface DayPlan {
  date: string; // YYYY-MM-DD
  meals: Recipe[];
  completedMealIds: string[]; // IDs of meals marked as eaten
  tips?: string;
  totalCalories?: number;
}

export interface UserStats {
  startWeight: number;
  currentWeight: number;
  goalWeight: number;
  dailyCalorieGoal: number;
}

export interface GroceryItem {
  name: string;
  checked: boolean;
}

export interface FoodLogItem {
  id: string;
  name: string;
  calories: number;
  timestamp: number;
}

export interface DailyLog {
  date: string;
  items: FoodLogItem[];
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  PLANNER = 'PLANNER',
  RECIPES = 'RECIPES',
  SHOPPING = 'SHOPPING'
}