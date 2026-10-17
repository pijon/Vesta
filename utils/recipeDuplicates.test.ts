import { describe, expect, it } from 'vitest';
import { Recipe } from '../types';
import { duplicateRecipeIds, findSameName, recipeNameKey } from './recipeDuplicates';

const recipe = (id: string, name: string): Recipe => ({
  id, name, description: '', calories: 0, protein: 0, fat: 0, carbs: 0,
  ingredients: [], instructions: [], tags: [], servings: 1,
});

describe('recipeNameKey', () => {
  it('ignores case, punctuation and spacing', () => {
    expect(recipeNameKey('  Japchae - sojamarinerade  nudlar ')).toBe(recipeNameKey('japchae sojamarinerade nudlar'));
    expect(recipeNameKey('Avokado-och fetaoströra')).toBe('avokado och fetaoströra');
  });

  it('keeps Swedish letters apart', () => {
    expect(recipeNameKey('Rotfrukter med ål')).not.toBe(recipeNameKey('Rotfrukter med al'));
  });
});

describe('duplicateRecipeIds', () => {
  it('finds every recipe that shares a name', () => {
    const ids = duplicateRecipeIds([
      recipe('a', 'Indiska kikärtsbiffar'),
      recipe('b', 'indiska kikärtsbiffar'),
      recipe('c', 'Laxburgare'),
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('ignores recipes without a name', () => {
    expect(duplicateRecipeIds([recipe('a', ''), recipe('b', ' ')]).size).toBe(0);
  });
});

describe('findSameName', () => {
  it('finds a recipe already in the library', () => {
    const library = [recipe('a', 'Enkel fiskgryta'), recipe('b', 'Laxburgare')];
    expect(findSameName(library, 'Enkel Fiskgryta!')?.id).toBe('a');
    expect(findSameName(library, 'Fiskgryta')).toBeUndefined();
  });
});
