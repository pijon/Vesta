import { describe, expect, it } from 'vitest';
import { ingredientKey, parseIngredientLine, readRecipeLines } from './ingredientParse';

describe('parseIngredientLine', () => {
  it.each([
    ['400 g broccoli', 'broccoli', 400, 'g'],
    ['500g chicken breast', 'chicken breast', 500, 'g'],
    ['1 ½ dl grädde', 'grädde', 1.5, 'dl'],
    ['1,5 dl mjölk', 'mjölk', 1.5, 'dl'],
    ['½ tsk salt', 'salt', 0.5, 'tsk'],
    ['2 msk olivolja', 'olivolja', 2, 'msk'],
    ['2 tbsp olive oil', 'olive oil', 2, 'tbsp'],
    ['1 1/2 cups of rice', 'rice', 1.5, 'cup'],
    ['2 eggs, beaten', 'eggs', 2, 'item'],
    ['1 large onion, diced', 'onion', 1, 'item'],
    ['2-3 cloves garlic', 'garlic', 3, 'clove'],
    ['2 klyftor vitlök, pressade', 'vitlök', 2, 'klyfta'],
    ['1 burk krossade tomater (400 g)', 'krossade tomater', 1, 'burk'],
    ['3 st ägg', 'ägg', 3, 'item'],
    ['2 lökar', 'lökar', 2, 'item'],
    ['1 pound chicken drumsticks', 'chicken drumsticks', 1, 'lb'],
    ['4 kycklinglårfiléer', 'kycklinglårfiléer', 4, 'item'],
    ['1 l vatten', 'vatten', 1, 'l'],
    ['ca 500 g sötpotatis', 'sötpotatis', 500, 'g'],
    ['1/2 påse rucola (à 65 g)', 'rucola', 0.5, 'påse'],
    ['1 rågad msk blandade frön (ungefär 12 g)', 'blandade frön', 1, 'msk'],
    ['2 kycklingfiléer à cirka 150 g', 'kycklingfiléer', 2, 'item'],
    ['4 tsk extra virgin olivolja', 'olivolja', 4, 'tsk'],
    ['4 rashers of streaky bacon', 'streaky bacon', 4, 'rasher'],
    ['1 bulb garlic, halved (optional)', 'garlic', 1, 'bulb'],
  ])('reads "%s"', (text, name, quantity, unit) => {
    expect(parseIngredientLine(text)).toEqual({ text, name, quantity, unit });
  });

  it.each([
    'Salt and pepper to taste',
    'Fresh basil',
    'Juice of 1 lemon',
    '1 tsk salt och peppar',
    '2 x 400 g tomatoes',
    '1 handful of something rather long to be one food',
    '3 tbsp',
  ])('leaves "%s" to the AI', text => {
    expect(parseIngredientLine(text)).toBeNull();
  });
});

describe('ingredientKey', () => {
  it('folds singular and plural together', () => {
    expect(ingredientKey('eggs')).toBe(ingredientKey('egg'));
    expect(ingredientKey('Tomatoes')).toBe(ingredientKey('tomato'));
    expect(ingredientKey('red berries')).toBe(ingredientKey('red berry'));
    expect(ingredientKey('chicken breasts')).toBe(ingredientKey('chicken breast'));
    expect(ingredientKey('swiss')).toBe('swiss');
  });
});

describe('readRecipeLines', () => {
  it('keeps earlier readings, reads new lines and drops lines no longer in the recipe', () => {
    const fromAi = { text: 'Salt to taste', name: 'salt', quantity: 1, unit: 'pinch' };
    const gone = { text: '1 lemon', name: 'lemon', quantity: 1, unit: 'item' };
    expect(readRecipeLines(['400 g broccoli', 'Salt to taste', 'Fresh basil'], [fromAi, gone])).toEqual([
      { text: '400 g broccoli', name: 'broccoli', quantity: 400, unit: 'g' },
      fromAi,
    ]);
  });
});
