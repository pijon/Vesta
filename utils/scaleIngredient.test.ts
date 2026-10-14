import { describe, expect, it } from 'vitest';
import { scaleIngredient } from './scaleIngredient';

describe('scaleIngredient', () => {
  it.each([
    ['500 g chicken', 2, '1000 g chicken'],
    ['250 g butter', 1.5, '375 g butter'],
    ['1 1/2 dl milk', 2, '3 dl milk'],
    ['½ tsp salt', 2, '1 tsp salt'],
    ['1 egg', 0.5, '½ egg'],
    ['2-3 cloves garlic', 2, '4–6 cloves garlic'],
    ['1,5 dl grädde', 3, '4,5 dl grädde'],
    ['4 ½ dl vatten', 2, '9 dl vatten'],
    ['3 tbsp olive oil', 1 / 3, '1 tbsp olive oil'],
    ['1 tbsp honey', 1.5, '1½ tbsp honey'],
  ])('%s × %d → %s', (line, factor, expected) => {
    expect(scaleIngredient(line, factor)).toBe(expected);
  });

  it('leaves lines without a leading amount alone', () => {
    expect(scaleIngredient('Salt and pepper', 2)).toBe('Salt and pepper');
    expect(scaleIngredient('Juice of 1 lemon', 2)).toBe('Juice of 1 lemon');
  });

  it('changes nothing at factor 1', () => {
    expect(scaleIngredient('1,5 dl grädde', 1)).toBe('1,5 dl grädde');
  });
});
