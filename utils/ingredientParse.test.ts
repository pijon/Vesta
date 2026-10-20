import { describe, expect, it } from 'vitest';
import { ingredientKey, parseIngredientLine, readRecipeLines } from './ingredientParse';

describe('salt and pepper', () => {
  it.each([
    ['salt', 'salt'], ['½ tsk salt', 'salt'], ['Salt 1 matsked', 'salt'], ['Sea salt', 'salt'], ['A pinch of salt', 'salt'],
    ['svartpeppar, nymalen', 'pepper'], ['freshly ground black pepper', 'pepper'], ['Black pepper', 'pepper'], ['0 krm svartpeppar', 'pepper'],
    ['salt och nymalen svartpeppar', 'salt and pepper'], ['Kosher salt and freshly ground black pepper to taste', 'salt and pepper'],
  ])('%s is listed as %s with no amount', (text, name) => {
    expect(parseIngredientLine(text)).toEqual({ text, name, quantity: 0, unit: 'item' });
  });

  it('leaves other spices to be read normally', () => {
    expect(parseIngredientLine('2 paprikor')?.name).toBe('paprikor');
    expect(parseIngredientLine('1 tsk chilipeppar')?.name).toBe('chilipeppar');
  });
});

describe('lines the AI used to read', () => {
  it.each([
    ['1 tbsp olive or rapeseed oil', 'olive oil', 1, 'tbsp'],
    ['2 msk oliv- eller rapsolja', 'rapsolja', 2, 'msk'],
    ['600 g Kycklinglårfilé (utan skinn) eller kycklingbröstfilé', 'kycklinglårfilé', 600, 'g'],
    ['2 tbsp pumpkin or sunflower seeds, toasted', 'pumpkin seeds', 2, 'tbsp'],
    ['4 slices Parma ham or prosciutto', 'parma ham', 4, 'slice'],
    ['juice of ½ small lemon', 'lemon', 0.5, 'item'],
    ['Juice of 1 lemon', 'lemon', 1, 'item'],
    ['finrivet skal och saft från 1 liten citron', 'citron', 1, 'item'],
    ['saften från 1/2 citron eller 2-3 tsk balsamvinäger', 'citron', 0.5, 'item'],
    ['1 x 400g can chopped tomatoes or 500g passata', 'tomatoes', 1, 'can'],
    ['½ × 400ml can coconut milk', 'coconut milk', 0.5, 'can'],
    ['2 thin slices of rye bread', 'rye bread', 2, 'slice'],
    ['200 g kokta och skalade räkor, tinade', 'kokta räkor', 200, 'g'],
    ['60g hjärtsallat eller isbergssallat', 'hjärtsallat', 60, 'g'],
    ['Kanel 1/2 tesked', 'kanel', 0.5, 'tsk'],
    ['Olivolja 4 matsked', 'olivolja', 4, 'msk'],
    ['Vitlök 3 skivade', 'vitlök', 3, 'item'],
    ['⅔ påse vitvinsvinäger 15ml', 'vitvinsvinäger', 2 / 3, 'påse'],
    ['0 tsk olivolja', 'olivolja', 0, 'item'],
    ['Olja', 'olja', 0, 'item'],
    ['Fresh basil', 'basil', 0, 'item'],
    ['limeklyftor, till servering', 'limeklyftor', 0, 'item'],
    ['citron- eller limeklyftor, till servering (kan uteslutas)', 'limeklyftor', 0, 'item'],
    ['en liten näve rucola', 'rucola', 0, 'item'],
    ['small bunch fresh parsley, leaves finely chopped (around 2 tbsp)', 'parsley', 0, 'item'],
    ['Splash of milk or cream', 'milk', 0, 'item'],
    ['bit olivolja', 'olivolja', 0, 'item'],
  ])('reads "%s"', (text, name, quantity, unit) => {
    expect(parseIngredientLine(text)).toEqual({ text, name, quantity, unit });
  });
});

describe('parseIngredientLine', () => {
  it.each([
    ['400 g broccoli', 'broccoli', 400, 'g'],
    ['500g chicken breast', 'chicken breast', 500, 'g'],
    ['1 ½ dl grädde', 'grädde', 1.5, 'dl'],
    ['1,5 dl mjölk', 'mjölk', 1.5, 'dl'],
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
    '2 x 400 g tomatoes',
    'cut into bite - sized pieces',
    'rice and beans',
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
    const fromAi = { text: 'rice and beans', name: 'rice and beans', quantity: 1, unit: 'item' };
    const gone = { text: '1 lemon', name: 'lemon', quantity: 1, unit: 'item' };
    expect(readRecipeLines(['400 g broccoli', 'rice and beans', '1 x 1 x 1 mystery'], [fromAi, gone])).toEqual([
      { text: '400 g broccoli', name: 'broccoli', quantity: 400, unit: 'g' },
      fromAi,
    ]);
  });
});
