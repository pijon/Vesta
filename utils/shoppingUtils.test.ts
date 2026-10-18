import { describe, expect, it } from 'vitest';
import { DayPlan, Recipe } from '../types';
import { extractMealsFromPlan, hasThingsToBuy } from './shoppingUtils';
import { formatAmount } from './scaleIngredient';

const recipe = (fields: Partial<Recipe> = {}): Recipe => ({
  id: 'r1', name: 'Chili', calories: 500, ingredients: ['1 onion'], tags: [], servings: 4, ...fields,
});
const day = (date: string, meals: Recipe[]): DayPlan => ({ date, meals, completedMealIds: [] });

describe('extractMealsFromPlan', () => {
  it('lists meals from today on, by date, keyed by instance', () => {
    const meals = extractMealsFromPlan({
      '2026-10-18': day('2026-10-18', [recipe({ id: 'b', instanceId: 'i2' })]),
      '2026-10-16': day('2026-10-16', [recipe({ id: 'old' })]),
      '2026-10-17': day('2026-10-17', [recipe({ id: 'a', instanceId: 'i1' })]),
    }, '2026-10-17');
    expect(meals.map(m => [m.date, m.key])).toEqual([['2026-10-17', 'i1'], ['2026-10-18', 'i2']]);
  });

  it('marks quick meals and falls back to a positional key', () => {
    const [meal] = extractMealsFromPlan({
      '2026-10-17': day('2026-10-17', [recipe({ quick: {} })]),
    }, '2026-10-17');
    expect(meal).toMatchObject({ key: '2026-10-17/r1/0', parts: [{ id: 'r1', isQuick: true }] });
  });

  it('brings a meal\'s sides along, and a family meal in several plans once', () => {
    const side = recipe({ id: 'rice', name: 'Rice', ingredients: ['2 dl rice'] });
    const meals = extractMealsFromPlan({
      '2026-10-17': day('2026-10-17', [recipe({ instanceId: 'i1', sides: [side] }), recipe({ instanceId: 'i1' })]),
    }, '2026-10-17');
    expect(meals).toHaveLength(1);
    expect(meals[0].parts.map(p => [p.id, p.ingredients])).toEqual([['r1', ['1 onion']], ['rice', ['2 dl rice']]]);
  });
});

describe('hasThingsToBuy', () => {
  it('leaves out leftovers and meals with no ingredients', () => {
    const [cook, leftover, empty] = extractMealsFromPlan({
      '2026-10-17': day('2026-10-17', [recipe(), recipe({ isLeftover: true }), recipe({ ingredients: [] })]),
    }, '2026-10-17');
    expect([cook, leftover, empty].map(hasThingsToBuy)).toEqual([true, false, false]);
  });

  it('counts a side with ingredients', () => {
    const [meal] = extractMealsFromPlan({
      '2026-10-17': day('2026-10-17', [recipe({ ingredients: [], sides: [recipe({ id: 'rice', ingredients: ['2 dl rice'] })] })]),
    }, '2026-10-17');
    expect(hasThingsToBuy(meal)).toBe(true);
  });
});

describe('formatAmount', () => {
  it('rounds scaled amounts for reading', () => {
    expect(formatAmount(2 / 3, 'cup')).toBe('⅔ cup');
    expect(formatAmount(1.5, 'tbsp')).toBe('1½ tbsp');
    expect(formatAmount(0.4444, 'dl')).toBe('0.4 dl');
    expect(formatAmount(3, 'item')).toBe('3');
  });
});
