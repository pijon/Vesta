import { Recipe } from './types';

/**
 * Get the background and text color for a recipe category
 */
export function getCategoryColor(type: Recipe['type']): { bg: string; text: string } {
  switch (type) {
    case 'breakfast':
      return { bg: 'bg-amber-100', text: 'text-amber-700' };
    case 'main meal':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700' };
    case 'snack':
      return { bg: 'bg-purple-100', text: 'text-purple-700' };
    case 'light meal':
      return { bg: 'bg-sky-100', text: 'text-sky-700' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-700' };
  }
}
