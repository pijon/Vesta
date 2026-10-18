import { describe, expect, it } from 'vitest';
import { ShoppingListItem, ShoppingListSource } from '../types';
import { itemAmount, itemKey, itemMeals, listText, mealsTotal, MealToAdd, planAdditions, planMealRemoval } from './shoppingList';

const source = (quantity: number, unit: string, meal = 'Chili', date = '2026-10-20'): ShoppingListSource => ({ date, meal, quantity, unit });
const item = (fields: Partial<ShoppingListItem>): ShoppingListItem => ({
  id: 'x', key: itemKey(fields.name ?? 'onions', 'item'), name: 'onions', sources: {}, addedBy: 'me', addedAt: 0, ...fields,
});
const meal = (instanceId: string, lines: MealToAdd['lines'], name = 'Chili'): MealToAdd => ({ instanceId, date: '2026-10-20', name, lines });
let ids = 0;
const newId = () => `new${++ids}`;

describe('mealsTotal', () => {
  it('adds up what the meals need, in a unit worth reading', () => {
    expect(mealsTotal([source(2, 'item'), source(1, 'item')])).toBe('3');
    expect(mealsTotal([source(800, 'g'), source(0.4, 'kg')])).toBe('1.2 kg');
    expect(mealsTotal([source(2, 'tsp'), source(1, 'tbsp')])).toBe('1⅔ tbsp');
    expect(mealsTotal([source(2, 'tsk'), source(1, 'krm')])).toBe('2¼ tsk');
    expect(mealsTotal([source(2, 'dl'), source(3, 'msk')])).toBe('2.5 dl');
    expect(mealsTotal([source(250, 'ml'), source(50, 'ml')])).toBe('3 dl');
    expect(mealsTotal([source(3, 'tsp'), source(1, 'tsp')])).toBe('4 tsp');
    expect(mealsTotal([source(2, 'klyfta'), source(3, 'klyfta')])).toBe('5 klyftor');
    expect(mealsTotal([source(1, 'clove')])).toBe('1 clove');
    expect(mealsTotal([])).toBe('');
  });
});

describe('itemAmount', () => {
  it('shows an amount typed in over what the meals need', () => {
    expect(itemAmount(item({ sources: { a: source(2, 'item') } }))).toBe('2');
    expect(itemAmount(item({ sources: { a: source(2, 'item') }, amount: '1 net' }))).toBe('1 net');
    expect(itemAmount(item({ amount: '' }))).toBe('');
  });
});

describe('planAdditions', () => {
  it('adds the same food up across meals and lines, in units that convert', () => {
    const { create, add } = planAdditions([], [
      meal('m1', [{ name: 'eggs', quantity: 2, unit: 'item' }, { name: 'olive oil', quantity: 1, unit: 'tbsp' }]),
      meal('m2', [{ name: 'egg', quantity: 1, unit: 'item' }, { name: 'olive oil', quantity: 2, unit: 'tsp' }, { name: 'olive oil', quantity: 1, unit: 'tsp' }], 'Salad'),
    ], 'me', 5, newId);
    expect(add.size).toBe(0);
    expect(create.map(i => [i.name, itemAmount(i), itemMeals(i)])).toEqual([
      ['eggs', '3', ['Chili', 'Salad']],
      ['olive oil', '2 tbsp', ['Chili', 'Salad']],
    ]);
    expect(create[1].sources.m2).toEqual({ date: '2026-10-20', meal: 'Salad', quantity: 3, unit: 'tsp' });
  });

  it('joins an unticked item already on the list, but not a ticked one or one with a typed amount', () => {
    const open = item({ id: 'open', name: 'onions', sources: { m0: source(1, 'item') } });
    const ticked = item({ id: 'ticked', name: 'garlic', checked: true, sources: { m0: source(1, 'item') } });
    const typed = item({ id: 'typed', name: 'milk', amount: '2 l' });
    const { create, add } = planAdditions([open, ticked, typed], [
      meal('m1', [{ name: 'onion', quantity: 2, unit: 'item' }, { name: 'garlic', quantity: 3, unit: 'item' }, { name: 'milk', quantity: 1, unit: 'item' }]),
    ], 'me', 5, newId);
    expect([...add]).toEqual([['open', { m1: source(2, 'item') }]]);
    expect(create.map(i => i.name)).toEqual(['garlic', 'milk']);
  });
});

describe('planMealRemoval', () => {
  it('removes items only that meal needed and trims the others', () => {
    const items = [
      item({ id: 'only', sources: { m1: source(1, 'item') } }),
      item({ id: 'shared', sources: { m1: source(1, 'item'), m2: source(1, 'item') } }),
      item({ id: 'typed', sources: { m1: source(1, 'item') }, amount: '3' }),
      item({ id: 'other', sources: { m2: source(1, 'item') } }),
    ];
    expect(planMealRemoval(items, 'm1')).toEqual({ remove: ['only'], trim: ['shared', 'typed'] });
  });
});

describe('listText', () => {
  it('lists unticked items with their amounts', () => {
    expect(listText([
      item({ name: 'potatis', sources: { a: source(1200, 'g') } }),
      item({ name: 'toilet paper', amount: '' }),
      item({ name: 'milk', amount: '1 l', checked: true }),
    ])).toBe('1.2 kg potatis\ntoilet paper');
  });
});
