import { AggregatedIngredient, DayPlan, ParsedIngredient, PurchasableItem } from '../types';
import { formatAmount } from './scaleIngredient';

/** A planned meal on the shopping list's "Choose meals" step */
export interface PlanMeal {
  /** This planned meal (the same recipe can be planned on several days) */
  key: string;
  /** Its recipe */
  id: string;
  name: string;
  date: string;
  ingredients: string[];
  /** The recipe's servings: the portions bought unless the user picks others */
  servings?: number;

  isLeftover?: boolean;
  /** A quick meal: no library recipe to add ingredients to */
  isQuick?: boolean;
  isShared?: boolean;
  ownerName?: string;
}

/** Planned meals from today on, by date. */
export const extractMealsFromPlan = (plans: Record<string, DayPlan>, today: string): PlanMeal[] =>
  Object.keys(plans).sort().filter(date => date >= today).flatMap(date => {
    const day = plans[date];
    return (day.meals || []).map((meal, index) => ({
      key: meal.instanceId || `${day.date}/${meal.id}/${index}`,
      id: meal.id,
      name: meal.name,
      date: day.date,
      ingredients: Array.isArray(meal.ingredients) ? meal.ingredients : [],
      servings: meal.servings,

      isLeftover: meal.isLeftover,
      isQuick: !!meal.quick,
      isShared: meal.isShared,
      ownerName: meal.ownerName,
    }));
  });

/** Whether a meal adds anything to the list: leftovers and meals with no ingredients don't */
export const hasThingsToBuy = (meal: PlanMeal) => !meal.isLeftover && meal.ingredients.length > 0;

/** Adds up parsed ingredients by name; the same name in another unit stays its own row ("olive oil (ml)"). */
export const aggregateIngredients = (parsed: ParsedIngredient[]): AggregatedIngredient[] => {
  const map = new Map<string, AggregatedIngredient>();

  parsed.forEach(ing => {
    const first = map.get(ing.name);
    const name = !first || first.unit === ing.unit ? ing.name : `${ing.name} (${ing.unit})`;
    const existing = map.get(name);
    if (!existing) {
      map.set(name, {
        name,
        totalQuantity: ing.quantity,
        unit: ing.unit,
        recipes: [{ id: ing.recipeId, name: ing.recipeName, quantity: ing.quantity }],
        originalIngredients: [ing],
      });
      return;
    }
    existing.totalQuantity += ing.quantity;
    const recipeRef = existing.recipes.find(r => r.id === ing.recipeId);
    if (recipeRef) recipeRef.quantity += ing.quantity;
    else existing.recipes.push({ id: ing.recipeId, name: ing.recipeName, quantity: ing.quantity });
    existing.originalIngredients.push(ing);
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

/** The list's items: what the recipes need, as amounts to buy */
export const toShoppingItems = (
  ingredients: Array<{ name: string; quantity: number; unit: string }>,
): PurchasableItem[] =>
  ingredients.map(ing => {
    const amount = formatAmount(ing.quantity, ing.unit);
    return { ingredientName: ing.name, requiredQuantity: amount, purchasableQuantity: amount, purchasableSize: '' };
  });
