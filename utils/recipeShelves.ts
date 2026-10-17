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
