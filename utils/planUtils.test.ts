import { describe, expect, it } from 'vitest';
import { Recipe } from '../types';
import {
  addDays, grams, creditedBurn, dayCalories, decideEatingOut, eatingOutBudgetMeal, eatingOutDishMeal, isRememberableDish, withLiveBudgets, isBudgetMeal, roundBudget, dayMealsWithoutKcal, dayTarget, mealCalories, mealKcalLabel, mealKcalSpoken,
  mealKey, mealProtein, planMeal, planRecipe, plannableSlotFor, proteinTarget, QUICK_MEAL_DESCRIPTION, slotFor,
  weekDates, weekStart,
} from './planUtils';

const recipe = (fields: Partial<Recipe> = {}): Recipe => ({
  id: 'r1', name: 'Chili', calories: 500, ingredients: [], tags: [], servings: 1, ...fields,
});

describe('slotFor', () => {
  it('uses the stored slot', () => {
    expect(slotFor({ slot: 'lunch', tags: ['breakfast'] })).toBe('lunch');
  });

  it('guesses legacy meals from their tags, defaulting to dinner', () => {
    expect(slotFor({ tags: ['Breakfast'] })).toBe('breakfast');
    expect(slotFor({ tags: ['light meal'] })).toBe('lunch');
    expect(slotFor({ tags: ['snack'] })).toBe('snack');
    expect(slotFor({ tags: ['main meal'] })).toBe('dinner');
    expect(slotFor({ tags: [] })).toBe('dinner');
  });

  it('plans snacks into lunch, since snacks are not planned', () => {
    expect(plannableSlotFor({ slot: 'snack', tags: [] })).toBe('lunch');
    expect(plannableSlotFor({ slot: 'breakfast', tags: [] })).toBe('breakfast');
  });
});

describe('mealKey', () => {
  it('prefers the instance id, falling back to the recipe id for legacy meals', () => {
    expect(mealKey({ id: 'r1', instanceId: 'i1' })).toBe('i1');
    expect(mealKey({ id: 'r1' })).toBe('r1');
  });
});

describe('meal calories and protein', () => {
  const side = recipe({ id: 's1', name: 'Salad', calories: 120, protein: 3 });

  it('adds the sides', () => {
    expect(mealCalories(recipe({ sides: [side] }))).toBe(620);
    expect(mealCalories(recipe({ calories: undefined as unknown as number }))).toBe(0);
  });

  it('labels exact, approximate and missing calories', () => {
    expect(mealKcalLabel(recipe())).toBe('500 kcal');
    expect(mealKcalLabel(recipe({ sides: [{ ...side, quick: { estimated: true } }] }))).toBe('≈ 620 kcal');
    expect(mealKcalLabel(recipe({ calories: 0, quick: { noCalories: true } }))).toBe('kcal not set');
    expect(mealKcalSpoken(recipe({ quick: { estimated: true } }))).toBe('about 500 kcal');
  });

  it('sums protein only from recipes that state it', () => {
    expect(mealProtein(recipe())).toBeUndefined();
    expect(mealProtein(recipe({ protein: 30, sides: [side, recipe({ id: 's2' })] }))).toBe(33);
    expect(mealProtein(recipe({ protein: 0 }))).toBe(0);
  });

  it('totals a day and counts meals without calories', () => {
    const plan = { date: '2026-10-14', completedMealIds: [], meals: [recipe({ sides: [side] }), recipe({ calories: 0, quick: { noCalories: true } })] };
    expect(dayCalories(plan)).toBe(620);
    expect(dayMealsWithoutKcal(plan)).toBe(1);
    expect(dayCalories(undefined)).toBe(0);
  });
});

describe('targets', () => {
  const stats = { dailyCalorieGoal: 800, nonFastDayCalories: 1800 };

  it('uses the fast-day goal only on fast days', () => {
    expect(dayTarget({ type: 'fast' }, stats)).toBe(800);
    expect(dayTarget({ type: 'non-fast' }, stats)).toBe(1800);
    expect(dayTarget(undefined, stats)).toBe(1800);
    expect(dayTarget(undefined, { dailyCalorieGoal: 800 })).toBe(2000);
  });

  it('protein: the set goal, else 1.6 g per kg of goal (or current) weight, rounded to 5', () => {
    expect(proteinTarget({ dailyProteinGoal: 140, goalWeight: 80, currentWeight: 90 })).toBe(140);
    expect(proteinTarget({ goalWeight: 80, currentWeight: 90 })).toBe(130); // 128
    expect(proteinTarget({ goalWeight: 0, currentWeight: 70 })).toBe(110); // 112
    expect(proteinTarget({ goalWeight: 0, currentWeight: 0 })).toBe(100);
  });

  it('credits all, half or none of workout calories', () => {
    expect(creditedBurn(301, {})).toBe(301);
    expect(creditedBurn(301, { workoutCalorieCredit: 0.5 })).toBe(151);
    expect(creditedBurn(301, { workoutCalorieCredit: 0 })).toBe(0);
  });
});

describe('weeks and days', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-12')).toBe('2026-10-12'); // Monday
    expect(weekStart('2026-10-14')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday
  });

  it('counts calendar days across daylight-saving switches', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08'); // clocks go forward on the 8th
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02'); // and back on 1 November
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(weekStart('2026-03-08')).toBe('2026-03-02');
  });

  it('lists the seven days of a week', () => {
    expect(weekDates('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });
});

describe('planMeal', () => {
  it('points a planned library recipe at the original and gives it a fresh instance', () => {
    const a = planMeal(recipe({ sides: [recipe({ id: 's1' })], isLeftover: true }), 'dinner');
    const b = planMeal(recipe(), 'dinner');
    expect(a.originalRecipeId).toBe('r1');
    expect(a.slot).toBe('dinner');
    expect(a.instanceId).toBeTruthy();
    expect(a.instanceId).not.toBe(b.instanceId);
    expect(a.sides).toEqual([]);
    expect(a.isLeftover).toBe(false);
  });

  it('keeps the original when planning a copy of a planned meal', () => {
    expect(planMeal(recipe({ id: 'copy', originalRecipeId: 'r1' }), 'lunch').originalRecipeId).toBe('r1');
  });

  it('gives quick meals no library recipe', () => {
    expect(planMeal(recipe({ quick: {} }), 'lunch').originalRecipeId).toBeUndefined();
    expect(planMeal(recipe({ description: QUICK_MEAL_DESCRIPTION }), 'lunch').originalRecipeId).toBeUndefined();
  });
});

describe('planRecipe', () => {
  it('makes a new dinner a family meal', () => {
    const meal = planRecipe(recipe(), 'dinner', { inFamily: true, addedBy: 'me' });
    expect(meal.familyMeal).toBe(true);
    expect(meal.addedBy).toBe('me');
  });

  it('keeps other meals, and meals without a family, personal', () => {
    expect(planRecipe(recipe(), 'lunch', { inFamily: true }).familyMeal).toBe(false);
    expect(planRecipe(recipe(), 'dinner', { inFamily: false }).familyMeal).toBe(false);
  });
});

describe('eating out with a budget', () => {
  it('plans an unnamed eating-out meal whose calories are the budget', () => {
    const meal = eatingOutBudgetMeal('dinner', 712);
    expect(meal).toMatchObject({ name: 'Eating out', calories: 712, tags: ['dinner'], quick: { kind: 'out', budget: true } });
    expect(isBudgetMeal(meal)).toBe(true);
    expect(mealKcalLabel(meal)).toBe('712 kcal budget');
    expect(mealKcalSpoken(meal)).toBe('a budget of 712 kcal');
  });

  it('counts the budget in the day total', () => {
    const plan = { date: '2026-10-06', completedMealIds: [], meals: [recipe({ calories: 400 }), eatingOutBudgetMeal('dinner', 700)] };
    expect(dayCalories(plan)).toBe(1100);
  });

  it('keeps slot, instance and eaten status when the place is decided, and drops the budget', () => {
    const planned = planMeal(eatingOutBudgetMeal('lunch', 700), 'lunch');
    const decided = decideEatingOut(planned, '  Burrito bowl  ', 640.4, { estimated: false, protein: 45 });
    expect(decided).toMatchObject({ name: 'Burrito bowl', calories: 640, protein: 45, slot: 'lunch', instanceId: planned.instanceId });
    expect(decided.quick).toEqual({ kind: 'out', estimated: undefined });
    expect(isBudgetMeal(decided)).toBe(false);
    expect(mealKcalLabel(decided)).toBe('640 kcal');
  });

  it('falls back to a plain name and rounds budgets to 50', () => {
    expect(decideEatingOut(eatingOutBudgetMeal('dinner', 700), ' ', 500).name).toBe('Eating out');
    expect(roundBudget(724)).toBe(700);
    expect(roundBudget(726)).toBe(750);
    expect(roundBudget(-30)).toBe(0);
  });
});

describe('live eating-out budgets', () => {
  const out = (slot: 'lunch' | 'dinner', kcal: number, auto = true) => planMeal(eatingOutBudgetMeal(slot, kcal, auto), slot);
  const day = (meals: Recipe[], completedMealIds: string[] = []) => ({ date: '2026-10-06', meals, completedMealIds });
  const kcals = (plan: ReturnType<typeof day>) => plan.meals.map(m => m.calories);

  it('shares anything unplanned equally between the budgets still to eat', () => {
    // A 100 kcal banana with a 600 kcal lunch and a 900 kcal dinner planned
    const plan = day([out('lunch', 600), out('dinner', 900)]);
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 100 }))).toEqual([550, 850]);
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 0 }))).toEqual([600, 900]);
  });

  it('keeps the planned figure on the meal, which is what gets saved', () => {
    const live = withLiveBudgets(day([out('lunch', 600), out('dinner', 900)]), { loggedKcal: 100 });
    expect(live.meals.map(m => m.quick?.plannedBudget)).toEqual([600, 900]);
    // Applying it again to its own result changes nothing
    expect(kcals(withLiveBudgets(live, { loggedKcal: 100 }))).toEqual([550, 850]);
  });

  it('counts eaten planned meals as planned, so only the excess comes off', () => {
    const lunch = planMeal(recipe({ calories: 600 }), 'lunch');
    const plan = day([lunch, out('dinner', 900)], [mealKey(lunch)]);
    // Lunch logged as planned: nothing extra
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 600 }))[1]).toBe(900);
    // Plus a 100 kcal banana: all of it comes off the one meal left
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 700 }))[1]).toBe(800);
  });

  it('takes a decided eating-out meal that went over its budget off the next one', () => {
    const lunch = decideEatingOut(out('lunch', 600), 'Burrito', 700, { budgeted: 600 });
    const plan = day([lunch, out('dinner', 900)], [mealKey(lunch)]);
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 700 }))[1]).toBe(800);
  });

  it("doesn't raise a budget when less was eaten than planned", () => {
    const lunch = decideEatingOut(out('lunch', 600), 'Salad', 400, { budgeted: 600 });
    const plan = day([lunch, out('dinner', 900)], [mealKey(lunch)]);
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 400 }))[1]).toBe(900);
  });

  it('passes on what a small budget cannot give, and stops at zero', () => {
    const plan = day([out('lunch', 100), out('dinner', 900)]);
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 400 }))).toEqual([0, 600]);
    expect(kcals(withLiveBudgets(plan, { loggedKcal: 5000 }))).toEqual([0, 0]);
  });

  it('leaves fixed budgets and plans without budgets untouched', () => {
    const fixed = day([out('lunch', 600, false), out('dinner', 900, false)]);
    expect(withLiveBudgets(fixed, { loggedKcal: 500 })).toBe(fixed);
    const only = day([out('lunch', 600, false), out('dinner', 900)]);
    expect(kcals(withLiveBudgets(only, { loggedKcal: 100 }))).toEqual([600, 800]);
  });
});

describe('eatingOutDishMeal', () => {
  it('plans a named dish that is not a budget and can be remembered once eaten', () => {
    const meal = eatingOutDishMeal('dinner', { place: 'Thai corner', dish: 'Pad thai', calories: 780, protein: 30 });
    expect(meal).toMatchObject({ name: 'Pad thai at Thai corner', calories: 780, protein: 30 });
    expect(meal.quick).toMatchObject({ kind: 'out', place: 'Thai corner', dish: 'Pad thai', estimated: true });
    expect(isBudgetMeal(meal)).toBe(false);
    expect(isRememberableDish(meal)).toBe(true);
  });

  it('does not remember a budget meal', () => {
    expect(isRememberableDish(eatingOutBudgetMeal('dinner', 700))).toBe(false);
  });

  it('keeps place and dish when a budget is decided', () => {
    const decided = decideEatingOut(eatingOutBudgetMeal('dinner', 700), 'Pad thai at Thai corner', 650, { place: ' Thai corner ', dish: 'Pad thai' });
    expect(decided.quick).toMatchObject({ place: 'Thai corner', dish: 'Pad thai' });
    expect(isRememberableDish(decided)).toBe(true);
  });
});

describe('grams', () => {
  it('rounds to whole grams from 10 g', () => {
    expect(grams(46.28)).toBe('46');
    expect(grams(10)).toBe('10');
  });

  it('keeps one decimal below 10 g', () => {
    expect(grams(3.5)).toBe('3.5');
    expect(grams(9.96)).toBe('10');
    expect(grams(4)).toBe('4');
  });
});
