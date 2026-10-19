import { describe, it, expect } from 'vitest';
import type { Recipe } from '../types';
import { calorieAvailability, normalizeRecipeNutrition, mealNutrition, dayNutrition } from './recipeNutrition';
const r = (fields: Partial<Recipe> = {}): Recipe => ({ id:'r', name:'Meal', calories:400, ingredients:[], tags:[], servings:1, ...fields });
describe('nutrition availability', () => {
  it('distinguishes historical zero, confirmed zero and missing', () => {
    expect(calorieAvailability(r({calories:0}))).toBe('unconfirmed');
    expect(calorieAvailability(r({calories:0,calorieStatus:'known'}))).toBe('known');
    expect(calorieAvailability(r({calorieStatus:'unknown'}))).toBe('unknown');
    expect(calorieAvailability(r({calories:0,quick:{}}))).toBe('known');
    expect(calorieAvailability(r({planOverrides:{calories:0},calories:0}))).toBe('known');
  });
  it.each([undefined,null,-1,Infinity,NaN,'400'])('rejects malformed energy %s', value => {
    const meal = r({calories:value as number});
    expect(calorieAvailability(meal)).toBe('unknown');
    expect(normalizeRecipeNutrition(meal).calorieStatus).toBe('unknown');
  });
  it('honours missing flags over stale positive values', () => {
    expect(calorieAvailability(r({quick:{noCalories:true}}))).toBe('unknown');
    expect(calorieAvailability(r({isMissing:true}))).toBe('unknown');
  });
  it('recurses through sides without pretending the subtotal is complete', () => {
    const meal = r({sides:[r({calories:0}),r({calorieStatus:'unknown',sides:[r({calories:25,caloriesEstimated:true})]})]});
    expect(mealNutrition(meal)).toEqual({knownCalories:425,unknownParts:1,unconfirmedParts:1,complete:false,estimated:true,budget:false});
    expect(dayNutrition()).toMatchObject({knownCalories:0,complete:true});
    expect(normalizeRecipeNutrition(r({calories:0})).calorieStatus).toBeUndefined();
  });
});
