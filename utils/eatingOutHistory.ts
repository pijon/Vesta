import { EatingOutDish } from '../types';
import { normalizeFoodName } from './foodMatch';

const MAX_DISHES = 200;

const sameDish = (a: Pick<EatingOutDish, 'place' | 'dish'>, b: Pick<EatingOutDish, 'place' | 'dish'>) =>
  normalizeFoodName(a.place) === normalizeFoodName(b.place) && normalizeFoodName(a.dish) === normalizeFoodName(b.dish);

/** "Pad thai at Thai corner", or whichever of the two is known. */
export const dishLabel = ({ place, dish }: Pick<EatingOutDish, 'place' | 'dish'>) =>
  dish.trim() ? [dish.trim(), place.trim() && `at ${place.trim()}`].filter(Boolean).join(' ') : place.trim();

/**
 * The history after eating `entry` on `date`: a dish eaten before keeps its row, with today's
 * calories (the latest number is the best one) and one more time; a new one is added. Nothing is
 * added without a place or a dish.
 */
export const rememberDish = (
  dishes: EatingOutDish[],
  entry: { place: string; dish: string; calories: number; protein?: number },
  date: string,
): EatingOutDish[] => {
  const place = entry.place.trim();
  const dish = entry.dish.trim();
  if (!place && !dish) return dishes;
  const calories = Math.round(entry.calories);
  const protein = entry.protein && entry.protein > 0 ? Math.round(entry.protein) : undefined;
  const found = dishes.find(d => sameDish(d, { place, dish }));
  if (found) {
    return dishes.map(d => d === found ? { ...d, calories, protein: protein ?? d.protein, times: d.times + 1, lastHad: date > d.lastHad ? date : d.lastHad } : d);
  }
  const added: EatingOutDish = { id: crypto.randomUUID(), place, dish, calories, protein, times: 1, lastHad: date };
  return [added, ...dishes]
    .sort((a, b) => (a.lastHad < b.lastHad ? 1 : -1))
    .slice(0, MAX_DISHES);
};

/**
 * Past dishes worth showing for what's typed in the place box (empty: all of them). Dishes that
 * fit the budget come first, then ones eaten at the typed place, then the favourites and the
 * recent ones. A dish counts as matching when the term is in its place or its name.
 */
export const suggestDishes = (dishes: EatingOutDish[], { term = '', budget, limit = 8 }: { term?: string; budget?: number; limit?: number } = {}) => {
  const wanted = normalizeFoodName(term);
  const matches = wanted
    ? dishes.filter(d => normalizeFoodName(d.place).includes(wanted) || normalizeFoodName(d.dish).includes(wanted))
    : dishes;
  const fits = (d: EatingOutDish) => budget === undefined || d.calories <= budget;
  return [...matches]
    .sort((a, b) =>
      Number(fits(b)) - Number(fits(a))
      || b.times - a.times
      || (a.lastHad < b.lastHad ? 1 : -1))
    .slice(0, limit);
};

/**
 * A dish with its place, name or calories corrected. If that makes it the same as another row
 * (a typo fixed to match), the two become one: their times add up and the newer date wins.
 */
export const editDish = (
  dishes: EatingOutDish[],
  id: string,
  fields: { place: string; dish: string; calories: number },
): EatingOutDish[] => {
  const place = fields.place.trim();
  const dish = fields.dish.trim();
  const edited = dishes.find(d => d.id === id);
  if (!edited || (!place && !dish)) return dishes;
  const twin = dishes.find(d => d.id !== id && sameDish(d, { place, dish }));
  const merged: EatingOutDish = {
    ...edited, place, dish, calories: Math.round(fields.calories),
    times: edited.times + (twin?.times ?? 0),
    lastHad: twin && twin.lastHad > edited.lastHad ? twin.lastHad : edited.lastHad,
    protein: edited.protein ?? twin?.protein,
  };
  return dishes.filter(d => d.id !== twin?.id).map(d => d.id === id ? merged : d);
};

export const removeDish = (dishes: EatingOutDish[], id: string) => dishes.filter(d => d.id !== id);
