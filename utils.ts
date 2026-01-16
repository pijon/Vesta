import { Recipe } from './types';

/**
 * Get the background and text color for a recipe based on its tags
 * Uses more expressive, deeper tones instead of bright pastels
 */
export function getRecipeTheme(tags: string[] = []): { bg: string; text: string } {
  const lowerTags = tags.map(t => t.toLowerCase());

  if (lowerTags.includes('breakfast')) {
    // Warm, golden breakfast tones - deeper amber/orange
    return { bg: 'bg-amber-200/80 dark:bg-amber-950/60', text: 'text-amber-800 dark:text-amber-200' };
  }
  if (lowerTags.includes('main meal') || lowerTags.includes('dinner') || lowerTags.includes('lunch')) {
    // Rich, earthy emerald - deeper green
    return { bg: 'bg-emerald-200/80 dark:bg-emerald-950/60', text: 'text-emerald-800 dark:text-emerald-200' };
  }
  if (lowerTags.includes('snack')) {
    // Deep, expressive purple - more sophisticated
    return { bg: 'bg-purple-200/80 dark:bg-purple-950/60', text: 'text-purple-800 dark:text-purple-200' };
  }
  if (lowerTags.includes('light meal')) {
    // Calm, deeper sky blue
    return { bg: 'bg-sky-200/80 dark:bg-sky-950/60', text: 'text-sky-800 dark:text-sky-200' };
  }

  // Default: sophisticated slate with more depth
  return { bg: 'bg-slate-200/80 dark:bg-slate-900/80', text: 'text-slate-800 dark:text-slate-200' };
}
