import { KnownFood } from '../types';

/** Words that don't identify a food ("chicken with rice" should match "chicken rice") */
const FILLER = new Set(['a', 'an', 'and', 'of', 'the', 'with', 'in', 'on', 'my', 'some', 'och', 'med', 'en', 'ett', 'i', 'pa']);

/** Lowercase, accents folded and punctuation dropped, so "Kycklinggryta!" and "kycklinggryta" compare equal */
export const normalizeFoodName = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const words = (name: string) => normalizeFoodName(name).split(' ').filter(w => w && !FILLER.has(w));

/** The known food named exactly like this text, if any */
export const exactKnownFood = (text: string, foods: KnownFood[]): KnownFood | undefined => {
  const key = normalizeFoodName(text);
  return key ? foods.find(f => normalizeFoodName(f.name) === key) : undefined;
};

/**
 * Known foods for a search-as-you-type list: every word typed starts a word of the name.
 * Exact names first, then recipes, then shorter names.
 */
export const searchKnownFoods = (query: string, foods: KnownFood[], limit = 4): KnownFood[] => {
  const typed = words(query);
  if (!typed.length) return [];
  const key = normalizeFoodName(query);
  return foods
    .filter(f => {
      const name = words(f.name);
      return typed.every(t => name.some(w => w.startsWith(t)));
    })
    .sort((a, b) =>
      Number(normalizeFoodName(b.name) === key) - Number(normalizeFoodName(a.name) === key)
      || Number(b.source === 'recipe') - Number(a.source === 'recipe')
      || a.name.length - b.name.length)
    .slice(0, limit);
};

/**
 * Known foods that may be mentioned in a free-text description ("2 eggs and my overnight oats"),
 * for the AI to reuse instead of guessing. Ranked by the number of words shared.
 */
export const knownFoodsMentioned = (text: string, foods: KnownFood[], limit = 25): KnownFood[] => {
  const typed = words(text).filter(w => w.length >= 3);
  if (!typed.length) return [];
  return foods
    .map(f => ({ f, shared: words(f.name).filter(w => w.length >= 3 && typed.some(t => t.startsWith(w) || w.startsWith(t))).length }))
    .filter(x => x.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map(x => x.f);
};
