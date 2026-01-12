import { Recipe } from './types';

/**
 * Get the background and text color for a recipe based on its tags
 */
export function getRecipeTheme(tags: string[] = []): { bg: string; text: string } {
  const lowerTags = tags.map(t => t.toLowerCase());

  if (lowerTags.includes('breakfast')) {
    return { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300' };
  }
  if (lowerTags.includes('main meal') || lowerTags.includes('dinner') || lowerTags.includes('lunch')) {
    return { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300' };
  }
  if (lowerTags.includes('snack')) {
    return { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300' };
  }
  if (lowerTags.includes('light meal')) {
    return { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300' };
  }

  return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300' };
}
