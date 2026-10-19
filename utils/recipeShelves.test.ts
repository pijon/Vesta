import { describe, expect, it } from 'vitest';
import { Recipe } from '../types';
import { byKnownCalories, favouritesShelf, mostProteinShelf, notHadInAWhile, proteinPerCalorieShelf } from './recipeShelves';

const TODAY = '2026-10-17';
const recipe = (id: string, extra: Partial<Recipe> = {}) => ({ id, name: id, calories: 400, ...extra }) as Recipe;
const ids = (rs: Recipe[]) => rs.map(r => r.id);

describe('notHadInAWhile', () => {
  const recipes = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => recipe(id));
  const lastHad = { a: '2026-08-01', b: '2026-09-20', c: '2026-09-26', d: '2026-10-10', e: '2026-09-01' };

  it('keeps recipes last had three weeks ago or more, oldest first', () => {
    expect(ids(notHadInAWhile(recipes, lastHad, {}, TODAY))).toEqual(['a', 'e', 'b', 'c']);
  });

  it('leaves out recipes never had and ones planned again', () => {
    const shelf = ids(notHadInAWhile(recipes, lastHad, { e: '2026-10-20' }, TODAY));
    expect(shelf).not.toContain('f');
    expect(shelf).not.toContain('e');
  });

  it('is empty with fewer than three', () => {
    expect(notHadInAWhile(recipes, { a: '2026-08-01', b: '2026-09-01' }, {}, TODAY)).toEqual([]);
  });
});

describe('favouritesShelf', () => {
  it('puts the favourites not had for longest first', () => {
    const recipes = [
      recipe('x', { isFavorite: true }), recipe('y', { isFavorite: true }), recipe('z', { isFavorite: true }), recipe('n'),
    ];
    expect(ids(favouritesShelf(recipes, { x: '2026-10-15', y: '2026-09-01' }))).toEqual(['z', 'y', 'x']);
  });

  it('is empty with fewer than three favourites', () => {
    expect(favouritesShelf([recipe('x', { isFavorite: true }), recipe('y', { isFavorite: true })], {})).toEqual([]);
  });
});

describe('protein shelves', () => {
  const recipes = [
    recipe('big', { protein: 60, calories: 650 }),
    recipe('lean', { protein: 38, calories: 190 }),
    recipe('mid', { protein: 40, calories: 400 }),
    recipe('none', { protein: 0, calories: 300 }),
    recipe('shake', { protein: 25, calories: 100 }),
  ];

  it('ranks by protein in a portion, leaving out missing protein and tiny items', () => {
    expect(ids(mostProteinShelf(recipes))).toEqual(['big', 'mid', 'lean']);
  });

  it('ranks by protein per calorie', () => {
    expect(ids(proteinPerCalorieShelf(recipes))).toEqual(['lean', 'mid', 'big']);
  });

  it('is empty with fewer than three', () => {
    expect(mostProteinShelf(recipes.slice(0, 2))).toEqual([]);
    expect(proteinPerCalorieShelf(recipes.slice(0, 2))).toEqual([]);
  });
});

describe('calorie sort', () => {
  const r = (name: string, calories: number, calorieStatus?: 'known' | 'unknown'): Recipe =>
    ({ id: name, name, calories, calorieStatus, ingredients: [], tags: [], servings: 1 });
  const recipes = [r('Stew', 700, 'known'), r('Soup', 0, 'unknown'), r('Broth', 0, 'known'), r('Bake', 500, 'unknown'), r('Salad', 300, 'known')];
  const names = (direction: 1 | -1) => [...recipes].sort((a, b) => byKnownCalories(a, b, direction)).map(x => x.name);

  it('puts unknown calories last whichever way, keeping a known zero with the known', () => {
    expect(names(1)).toEqual(['Broth', 'Salad', 'Stew', 'Bake', 'Soup']);
    expect(names(-1)).toEqual(['Stew', 'Salad', 'Broth', 'Bake', 'Soup']);
  });
});
