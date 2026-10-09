import { Recipe } from './types';

/**
 * Get the background and text color for a recipe based on its tags
 * Uses more expressive, deeper tones instead of bright pastels
 */
export function getRecipeTheme(tags: string[] = []): { bg: string; text: string } {
  const lowerTags = tags.map(t => t.toLowerCase());

  if (lowerTags.includes('breakfast')) {
    // Warm, golden breakfast tones - amber clay
    return { bg: 'bg-amber-200/80 dark:bg-amber-900/60', text: 'text-amber-800 dark:text-amber-200' };
  }
  if (lowerTags.includes('main meal') || lowerTags.includes('dinner') || lowerTags.includes('lunch')) {
    // Earthy sage
    return { bg: 'bg-sage-200/80 dark:bg-sage-900/60', text: 'text-sage-800 dark:text-sage-200' };
  }
  if (lowerTags.includes('snack')) {
    // Muted plum
    return { bg: 'bg-plum-200/80 dark:bg-plum-900/60', text: 'text-plum-800 dark:text-plum-200' };
  }
  if (lowerTags.includes('light meal')) {
    // Calm ocean
    return { bg: 'bg-ocean-200/80 dark:bg-ocean-900/60', text: 'text-ocean-800 dark:text-ocean-200' };
  }

  // Default: warm stone
  return { bg: 'bg-stone-200/80 dark:bg-stone-900/80', text: 'text-stone-800 dark:text-stone-200' };
}
