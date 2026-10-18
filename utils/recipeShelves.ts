import { Recipe } from '../types';
import { parseLocalDate } from './dateUtils';

/** A shelf with fewer recipes than this isn't shown */
export const MIN_SHELF = 3;
/** How many recipes a shelf holds */
export const SHELF_SIZE = 10;
/** Last had at least this many days ago to count as "not had in a while" */
export const NOT_HAD_DAYS = 21;

const daysBetween = (from: string, to: string) =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);

/**
 * Recipes had before but not for a while (oldest first), leaving out any already planned again.
 * Recipes never had aren't here: the shelf is for reminders of what you liked, not a to-try list.
 */
export const notHadInAWhile = (
  recipes: Recipe[],
  lastHad: Record<string, string>,
  next: Record<string, string>,
  today: string,
): Recipe[] => {
  const picked = recipes
    .filter(r => lastHad[r.id] && !next[r.id] && daysBetween(lastHad[r.id], today) >= NOT_HAD_DAYS)
    .sort((a, b) => lastHad[a.id].localeCompare(lastHad[b.id]) || a.name.localeCompare(b.name))
    .slice(0, SHELF_SIZE);
  return picked.length >= MIN_SHELF ? picked : [];
};

/** Favourites, the ones not had for longest first (never had leads), so the shelf suggests rather than repeats */
export const favouritesShelf = (recipes: Recipe[], lastHad: Record<string, string>): Recipe[] => {
  const picked = recipes
    .filter(r => r.isFavorite)
    .sort((a, b) => (lastHad[a.id] ?? '').localeCompare(lastHad[b.id] ?? '') || a.name.localeCompare(b.name))
    .slice(0, SHELF_SIZE);
  return picked.length >= MIN_SHELF ? picked : [];
};

/** Meals, not sides or drinks: under this many kcal a recipe isn't ranked by protein */
export const MIN_MEAL_KCAL = 150;

/** Grams of protein per 100 kcal, the measure behind "protein for the calories" */
export const proteinDensity = (r: Recipe) => (r.calories > 0 ? ((r.protein || 0) / r.calories) * 100 : 0);

const proteinMeals = (recipes: Recipe[]) => recipes.filter(r => (r.protein || 0) > 0 && r.calories >= MIN_MEAL_KCAL);

/** The most protein in a portion, highest first */
export const mostProteinShelf = (recipes: Recipe[]): Recipe[] => {
  const picked = proteinMeals(recipes)
    .sort((a, b) => (b.protein || 0) - (a.protein || 0) || a.name.localeCompare(b.name))
    .slice(0, SHELF_SIZE);
  return picked.length >= MIN_SHELF ? picked : [];
};

/** The most protein for the calories (good on fast days), densest first */
export const proteinPerCalorieShelf = (recipes: Recipe[]): Recipe[] => {
  const picked = proteinMeals(recipes)
    .sort((a, b) => proteinDensity(b) - proteinDensity(a) || a.name.localeCompare(b.name))
    .slice(0, SHELF_SIZE);
  return picked.length >= MIN_SHELF ? picked : [];
};
