import { describe, expect, it } from 'vitest';
import { Recipe } from '../types';
import {
  addDays, creditedBurn, dayCalories, dayMealsWithoutKcal, dayTarget, mealCalories, mealKcalLabel, mealKcalSpoken,
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
  it('shares a dinner with the family and cooks it for everyone', () => {
    const meal = planRecipe(recipe(), 'dinner', { familySize: 4, addedBy: 'me' });
    expect(meal.familyDinner).toBe(true);
    expect(meal.cookingServings).toBe(4);
    expect(meal.addedBy).toBe('me');
  });

  it('keeps other meals, and meals without a family, personal', () => {
    expect(planRecipe(recipe(), 'lunch', { familySize: 4 })).toMatchObject({ familyDinner: false, cookingServings: 1 });
    expect(planRecipe(recipe(), 'dinner', { familySize: null })).toMatchObject({ familyDinner: false, cookingServings: 1 });
  });
});
