import { describe, expect, it } from 'vitest';
import { recipeTextFromHtml } from './recipeLd.js';

const page = (ld: unknown) => `<html><script type="application/ld+json">${JSON.stringify(ld)}</script></html>`;

describe('recipeTextFromHtml', () => {
  it('writes out a Recipe, decoding double-encoded entities', () => {
    const text = recipeTextFromHtml(page({
      '@type': 'Recipe', name: 'Uerfilé', recipeYield: '2', nutrition: { calories: '541 kcal' },
      recipeIngredient: ['400 g potatis', '½ st purjolök'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Koka l&amp;auml;ttsaltat.' }],
    }));
    expect(text).toContain('Servings: 2');
    expect(text).toContain('Calories: 541 kcal');
    expect(text).toContain('- ½ st purjolök');
    expect(text).toContain('1. Koka lättsaltat.');
  });

  it('finds a Recipe inside @graph and skips other blocks', () => {
    const text = recipeTextFromHtml(page({ '@graph': [{ '@type': 'WebPage' }, { '@type': ['Recipe'], name: 'A', recipeIngredient: ['x'] }] }));
    expect(text).toContain('A');
  });

  it('returns null without a usable Recipe', () => {
    expect(recipeTextFromHtml(page({ '@type': 'Organization', name: 'x' }))).toBeNull();
    expect(recipeTextFromHtml('<html></html>')).toBeNull();
  });
});
