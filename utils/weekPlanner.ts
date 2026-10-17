import { DayPlan, MealSlot, Recipe } from '../types';
import { dayCalories, isQuickMeal, mealCalories, slotFor } from './planUtils';

/**
 * Fills the open breakfast, lunch and dinner slots of a few days with the family's recipes, on the
 * device and in no time. Meals already planned stay and count against the day's target; fast days
 * get fewer, lighter meals; recipes rotate (no repeats in a day, few in a week, proteins varied).
 * The same inputs and seed always give the same plan, so shuffling is a new seed.
 */

export interface WeekDay {
  date: string;
  /** What's planned already: these meals stay */
  plan: DayPlan;
  fast: boolean;
  /** The day's calorie target (dayTarget) */
  target: number;
  skip: boolean;
}

export interface WeekPlanOptions {
  /** Meals on a fast day: lunch and dinner, or all three */
  fastDayMeals: 2 | 3;
  /** Plan the previous night's dinner as lunch when lunch is open */
  leftovers: boolean;
  seed: number;
  /** Recipe ids a wish for the week favours or rules out (readWeekHint) */
  prefer?: ReadonlySet<string>;
  avoid?: ReadonlySet<string>;
  /** Library recipe id → days since it was last planned, over the past two weeks */
  recent?: ReadonlyMap<string, number>;
  /** Slots decided by hand, by slotKey: a recipe id, or null to leave the slot open */
  pins?: Readonly<Record<string, string | null>>;
  /** Recipe ids swapped away from a slot, by slotKey: picked again only once nothing else fits */
  rejected?: Readonly<Record<string, readonly string[]>>;
}

export type SlotResult =
  | { kind: 'proposed'; recipe: Recipe; leftover: boolean; calories: number; sides?: Recipe[] }
  /** Left open by hand, or no recipe for the slot */
  | { kind: 'open'; reason: 'removed' | 'none' }
  /** A fast day's slot that stays empty */
  | { kind: 'rest' };

export interface DayResult {
  date: string;
  /** Only the slots the planner looked at: slots with meals already planned have no entry */
  slots: Partial<Record<MealSlot, SlotResult>>;
  /** Planned meals plus the proposals */
  calories: number;
}

export const slotKey = (date: string, slot: MealSlot) => `${date}/${slot}`;

/** The library recipe a planned meal comes from */
export const libraryId = (meal: Pick<Recipe, 'id' | 'originalRecipeId'>) => meal.originalRecipeId || meal.id;

const PROTEINS: [string, RegExp][] = [
  ['fish', /fish|salmon|cod|tuna|haddock|trout|mackerel|prawn|shrimp|seafood|lax|torsk|fisk|räk|sej|makrill|sill/i],
  ['poultry', /chicken|turkey|kyckling|kalkon/i],
  ['beef', /beef|steak|mince|meatball|burger|nötfärs|köttfärs|biff|köttbull/i],
  ['pork', /pork|bacon|ham\b|sausage|chorizo|fläsk|korv|skinka/i],
  ['lamb', /lamb|lamm/i],
  ['egg', /\beggs?\b|omelet|frittata|shakshuka|ägg/i],
  ['plant', /tofu|tempeh|lentil|chickpea|bean|halloumi|falafel|linser|kikärt|bönor|vegetar|vegan/i],
];

/** The main protein of a recipe, guessed from its name and tags */
export const proteinOf = (recipe: Pick<Recipe, 'name' | 'tags'>): string | undefined => {
  const text = `${recipe.name} ${(recipe.tags || []).join(' ')}`;
  return PROTEINS.find(([, pattern]) => pattern.test(text))?.[0];
};

/** Side dishes go with a meal (the Planner's sides), not in a slot of their own */
const isSideDish = (recipe: Pick<Recipe, 'tags'>) => (recipe.tags || []).some(t => /^sides?( dish)?$/i.test(t.trim()));

/** A stable number in [0, 1) for a string (FNV-1a), so the same seed gives the same plan */
const noise = (text: string) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 2 ** 32;
};

/** How a day's remaining budget is shared between its open slots */
const SHARE: Record<MealSlot, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.4, snack: 0 };
/** Slots are filled biggest first, so the smaller meals fit what's left */
const FILL_ORDER: MealSlot[] = ['dinner', 'lunch', 'breakfast'];
const ALL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** Recipes a slot can take: its own, or for lunch or dinner without any, the other one's */
const candidatesFor = (recipes: Recipe[], slot: MealSlot) => {
  const own = recipes.filter(r => slotFor(r) === slot);
  if (own.length || slot === 'breakfast') return own;
  return recipes.filter(r => slotFor(r) === (slot === 'lunch' ? 'dinner' : 'lunch'));
};

interface Picked { id: string; protein?: string }

export const planWeek = (days: WeekDay[], recipes: Recipe[], options: WeekPlanOptions): DayResult[] => {
  const library = recipes.filter(r => !isQuickMeal(r) && !r.isMissing && !isSideDish(r));
  const byId = new Map(library.map(r => [r.id, r]));
  const pins = options.pins || {};

  // What each day holds so far: planned meals first, proposals as they're made
  const picked = new Map<string, Picked[]>();
  const dinners = new Map<string, { recipe: Recipe; sides?: Recipe[]; calories: number }>();
  for (const day of days) {
    picked.set(day.date, day.plan.meals.map(m => ({ id: libraryId(m), protein: proteinOf(m) })));
    const dinner = day.plan.meals.find(m => slotFor(m) === 'dinner' && !isQuickMeal(m) && !m.isLeftover);
    const recipe = dinner && byId.get(libraryId(dinner));
    if (dinner && recipe) dinners.set(day.date, { recipe, sides: dinner.sides, calories: mealCalories(dinner) });
  }
  const weekUses = (id: string) => [...picked.values()].reduce((n, list) => n + list.filter(p => p.id === id).length, 0);

  const score = (day: WeekDay, previous: string | undefined, slot: MealSlot, recipe: Recipe, aim: number, budget: number) => {
    const calories = recipe.calories || 0;
    let s = 0;
    // Closeness to the slot's share (a lighter meal is better than a heavier one); going over
    // what the day can spare for this slot costs most
    const off = (calories - aim) / Math.max(aim, 1);
    s += calories > 0 ? (off > 0 ? off : -off / 2) : 1;
    if (calories > budget) s += 1 + (calories - budget) / Math.max(day.target, 1);
    s += 1.2 * weekUses(recipe.id);
    if (previous && picked.get(previous)?.some(p => p.id === recipe.id)) s += 1.5;
    const ago = options.recent?.get(recipe.id);
    if (ago !== undefined) s += 0.6 * (1 - Math.min(ago, 14) / 15);
    const protein = proteinOf(recipe);
    if (protein && picked.get(day.date)?.some(p => p.protein === protein)) s += 0.5;
    if (protein && slot === 'dinner' && previous && proteinOf(dinners.get(previous)?.recipe ?? { name: '', tags: [] }) === protein) s += 0.5;
    if (recipe.isFavorite) s -= 0.25;
    if (options.prefer?.has(recipe.id)) s -= 0.8;
    return s + 0.5 * noise(`${options.seed}|${day.date}|${slot}|${recipe.id}`);
  };

  const results: DayResult[] = [];
  let previous: string | undefined;
  for (const day of days) {
    const yesterday = previous;
    previous = day.date;
    const slots: DayResult['slots'] = {};
    if (day.skip) {
      results.push({ date: day.date, slots, calories: dayCalories(day.plan) });
      continue;
    }

    const taken = new Set(day.plan.meals.map(slotFor));
    let open = ALL_SLOTS.filter(s => !taken.has(s));
    if (day.fast) {
      // A fast day has fastDayMeals meals in all, dinner and lunch first
      const room = Math.max(0, options.fastDayMeals - day.plan.meals.filter(m => slotFor(m) !== 'snack').length);
      const wanted = FILL_ORDER.filter(s => open.includes(s) && (options.fastDayMeals === 3 || s !== 'breakfast')).slice(0, room);
      open.filter(s => !wanted.includes(s)).forEach(s => { slots[s] = { kind: 'rest' }; });
      open = wanted;
    }

    let budget = day.target - dayCalories(day.plan);
    const place = (slot: MealSlot, recipe: Recipe, leftover: boolean, calories: number, sides?: Recipe[]) => {
      slots[slot] = { kind: 'proposed', recipe, leftover, calories, ...(sides?.length ? { sides } : {}) };
      budget -= calories;
      picked.get(day.date)!.push({ id: recipe.id, protein: proteinOf(recipe) });
      if (slot === 'dinner' && !leftover) dinners.set(day.date, { recipe, calories });
    };

    // First what's decided: slots picked or cleared by hand, and leftovers
    const toFill: MealSlot[] = [];
    for (const slot of FILL_ORDER.filter(s => open.includes(s))) {
      const pin = pins[slotKey(day.date, slot)];
      const source = yesterday ? dinners.get(yesterday) : undefined;
      if (pin === null) slots[slot] = { kind: 'open', reason: 'removed' };
      else if (pin && byId.has(pin)) {
        const asLeftover = slot === 'lunch' && options.leftovers && source?.recipe.id === pin;
        place(slot, byId.get(pin)!, asLeftover, asLeftover ? source!.calories : byId.get(pin)!.calories || 0, asLeftover ? source!.sides : undefined);
      } else if (
        slot === 'lunch' && options.leftovers && source && !options.avoid?.has(source.recipe.id)
        // On a fast day only a leftover that leaves room for dinner
        && !(day.fast && source.calories > budget * 0.6)
      ) place(slot, source.recipe, true, source.calories, source.sides);
      else toFill.push(slot);
    }

    // Then the rest, each aiming for its share of what's left, and keeping room for the lightest
    // recipe of each slot still to fill
    const lightest = (slot: MealSlot) => Math.min(Infinity, ...candidatesFor(library, slot).map(r => r.calories || 0).filter(c => c > 0));
    toFill.forEach((slot, i) => {
      const shares = toFill.slice(i).reduce((sum, s) => sum + SHARE[s], 0);
      const aim = Math.max(0, budget) * (SHARE[slot] / shares);
      const reserve = toFill.slice(i + 1).reduce((sum, s) => sum + (Number.isFinite(lightest(s)) ? lightest(s) : 0), 0);
      const today = picked.get(day.date)!;
      const rejected = new Set(options.rejected?.[slotKey(day.date, slot)] || []);
      const usable = candidatesFor(library, slot).filter(r => !options.avoid?.has(r.id) && !today.some(p => p.id === r.id));
      const fresh = usable.filter(r => !rejected.has(r.id));
      const ranked = (fresh.length ? fresh : usable)
        .map(recipe => ({ recipe, s: score(day, yesterday, slot, recipe, aim, Math.max(0, budget - reserve)) }))
        .sort((a, b) => a.s - b.s);
      if (ranked.length) place(slot, ranked[0].recipe, false, ranked[0].recipe.calories || 0);
      else slots[slot] = { kind: 'open', reason: 'none' };
    });

    const proposed = Object.values(slots).reduce((sum, r) => sum + (r?.kind === 'proposed' ? r.calories : 0), 0);
    results.push({ date: day.date, slots, calories: dayCalories(day.plan) + proposed });
  }
  return results;
};

/** Every proposal in a plan, as pins: freezes the plan so changing one slot leaves the others be */
export const pinsOf = (results: DayResult[]): Record<string, string> =>
  Object.fromEntries(results.flatMap(day => Object.entries(day.slots).flatMap(([slot, r]) =>
    r?.kind === 'proposed' ? [[slotKey(day.date, slot as MealSlot), r.recipe.id]] : [])));

export interface Proposal { date: string; slot: MealSlot; recipe: Recipe; leftover: boolean; sides?: Recipe[] }

export const proposalsOf = (results: DayResult[]): Proposal[] =>
  results.flatMap(day => Object.entries(day.slots).flatMap(([slot, r]) =>
    r?.kind === 'proposed' ? [{ date: day.date, slot: slot as MealSlot, recipe: r.recipe, leftover: r.leftover, sides: r.sides }] : []));
