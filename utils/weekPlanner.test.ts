import { describe, expect, it } from 'vitest';
import { MealSlot, Recipe } from '../types';
import { emptyDayPlan, planMeal } from './planUtils';
import { DayResult, WeekDay, WeekPlanOptions, pinsOf, planWeek, proposalsOf, proteinOf, slotKey } from './weekPlanner';

const recipe = (id: string, slot: MealSlot, calories: number, name = id): Recipe => ({
  id, name, calories, slot, ingredients: [], tags: [], servings: 1,
});

const library: Recipe[] = [
  recipe('oats', 'breakfast', 300, 'Overnight oats'),
  recipe('eggs', 'breakfast', 350, 'Scrambled eggs'),
  recipe('yogurt', 'breakfast', 200, 'Yogurt bowl'),
  recipe('soup', 'lunch', 350, 'Lentil soup'),
  recipe('salad', 'lunch', 300, 'Tuna salad'),
  recipe('wrap', 'lunch', 450, 'Chicken wrap'),
  recipe('salmon', 'dinner', 550, 'Baked salmon'),
  recipe('chili', 'dinner', 650, 'Beef chili'),
  recipe('curry', 'dinner', 600, 'Chickpea curry'),
  recipe('roast', 'dinner', 700, 'Roast chicken'),
  recipe('pork', 'dinner', 600, 'Pork stir-fry'),
];

const day = (date: string, fields: Partial<WeekDay> = {}): WeekDay => ({
  date, plan: emptyDayPlan(date), fast: false, target: 1800, skip: false, ...fields,
});

const options = (fields: Partial<WeekPlanOptions> = {}): WeekPlanOptions => ({ fastDayMeals: 2, leftovers: false, seed: 1, ...fields });

const proposed = (result: DayResult, slot: MealSlot) => {
  const r = result.slots[slot];
  return r?.kind === 'proposed' ? r : undefined;
};

const week = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];

describe('planWeek', () => {
  it('fills breakfast, lunch and dinner on a nourish day, within its target', () => {
    const [result] = planWeek([day(week[0])], library, options());
    expect(proposed(result, 'breakfast')).toBeDefined();
    expect(proposed(result, 'lunch')).toBeDefined();
    expect(proposed(result, 'dinner')).toBeDefined();
    expect(result.calories).toBeLessThanOrEqual(1800);
  });

  it('keeps planned meals and counts them against the target', () => {
    const plan = { ...emptyDayPlan(week[0]), meals: [planMeal(recipe('feast', 'dinner', 1400), 'dinner')] };
    const [result] = planWeek([day(week[0], { plan })], library, options());
    expect(result.slots.dinner).toBeUndefined();
    expect(result.calories).toBe(1400 + proposalsOf([result]).reduce((sum, p) => sum + p.recipe.calories, 0));
    // 400 kcal left for two meals: the lightest ones
    expect(proposed(result, 'breakfast')?.recipe.id).toBe('yogurt');
  });

  it('gives a fast day lunch and dinner only, under its target', () => {
    const [result] = planWeek([day(week[0], { fast: true, target: 900 })], library, options());
    expect(result.slots.breakfast).toEqual({ kind: 'rest' });
    expect(proposed(result, 'lunch')).toBeDefined();
    expect(proposed(result, 'dinner')).toBeDefined();
    // The lightest lunch (300) leaves 600 for dinner
    expect(result.calories).toBeLessThanOrEqual(900);
  });

  it('fills all three on a fast day when asked to', () => {
    const [result] = planWeek([day(week[0], { fast: true, target: 1000 })], library, options({ fastDayMeals: 3 }));
    expect(proposals(result)).toHaveLength(3);
  });

  it("counts a fast day's planned breakfast as one of its meals", () => {
    const plan = { ...emptyDayPlan(week[0]), meals: [planMeal(library[0], 'breakfast')] };
    const [result] = planWeek([day(week[0], { plan, fast: true, target: 800 })], library, options());
    expect(proposals(result).map(p => p.slot)).toEqual(['dinner']);
    expect(result.slots.lunch).toEqual({ kind: 'rest' });
  });

  it('leaves skipped days alone', () => {
    const [result] = planWeek([day(week[0], { skip: true })], library, options());
    expect(result.slots).toEqual({});
  });

  it("plans the previous night's dinner as lunch with leftovers on", () => {
    const results = planWeek([day(week[0]), day(week[1])], library, options({ leftovers: true }));
    const lunch = proposed(results[1], 'lunch');
    expect(lunch?.leftover).toBe(true);
    expect(lunch?.recipe.id).toBe(proposed(results[0], 'dinner')?.recipe.id);
    expect(proposed(results[1], 'dinner')?.recipe.id).not.toBe(lunch?.recipe.id);
  });

  it('skips a leftover too big for a fast day', () => {
    const plan = { ...emptyDayPlan(week[0]), meals: [planMeal(library[9], 'dinner')] };
    const results = planWeek([day(week[0], { plan }), day(week[1], { fast: true, target: 1000 })], library, options({ leftovers: true }));
    expect(proposed(results[1], 'lunch')?.leftover).toBe(false);
  });

  it('uses a planned dinner, with its sides, for the next lunch', () => {
    const side = recipe('rice', 'dinner', 200);
    const dinner = { ...planMeal(library[7], 'dinner'), sides: [side] };
    const results = planWeek(
      [day(week[0], { plan: { ...emptyDayPlan(week[0]), meals: [dinner] } }), day(week[1])],
      library,
      options({ leftovers: true }),
    );
    expect(proposed(results[1], 'lunch')).toMatchObject({ leftover: true, calories: 850, sides: [side] });
  });

  it("doesn't repeat a dinner over a week when there are enough recipes", () => {
    const results = planWeek(week.slice(0, 5).map(d => day(d)), library, options());
    const dinners = results.map(r => proposed(r, 'dinner')?.recipe.id);
    expect(new Set(dinners).size).toBe(5);
  });

  it('honours pins: a picked recipe, or a slot left open', () => {
    const pins = { [slotKey(week[0], 'dinner')]: 'roast', [slotKey(week[0], 'breakfast')]: null };
    const [result] = planWeek([day(week[0])], library, options({ pins }));
    expect(proposed(result, 'dinner')?.recipe.id).toBe('roast');
    expect(result.slots.breakfast).toEqual({ kind: 'open', reason: 'removed' });
  });

  it('follows a wish for the week: avoided recipes never, preferred ones first', () => {
    const results = planWeek(week.slice(0, 3).map(d => day(d)), library, options({ avoid: new Set(['salmon']), prefer: new Set(['pork']) }));
    const dinners = results.map(r => proposed(r, 'dinner')?.recipe.id);
    expect(dinners).not.toContain('salmon');
    expect(dinners).toContain('pork');
  });

  it('is the same for the same seed, and swaps to another recipe once one is rejected', () => {
    const days = [day(week[0])];
    const first = planWeek(days, library, options());
    expect(planWeek(days, library, options())).toEqual(first);
    const dinner = proposed(first[0], 'dinner')!.recipe.id;
    const swapped = planWeek(days, library, options({ rejected: { [slotKey(week[0], 'dinner')]: [dinner] } }));
    expect(proposed(swapped[0], 'dinner')?.recipe.id).not.toBe(dinner);
  });

  it('leaves side dishes out', () => {
    const lunches = [{ ...recipe('slaw', 'lunch', 150), tags: ['Side dish'] }, recipe('soup', 'lunch', 350), ...library.filter(r => r.slot === 'dinner')];
    const [result] = planWeek([day(week[0])], lunches, options());
    expect(proposed(result, 'lunch')?.recipe.id).toBe('soup');
  });

  it('says when no recipe fits a slot', () => {
    const [result] = planWeek([day(week[0])], library.filter(r => r.slot === 'dinner'), options());
    expect(result.slots.breakfast).toEqual({ kind: 'open', reason: 'none' });
    expect(proposed(result, 'lunch')).toBeDefined();
  });

  it('pins every proposal with pinsOf', () => {
    const results = planWeek([day(week[0])], library, options());
    expect(planWeek([day(week[0])], library, options({ seed: 99, pins: pinsOf(results) }))).toEqual(results);
  });
});

describe('proteinOf', () => {
  it('reads the main protein from the name, in English or Swedish', () => {
    expect(proteinOf({ name: 'Baked salmon', tags: [] })).toBe('fish');
    expect(proteinOf({ name: 'Kycklinggryta', tags: [] })).toBe('poultry');
    expect(proteinOf({ name: 'Chickpea curry', tags: [] })).toBe('plant');
    expect(proteinOf({ name: 'Green salad', tags: [] })).toBeUndefined();
  });
});

const proposals = (result: DayResult) => proposalsOf([result]);
