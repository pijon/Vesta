import type { CalorieAvailability, DayPlan, Recipe } from '../types';

export const isNutritionNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const calorieAvailability = (recipe: Recipe): CalorieAvailability => {
  if (recipe.calorieStatus === 'unknown' || recipe.quick?.noCalories || recipe.isMissing || !isNutritionNumber(recipe.calories)) return 'unknown';
  if (recipe.calorieStatus === 'known' || recipe.calories > 0 || recipe.quick ||
      recipe.description === 'Eat Out / Custom Meal' || isNutritionNumber(recipe.planOverrides?.calories)) return 'known';
  return 'unconfirmed';
};

/** Read-time normalization preserves unmarked zero provenance. Never writes back. */
export const normalizeRecipeNutrition = (recipe: Recipe): Recipe => {
  const result = { ...recipe };
  if (!isNutritionNumber(result.calories)) { result.calories = 0; result.calorieStatus = 'unknown'; }
  if (result.isMissing || result.quick?.noCalories) result.calorieStatus = 'unknown';
  for (const key of ['protein', 'fat', 'carbs'] as const) if (!isNutritionNumber(result[key])) delete result[key];
  if (recipe.sides) result.sides = recipe.sides.map(normalizeRecipeNutrition);
  return result;
};

export interface NutritionSummary {
  knownCalories: number;
  unknownParts: number;
  unconfirmedParts: number;
  complete: boolean;
  estimated: boolean;
  budget: boolean;
}
const empty = (): NutritionSummary => ({knownCalories:0,unknownParts:0,unconfirmedParts:0,complete:true,estimated:false,budget:false});
const sum = (a: NutritionSummary, b: NutritionSummary): NutritionSummary => ({
  knownCalories:a.knownCalories+b.knownCalories, unknownParts:a.unknownParts+b.unknownParts,
  unconfirmedParts:a.unconfirmedParts+b.unconfirmedParts, complete:a.complete&&b.complete,
  estimated:a.estimated||b.estimated, budget:a.budget||b.budget,
});
export const mealNutrition = (recipe: Recipe): NutritionSummary => {
  const availability = calorieAvailability(recipe);
  return (recipe.sides || []).reduce((total,side) => sum(total,mealNutrition(side)), {
    knownCalories:availability==='known'?recipe.calories:0,
    unknownParts:availability==='unknown'?1:0, unconfirmedParts:availability==='unconfirmed'?1:0,
    complete:availability==='known', estimated:!!(recipe.caloriesEstimated||recipe.quick?.estimated), budget:!!recipe.quick?.budget,
  });
};
export const dayNutrition = (plan?: Pick<DayPlan,'meals'>): NutritionSummary =>
  (plan?.meals || []).reduce((total,meal) => sum(total,mealNutrition(meal)), empty());

export const nutritionLabel = (n: NutritionSummary): string => {
  if (!n.complete) {
    const unavailable = n.unknownParts+n.unconfirmedParts;
    if (!n.knownCalories) return n.unknownParts ? 'Calories unavailable' : 'Calories need confirmation';
    return `${n.knownCalories} kcal known · ${unavailable} ${unavailable===1?'part':'parts'} ${n.unknownParts?'unavailable':'need confirmation'}`;
  }
  return `${n.estimated?'≈ ':''}${n.knownCalories} kcal${n.budget?' budget':''}`;
};
