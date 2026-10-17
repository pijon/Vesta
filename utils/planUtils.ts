import { DayPlan, EatingOutDish, MealSlot, Recipe, UserStats } from '../types';
import { dishLabel } from './eatingOutHistory';
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

/** Index of the next meal to eat: the earliest by slot time that isn't eaten yet. */
export const nextMealIndex = (plan: Pick<DayPlan, 'meals' | 'completedMealIds'>): number | undefined =>
  plan.meals
    .map((meal, index) => ({ meal, index }))
    .filter(({ meal }) => !isMealEaten(plan, meal))
    .sort((a, b) => slotTime(slotFor(a.meal)) - slotTime(slotFor(b.meal)) || a.index - b.index)[0]?.index;

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

/** Eating out with the place undecided: the meal's calories are a budget to stay within. */
export const isBudgetMeal = (meal: Pick<Recipe, 'quick'>) => !!meal.quick?.budget;

/** Name given to an eating-out meal planned before a place is picked. */
export const EATING_OUT_NAME = 'Eating out';

/** A planned "eating out, place TBD" meal with a calorie budget. */
export const eatingOutBudgetMeal = (slot: MealSlot, budget: number, auto = true): Recipe => ({
  id: crypto.randomUUID(),
  name: EATING_OUT_NAME,
  calories: Math.max(0, Math.round(budget)),
  ingredients: [],
  instructions: [],
  tags: [slot],
  servings: 1,
  description: QUICK_MEAL_DESCRIPTION,
  quick: { kind: 'out', budget: true, autoBudget: auto || undefined },
});

/**
 * Shows each automatic budget as planned, less its equal share of what's been eaten beyond the
 * plan: logged calories (an unplanned banana, a bigger lunch than budgeted) minus what the eaten
 * planned meals were meant to be. Several budgets share the excess equally; one that runs out
 * passes the rest on. Eating less than planned doesn't raise anything. The planned figure stays on
 * `quick.plannedBudget`, which is what's saved.
 */
export const withLiveBudgets = (plan: DayPlan, { loggedKcal }: { loggedKcal: number }): DayPlan => {
  const live = plan.meals.filter(meal => isBudgetMeal(meal) && meal.quick?.autoBudget && !isMealEaten(plan, meal));
  if (live.length === 0) return plan;

  const plannedEaten = plan.meals
    .filter(meal => isMealEaten(plan, meal))
    .reduce((sum, meal) => sum + (meal.quick?.budgeted ?? mealCalories(meal)), 0);
  const planned = live.map(meal => meal.quick?.plannedBudget ?? meal.calories);
  const cut = planned.map(() => 0);

  let left = Math.max(0, loggedKcal - plannedEaten);
  let active = planned.map((_, i) => i);
  while (left > 0 && active.length) {
    const share = left / active.length;
    const spent = active.filter(i => planned[i] - cut[i] <= share);
    if (!spent.length) {
      active.forEach(i => { cut[i] += share; });
      break;
    }
    spent.forEach(i => { left -= planned[i] - cut[i]; cut[i] = planned[i]; });
    active = active.filter(i => !spent.includes(i));
  }

  const byKey = new Map(live.map((meal, i) => [mealKey(meal), { planned: planned[i], now: Math.round((planned[i] - cut[i]) / 5) * 5 }]));
  return {
    ...plan,
    meals: plan.meals.map(meal => {
      const budget = byKey.get(mealKey(meal));
      return budget ? { ...meal, calories: budget.now, quick: { ...meal.quick, plannedBudget: budget.planned } } : meal;
    }),
  };
};

/**
 * The budget meal once the real meal is known. It keeps its slot, instance and day, so eaten status
 * and the planner stay put; only what and how much changes. `budgeted` is the planned budget when
 * this is what was actually eaten, so going over it comes off the day's other budgets.
 */
export const decideEatingOut = (
  meal: Recipe,
  name: string,
  calories: number,
  { estimated = true, protein, budgeted, place, dish }: { estimated?: boolean; protein?: number; budgeted?: number; place?: string; dish?: string } = {},
): Recipe => ({
  ...meal,
  name: name.trim() || EATING_OUT_NAME,
  calories: Math.max(0, Math.round(calories)),
  protein: protein ?? 0,
  quick: { kind: 'out', estimated: estimated || undefined, budgeted, place: place?.trim() || undefined, dish: dish?.trim() || undefined },
});

/** A planned dish from the eating-out history. It stays open (not eaten) until it's logged or swapped for what was really had. */
export const eatingOutDishMeal = (slot: MealSlot, d: Pick<EatingOutDish, 'place' | 'dish' | 'calories' | 'protein'>): Recipe =>
  decideEatingOut(
    eatingOutBudgetMeal(slot, d.calories),
    dishLabel(d), d.calories, { estimated: true, protein: d.protein, place: d.place, dish: d.dish },
  );

/** An eating-out meal that names where or what, so eating it can add the dish to the history. */
export const isRememberableDish = (meal: Pick<Recipe, 'quick'>) =>
  meal.quick?.kind === 'out' && !meal.quick.budget && !!(meal.quick.place || meal.quick.dish);

/** Round a calorie figure to the nearest 50, the grain a restaurant budget is set at. */
export const roundBudget = (kcal: number) => Math.max(0, Math.round(kcal / 50) * 50);

/** Grams the way a nutrition label shows them: whole from 10 g, one decimal below ("3.5"), never "46.28" */
export const grams = (n: number) => {
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(rounded);
};

/** "650 kcal", "≈ 650 kcal", "700 kcal budget" or "kcal not set". */
export const mealKcalLabel = (meal: Recipe) =>
  isBudgetMeal(meal) ? `${mealCalories(meal)} kcal budget`
    : mealKcalUnset(meal) ? 'kcal not set' : `${mealKcalApprox(meal) ? '≈ ' : ''}${mealCalories(meal)} kcal`;

/** mealKcalLabel for screen readers, which read "≈" badly. */
export const mealKcalSpoken = (meal: Recipe) =>
  isBudgetMeal(meal) ? `a budget of ${mealCalories(meal)} kcal`
    : mealKcalUnset(meal) ? 'calories not set' : `${mealKcalApprox(meal) ? 'about ' : ''}${mealCalories(meal)} kcal`;

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

/** Seven days from `start` (a Monday for a calendar week, or any day for the planner's rolling week) */
export const weekDates = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

/**
 * The first day of the planner's seven-day page that holds `date`: pages run from today in steps
 * of seven, so the page with today starts on today.
 */
export const rangeStart = (date: string, today: string) => {
  const days = Math.round((parseLocalDate(date).getTime() - parseLocalDate(today).getTime()) / 86_400_000);
  return addDays(today, Math.floor(days / 7) * 7);
};

/** ISO 8601 week number: weeks start on Monday, and week 1 holds the year's first Thursday */
export const isoWeek = (date: string) => {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // that week's Thursday
  const jan4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
};

/** A fresh planned copy of a recipe for a slot. */
export const planMeal = (recipe: Recipe, slot: MealSlot, extra: Partial<Recipe> = {}): Recipe => ({
  ...recipe,
  originalRecipeId: isQuickMeal(recipe) ? undefined : (recipe.originalRecipeId || recipe.id),
  slot,
  instanceId: crypto.randomUUID(),
  isLeftover: false,
  isPacked: false,
  sides: [],
  familyMeal: false,
  ...extra,
});

/**
 * A recipe planned into a slot by the current user. In a family, a new dinner starts out as a
 * family meal; other meals are just for the user. Portions are picked in the shopping list.
 */
export const planRecipe = (
  recipe: Recipe,
  slot: MealSlot,
  { inFamily, addedBy }: { inFamily: boolean; addedBy?: string },
  extra: Partial<Recipe> = {},
): Recipe => {
  return planMeal(recipe, slot, {
    familyMeal: inFamily && slot === 'dinner',
    addedBy,
    ownerId: recipe.ownerId,
    ...extra,
  });
};

/**
 * A day plan with the user (uid) out of a family meal (out: true) or eating it again (false). A meal
 * they're out of moves from the plan's meals to familyMealsOut, and stops counting as eaten.
 */
export const setFamilyMealOut = (plan: DayPlan, instanceId: string, uid: string, out: boolean): DayPlan => {
  const meal = [...plan.meals, ...(plan.familyMealsOut || [])].find(m => m.instanceId === instanceId);
  if (!meal) return plan;
  const others = (meal.notEating || []).filter(id => id !== uid);
  const notEating = out ? [...others, uid] : others;
  const updated: Recipe = { ...meal, notEating: notEating.length ? notEating : undefined };
  const meals = plan.meals.filter(m => m.instanceId !== instanceId);
  const mealsOut = (plan.familyMealsOut || []).filter(m => m.instanceId !== instanceId);
  if (out) mealsOut.push(updated);
  return {
    ...plan,
    meals: out ? meals : [...meals, updated],
    familyMealsOut: mealsOut.length ? mealsOut : undefined,
    completedMealIds: out ? plan.completedMealIds.filter(id => id !== instanceId) : plan.completedMealIds,
  };
};

/** A planned meal's slot and day in words: "dinner tonight", "lunch tomorrow", "dinner on Friday" (this week), "lunch on 3 Nov" */
export const mealWhen = (slot: MealSlot, date: string, today = localDateString()) => {
  const meal = slotLabel(slot).toLowerCase();
  if (date === today) return slot === 'dinner' ? 'dinner tonight' : `${meal} today`;
  if (date === addDays(today, 1)) return `${meal} tomorrow`;
  const d = parseLocalDate(date);
  return date > today && date <= addDays(today, 6)
    ? `${meal} on ${d.toLocaleDateString(undefined, { weekday: 'long' })}`
    : `${meal} on ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};
