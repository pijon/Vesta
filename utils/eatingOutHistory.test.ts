import { describe, expect, it } from 'vitest';
import { EatingOutDish } from '../types';
import { dishLabel, editDish, rememberDish, removeDish, suggestDishes } from './eatingOutHistory';

const dish = (fields: Partial<EatingOutDish> = {}): EatingOutDish => ({
  id: 'd1', place: 'Thai corner', dish: 'Pad thai', calories: 780, times: 1, lastHad: '2026-10-01', ...fields,
});

describe('rememberDish', () => {
  it('adds a new dish', () => {
    const next = rememberDish([], { place: ' Thai corner ', dish: 'Pad thai', calories: 780.4, protein: 30 }, '2026-10-15');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ place: 'Thai corner', dish: 'Pad thai', calories: 780, protein: 30, times: 1, lastHad: '2026-10-15' });
  });

  it('counts a dish eaten again, with the latest calories, whatever the casing', () => {
    const next = rememberDish([dish()], { place: 'thai corner', dish: 'PAD THAI', calories: 720 }, '2026-10-15');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ calories: 720, times: 2, lastHad: '2026-10-15' });
  });

  it('keeps the known protein when the new entry has none', () => {
    const next = rememberDish([dish({ protein: 30 })], { place: 'Thai corner', dish: 'Pad thai', calories: 700 }, '2026-10-15');
    expect(next[0].protein).toBe(30);
  });

  it('does not move lastHad back when an older day is logged late', () => {
    const next = rememberDish([dish({ lastHad: '2026-10-10' })], { place: 'Thai corner', dish: 'Pad thai', calories: 700 }, '2026-10-02');
    expect(next[0].lastHad).toBe('2026-10-10');
  });

  it('remembers a place alone, but not nothing', () => {
    expect(rememberDish([], { place: 'Thai corner', dish: '', calories: 700 }, '2026-10-15')).toHaveLength(1);
    expect(rememberDish([], { place: ' ', dish: '', calories: 700 }, '2026-10-15')).toEqual([]);
  });
});

describe('suggestDishes', () => {
  const pizza = dish({ id: 'p', place: 'Luigi', dish: 'Pizza', calories: 1000 });
  const salad = dish({ id: 's', place: 'Luigi', dish: 'Salad', calories: 450 });
  const pad = dish({ id: 't', times: 4 });

  it('puts dishes that fit the budget first, favourites on top', () => {
    expect(suggestDishes([pizza, salad, pad], { budget: 800 }).map(d => d.id)).toEqual(['t', 's', 'p']);
  });

  it('filters by what is typed, in the place or the dish', () => {
    expect(suggestDishes([pizza, salad, pad], { term: 'luigi' }).map(d => d.id).sort()).toEqual(['p', 's']);
    expect(suggestDishes([pizza, salad, pad], { term: 'pad' }).map(d => d.id)).toEqual(['t']);
    expect(suggestDishes([pizza, salad, pad], { term: 'sushi' })).toEqual([]);
  });

  it('limits the list', () => {
    expect(suggestDishes([pizza, salad, pad], { limit: 2 })).toHaveLength(2);
  });
});

describe('dishLabel', () => {
  it('joins dish and place, or shows whichever exists', () => {
    expect(dishLabel({ place: 'Thai corner', dish: 'Pad thai' })).toBe('Pad thai at Thai corner');
    expect(dishLabel({ place: 'Thai corner', dish: '' })).toBe('Thai corner');
    expect(dishLabel({ place: '', dish: 'Pad thai' })).toBe('Pad thai');
  });
});

describe('editDish', () => {
  it('corrects a row in place', () => {
    const next = editDish([dish()], 'd1', { place: 'Siam', dish: 'Pad see ew', calories: 700.2 });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'd1', place: 'Siam', dish: 'Pad see ew', calories: 700, times: 1 });
  });

  it('merges into another row when the fix makes them the same', () => {
    const typo = dish({ id: 'typo', dish: 'Pad tai', times: 2, lastHad: '2026-10-12' });
    const next = editDish([dish({ times: 3 }), typo], 'typo', { place: 'Thai corner', dish: 'Pad thai', calories: 750 });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: 'typo', times: 5, lastHad: '2026-10-12', calories: 750 });
  });

  it('ignores an unknown id or an empty place and dish', () => {
    const dishes = [dish()];
    expect(editDish(dishes, 'nope', { place: 'a', dish: 'b', calories: 1 })).toBe(dishes);
    expect(editDish(dishes, 'd1', { place: ' ', dish: '', calories: 1 })).toBe(dishes);
  });
});

describe('removeDish', () => {
  it('drops the row', () => {
    expect(removeDish([dish(), dish({ id: 'd2' })], 'd1').map(d => d.id)).toEqual(['d2']);
  });
});
