import { Recipe } from '../types';
import { mealCalories } from './planUtils';

export interface FamilyDinner {
  id: string;
  name: string;
  calories: number;
  /** "You", a member's first name, or undefined when the adder is unknown */
  addedBy?: string;
}

export interface FamilyDay {
  date: string;
  dinners: FamilyDinner[];
}

/** The family's shared dinners for each of `dates`, in that order (days with none are kept, empty). */
export const groupFamilyDinners = (
  byDate: Record<string, Recipe[]>,
  names: Map<string, string>,
  myUid: string | null,
  dates: string[],
): FamilyDay[] =>
  dates.map(date => ({
    date,
    dinners: (byDate[date] ?? []).map(meal => ({
      id: meal.instanceId ?? meal.id,
      name: meal.name,
      calories: mealCalories(meal),
      addedBy: !meal.addedBy ? undefined : meal.addedBy === myUid ? 'You' : names.get(meal.addedBy),
    })),
  }));
