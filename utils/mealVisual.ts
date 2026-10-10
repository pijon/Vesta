import { Coffee, Salad, Cookie, UtensilsCrossed, Soup, type LucideIcon } from 'lucide-react';
import { Recipe } from '../types';

export interface MealVisual {
  label: string;
  Icon: LucideIcon;
  /** Tile tint + text classes, used when the meal has no photo */
  tint: string;
}

/** Meal-type label, icon and tint (matches RecipeCard's meal-type tints). */
export const mealVisualFor = (meal: Pick<Recipe, 'tags'>): MealVisual => {
  const tags = (meal.tags || []).map(t => t.toLowerCase());
  if (tags.includes('breakfast')) return { label: 'Breakfast', Icon: Coffee, tint: 'bg-fasting-bg text-fasting-text' };
  if (tags.includes('lunch')) return { label: 'Lunch', Icon: Salad, tint: 'bg-weight-bg text-weight-text' };
  if (tags.includes('dinner') || tags.includes('main meal')) return { label: 'Main meal', Icon: UtensilsCrossed, tint: 'bg-weight-bg text-weight-text' };
  if (tags.includes('snack')) return { label: 'Snack', Icon: Cookie, tint: 'bg-workout-bg text-workout-text' };
  if (tags.includes('light meal')) return { label: 'Light meal', Icon: Soup, tint: 'bg-water-bg text-water-text' };
  const first = meal.tags?.[0];
  return {
    label: first ? first.charAt(0).toUpperCase() + first.slice(1) : 'Meal',
    Icon: UtensilsCrossed,
    tint: 'bg-surface-sunken text-muted',
  };
};
