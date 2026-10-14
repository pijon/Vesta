import { describe, expect, it } from 'vitest';
import { KnownFood } from '../types';
import { exactKnownFood, knownFoodsMentioned, normalizeFoodName, searchKnownFoods } from './foodMatch';

const food = (name: string, calories: number, source: KnownFood['source'] = 'log'): KnownFood => ({ name, calories, source });

const foods = [
  food('Salty fudge protein bar', 250),
  food('Protein bar', 220),
  food('Proteindryck', 200),
  food('Chicken rice', 600, 'recipe'),
  food('Kycklinggryta', 550, 'recipe'),
  food('Ägg', 70),
  food('Black coffee', 5),
];

describe('normalizeFoodName', () => {
  it('folds case, accents and punctuation', () => {
    expect(normalizeFoodName('  Kycklinggryta! ')).toBe('kycklinggryta');
    expect(normalizeFoodName('Ägg & bacon')).toBe('agg bacon');
    expect(normalizeFoodName('Crème brûlée')).toBe('creme brulee');
  });
});

describe('exactKnownFood', () => {
  it('matches the whole name, ignoring case and punctuation', () => {
    expect(exactKnownFood('protein BAR.', foods)?.calories).toBe(220);
    expect(exactKnownFood('protein', foods)).toBeUndefined();
    expect(exactKnownFood('   ', foods)).toBeUndefined();
  });
});

describe('searchKnownFoods', () => {
  it('matches word prefixes in any order', () => {
    expect(searchKnownFoods('bar prot', foods).map(f => f.name)).toEqual(['Protein bar', 'Salty fudge protein bar']);
  });

  it('puts an exact name first, then recipes, then shorter names', () => {
    expect(searchKnownFoods('protein bar', foods)[0].name).toBe('Protein bar');
    expect(searchKnownFoods('prot', foods).map(f => f.name)).toEqual(['Protein bar', 'Proteindryck', 'Salty fudge protein bar']);
    expect(searchKnownFoods('c', [food('Coffee', 5), food('Chili', 400, 'recipe')]).map(f => f.name)).toEqual(['Chili', 'Coffee']);
  });

  it('ignores filler words and accents', () => {
    expect(searchKnownFoods('chicken with rice', foods).map(f => f.name)).toEqual(['Chicken rice']);
    expect(searchKnownFoods('agg', foods).map(f => f.name)).toEqual(['Ägg']);
  });

  it('caps the list and returns nothing for empty input', () => {
    expect(searchKnownFoods('p', foods, 2)).toHaveLength(2);
    expect(searchKnownFoods('with', foods)).toEqual([]);
  });
});

describe('knownFoodsMentioned', () => {
  it('finds foods named in a description, most shared words first', () => {
    const found = knownFoodsMentioned('half a protein bar and a black coffee', foods).map(f => f.name);
    expect(found.slice(0, 3)).toEqual(['Salty fudge protein bar', 'Protein bar', 'Black coffee']);
    expect(found).not.toContain('Kycklinggryta');
  });

  it('ignores words shorter than three letters', () => {
    expect(knownFoodsMentioned('a bit of it', foods)).toEqual([]);
  });
});
