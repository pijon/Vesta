import { describe, expect, it } from 'vitest';
import { DayPlan, ParsedIngredient, Recipe } from '../types';
import { aggregateIngredients, extractMealsFromPlan, hasThingsToBuy, toShoppingItems } from './shoppingUtils';
import { formatAmount } from './scaleIngredient';

const recipe = (fields: Partial<Recipe> = {}): Recipe => ({
  id: 'r1', name: 'Chili', calories: 500, ingredients: ['1 onion'], tags: [], servings: 4, ...fields,
});
const day = (date: string, meals: Recipe[]): DayPlan => ({ date, meals, completedMealIds: [] });
const parsed = (fields: Partial<ParsedIngredient>): ParsedIngredient => ({
  id: crypto.randomUUID(), originalText: '', name: 'onions', quantity: 1, unit: 'item', recipeId: 'r1', recipeName: 'Chili', ...fields,
});

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
    expect(meal).toMatchObject({ key: '2026-10-17/r1/0', isQuick: true, servings: 4 });
  });
});

describe('hasThingsToBuy', () => {
  it('leaves out leftovers and meals with no ingredients', () => {
    const [cook, leftover, empty] = extractMealsFromPlan({
      '2026-10-17': day('2026-10-17', [recipe(), recipe({ isLeftover: true }), recipe({ ingredients: [] })]),
    }, '2026-10-17');
    expect([cook, leftover, empty].map(hasThingsToBuy)).toEqual([true, false, false]);
  });
});

describe('aggregateIngredients', () => {
  it('adds up the same ingredient across recipes and keeps other units apart', () => {
    const result = aggregateIngredients([
      parsed({ name: 'olive oil', quantity: 2, unit: 'tbsp' }),
      parsed({ name: 'olive oil', quantity: 1, unit: 'tbsp', recipeId: 'r2', recipeName: 'Salad' }),
      parsed({ name: 'olive oil', quantity: 100, unit: 'ml', recipeId: 'r2', recipeName: 'Salad' }),
      parsed({ name: 'olive oil', quantity: 50, unit: 'ml' }),
      parsed({ name: 'garlic', quantity: 2 }),
    ]);
    expect(result.map(r => [r.name, r.totalQuantity, r.unit])).toEqual([
      ['garlic', 2, 'item'],
      ['olive oil', 3, 'tbsp'],
      ['olive oil (ml)', 150, 'ml'],
    ]);
    expect(result[1].recipes).toEqual([
      { id: 'r1', name: 'Chili', quantity: 2 },
      { id: 'r2', name: 'Salad', quantity: 1 },
    ]);
  });

  it('adds up singular and plural under the first name seen', () => {
    const result = aggregateIngredients([
      parsed({ name: 'eggs', quantity: 2 }),
      parsed({ name: 'egg', quantity: 1, recipeId: 'r2', recipeName: 'Salad' }),
      parsed({ name: 'Eggs', quantity: 30, unit: 'g' }),
    ]);
    expect(result.map(r => [r.name, r.totalQuantity, r.unit])).toEqual([
      ['eggs', 3, 'item'],
      ['eggs (g)', 30, 'g'],
    ]);
  });
});

describe('toShoppingItems', () => {
  it('lists each ingredient at the amount the recipes need', () => {
    expect(toShoppingItems([
      { name: 'olive oil', quantity: 3, unit: 'tbsp' },
      { name: 'chicken breast', quantity: 333.33, unit: 'g' },
    ])).toEqual([
      { ingredientName: 'olive oil', requiredQuantity: '3 tbsp', purchasableQuantity: '3 tbsp', purchasableSize: '' },
      { ingredientName: 'chicken breast', requiredQuantity: '335 g', purchasableQuantity: '335 g', purchasableSize: '' },
    ]);
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
