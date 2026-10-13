import { DayPlan, MealSlot, Recipe, UserStats } from '../types';
import { localDateString, parseLocalDate } from './dateUtils';

export const MEAL_SLOTS: { slot: MealSlot; label: string }[] = [
  { slot: 'breakfast', label: 'Breakfast' },
  { slot: 'lunch', label: 'Lunch' },
  { slot: 'dinner', label: 'Dinner' },
  { slot: 'snack', label: 'Snacks' },
];

/** Slots offered when planning. Snacks aren't planned; existing planned snacks still show and count. */
export const PLANNABLE_SLOTS = MEAL_SLOTS.filter(s => s.slot !== 'snack');

/** Where a recipe goes by default when planned: its own slot, or lunch for a snack */
export const plannableSlotFor = (meal: Pick<Recipe, 'slot' | 'tags'>): MealSlot => {
  const slot = slotFor(meal);
  return slot === 'snack' ? 'lunch' : slot;
};

/** When each slot's meal is usually eaten [hour, minute]: the order of Today's "Next up" and when late-logged meals are assumed eaten */
export const SLOT_TIMES: Record<MealSlot, [number, number]> = { breakfast: [7, 30], lunch: [12, 30], snack: [15, 30], dinner: [18, 30] };

/** Today's time for a slot, in ms */
export const slotTime = (slot: MealSlot, now = Date.now()) => {
  const d = new Date(now);
  d.setHours(SLOT_TIMES[slot][0], SLOT_TIMES[slot][1], 0, 0);
  return d.getTime();
};

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

/** Description kept on quick meals so older checks still work; test with isQuickMeal instead. */
export const QUICK_MEAL_DESCRIPTION = 'Eat Out / Custom Meal';

/** A planned meal with no library recipe behind it (a quick meal, or an AI-suggested side). */
export const isQuickMeal = (meal: Pick<Recipe, 'quick' | 'description'>) =>
  !!meal.quick || meal.description === QUICK_MEAL_DESCRIPTION;

const withSides = (meal: Recipe) => [meal, ...(meal.sides || [])];

/** No calories given for the meal or any of its sides. */
export const mealKcalUnset = (meal: Recipe) => withSides(meal).every(m => !!m.quick?.noCalories);

/** Some of the meal's calories are estimated or missing, so its total is approximate. */
export const mealKcalApprox = (meal: Recipe) => withSides(meal).some(m => !!(m.quick?.estimated || m.quick?.noCalories));

/** "650 kcal", "≈ 650 kcal" or "kcal not set". */
export const mealKcalLabel = (meal: Recipe) =>
  mealKcalUnset(meal) ? 'kcal not set' : `${mealKcalApprox(meal) ? '≈ ' : ''}${mealCalories(meal)} kcal`;

/** mealKcalLabel for screen readers, which read "≈" badly. */
export const mealKcalSpoken = (meal: Recipe) =>
  mealKcalUnset(meal) ? 'calories not set' : `${mealKcalApprox(meal) ? 'about ' : ''}${mealCalories(meal)} kcal`;

/** Protein in a meal plus its sides, when the recipes say (undefined when none of them do). */
export const mealProtein = (meal: Recipe): number | undefined => {
  const parts = [meal, ...(meal.sides || [])].map(m => m.protein).filter((p): p is number => typeof p === 'number');
  return parts.length ? parts.reduce((a, b) => a + b, 0) : undefined;
};

/**
 * Daily protein target in grams: the one set in Settings, else 1.6 g per kg of goal weight
 * (current weight when there's no goal), a common aim while eating less to keep muscle.
 */
export const proteinTarget = (stats: Pick<UserStats, 'dailyProteinGoal' | 'goalWeight' | 'currentWeight'>) => {
  if (stats.dailyProteinGoal && stats.dailyProteinGoal > 0) return stats.dailyProteinGoal;
  const basis = stats.goalWeight > 0 ? stats.goalWeight : stats.currentWeight;
  return basis > 0 ? Math.round((basis * 1.6) / 5) * 5 : 100;
};

export const dayCalories = (plan?: DayPlan) =>
  plan ? plan.meals.reduce((sum, meal) => sum + mealCalories(meal), 0) : 0;

/** The day's total includes estimated or missing calories. */
export const dayKcalApprox = (plan?: DayPlan) => !!plan?.meals.some(mealKcalApprox);

/** Planned meals on the day with no calories at all. */
export const dayMealsWithoutKcal = (plan?: DayPlan) => (plan ? plan.meals.filter(mealKcalUnset).length : 0);

/** Days are nourish days unless marked as a fast day. */
export const isFastDay = (plan?: Pick<DayPlan, 'type'>) => plan?.type === 'fast';

/**
 * Workout calories added to the day's budget. Fitness trackers often overestimate burn, so this can
 * be set to half or none in Settings; the default adds all of it.
 */
export const creditedBurn = (burned: number, stats: Pick<UserStats, 'workoutCalorieCredit'>) =>
  Math.round(burned * (stats.workoutCalorieCredit ?? 1));

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
  originalRecipeId: isQuickMeal(recipe) ? undefined : (recipe.originalRecipeId || recipe.id),
  slot,
  instanceId: crypto.randomUUID(),
  isLeftover: false,
  isPacked: false,
  sides: [],
  familyDinner: false,
  ...extra,
});

/**
 * A recipe planned into a slot by the current user. With a family group (familySize set), a
 * dinner is shared with the family and cooked for everyone; other meals are personal.
 */
export const planRecipe = (
  recipe: Recipe,
  slot: MealSlot,
  { familySize, addedBy }: { familySize?: number | null; addedBy?: string },
  extra: Partial<Recipe> = {},
): Recipe => {
  const shared = !!familySize && slot === 'dinner';
  return planMeal(recipe, slot, {
    familyDinner: shared,
    cookingServings: shared ? familySize! : 1,
    addedBy,
    ownerId: recipe.ownerId,
    ...extra,
  });
};
