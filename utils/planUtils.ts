import { DayPlan, MealSlot, Recipe, UserStats } from '../types';
import { localDateString, parseLocalDate } from './dateUtils';

export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: 'breakfast', label: 'Breakfast' },
  { slot: 'lunch', label: 'Lunch' },
  { slot: 'dinner', label: 'Dinner' },
  { slot: 'snack', label: 'Snacks' },
];

export const slotLabel = (slot: MealSlot) => MEAL_SLOTS.find(s => s.slot === slot)!.label;

/** The meal's slot, or one guessed from its tags for plans made before slots existed. */
export const slotFor = (meal: Pick<Recipe, 'slot' | 'tags'>): MealSlot => {
  if (meal.slot) return meal.slot;
  const tags = (meal.tags || []).map(t => t.toLowerCase());
  if (tags.includes('breakfast')) return 'breakfast';
  if (tags.includes('lunch') || tags.includes('light meal')) return 'lunch';
  if (tags.includes('snack')) return 'snack';
  return 'dinner';
};

/** Identifies one planned meal; legacy meals fall back to their recipe id. */
export const mealKey = (meal: Pick<Recipe, 'instanceId' | 'id'>) => meal.instanceId || meal.id;

export const isMealEaten = (plan: Pick<DayPlan, 'completedMealIds'>, meal: Recipe) =>
  plan.completedMealIds.includes(mealKey(meal));

/** Meal plus its sides. */
export const mealCalories = (meal: Recipe) =>
  (meal.calories || 0) + (meal.sides || []).reduce((sum, side) => sum + (side.calories || 0), 0);

export const dayCalories = (plan?: DayPlan) =>
  plan ? plan.meals.reduce((sum, meal) => sum + mealCalories(meal), 0) : 0;

/** Days are nourish days unless marked as a fast day. */
export const isFastDay = (plan?: Pick<DayPlan, 'type'>) => plan?.type === 'fast';

export const dayTarget = (plan: Pick<DayPlan, 'type'> | undefined, stats: Pick<UserStats, 'dailyCalorieGoal' | 'nonFastDayCalories'>) =>
  isFastDay(plan) ? stats.dailyCalorieGoal : (stats.nonFastDayCalories || 2000);

export const emptyDayPlan = (date: string): DayPlan => ({ date, meals: [], completedMealIds: [] });

/** Monday of the week containing `date`. */
export const weekStart = (date: string) => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateString(d);
};

export const addDays = (date: string, days: number) => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return localDateString(d);
};

export const weekDates = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** A fresh planned copy of a recipe for a slot. */
export const planMeal = (recipe: Recipe, slot: MealSlot, extra: Partial<Recipe> = {}): Recipe => ({
  ...recipe,
  originalRecipeId: recipe.description === 'Eat Out / Custom Meal' ? undefined : (recipe.originalRecipeId || recipe.id),
  slot,
  instanceId: crypto.randomUUID(),
  isLeftover: false,
  isPacked: false,
  sides: [],
  familyDinner: false,
  ...extra,
});
