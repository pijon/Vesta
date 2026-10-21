import { DayPlan, ParsedIngredientLine, Recipe } from '../types';
import { withoutHeadings } from './recipeSections';

/** A recipe in a planned meal (its main dish or a side), or a quick meal's shopping items */
export interface PlanMealPart {
  /** The recipe (or quick meal) id */
  id: string;
  name: string;
  ingredients: string[];
  /** Its recipe's ingredient lines read before (see Recipe.parsedIngredients) */
  parsedIngredients?: ParsedIngredientLine[];
  /** A quick meal: no library recipe to keep read lines on */
  isQuick?: boolean;
}

/** A planned meal that can go on the shopping list */
export interface PlanMeal {
  /** This planned meal's instanceId (the same recipe can be planned on several days) */
  key: string;
  name: string;
  date: string;
  /** The meal and its sides */
  parts: PlanMealPart[];
  isLeftover?: boolean;
}

const part = (meal: Recipe): PlanMealPart => ({
  id: meal.id,
  name: meal.name,
  ingredients: Array.isArray(meal.ingredients) ? withoutHeadings(meal.ingredients) : [],
  parsedIngredients: meal.parsedIngredients,
  isQuick: !!meal.quick || undefined,
});

/** Planned meals from today on, by date; the same family meal in several members' plans once. */
export const extractMealsFromPlan = (plans: Record<string, DayPlan>, today: string): PlanMeal[] => {
  const seen = new Set<string>();
  return Object.keys(plans).sort().filter(date => date >= today).flatMap(date => {
    const day = plans[date];
    return (day.meals || []).flatMap((meal, index) => {
      const key = meal.instanceId || `${day.date}/${meal.id}/${index}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{
        key,
        name: meal.name,
        date: day.date,
        parts: [part(meal), ...(meal.sides || []).map(part)],
        isLeftover: meal.isLeftover,
      }];
    });
  });
};

/** Whether a meal adds anything to the list: leftovers and meals with no ingredients don't */
export const hasThingsToBuy = (meal: PlanMeal) => !meal.isLeftover && meal.parts.some(p => p.ingredients.length > 0);
