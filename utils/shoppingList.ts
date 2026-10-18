import { ShoppingList, ShoppingListItem, ShoppingListMeal, ShoppingListSource } from '../types';
import { ingredientKey } from './ingredientParse';
import { formatAmount } from './scaleIngredient';

/** Units that convert into each other: grams for mass, millilitres for volume */
const UNITS: Record<string, { dimension: 'mass' | 'volume'; base: number }> = {
  g: { dimension: 'mass', base: 1 }, hg: { dimension: 'mass', base: 100 }, kg: { dimension: 'mass', base: 1000 },
  oz: { dimension: 'mass', base: 28.35 }, lb: { dimension: 'mass', base: 453.6 },
  ml: { dimension: 'volume', base: 1 }, cl: { dimension: 'volume', base: 10 }, dl: { dimension: 'volume', base: 100 },
  l: { dimension: 'volume', base: 1000 }, krm: { dimension: 'volume', base: 1 }, tsk: { dimension: 'volume', base: 5 },
  msk: { dimension: 'volume', base: 15 }, tsp: { dimension: 'volume', base: 5 }, tbsp: { dimension: 'volume', base: 15 },
  cup: { dimension: 'volume', base: 240 },
};
const SPOONS = new Set(['krm', 'tsk', 'msk', 'tsp', 'tbsp']);
const SWEDISH_SPOONS = new Set(['krm', 'tsk', 'msk']);

/** Items with the same key add up: the same food ("egg" and "eggs") in units that convert */
export const itemKey = (name: string, unit: string): string => `${ingredientKey(name)}|${UNITS[unit]?.dimension ?? unit}`;

type Amount = { quantity: number; unit: string };

/** Two amounts of one item as one, in the base unit when their units differ */
const addAmounts = (a: Amount, b: Amount): Amount => {
  if (a.unit === b.unit) return { quantity: a.quantity + b.quantity, unit: a.unit };
  const ua = UNITS[a.unit], ub = UNITS[b.unit];
  if (!ua || !ub || ua.dimension !== ub.dimension) return a;
  return { quantity: a.quantity * ua.base + b.quantity * ub.base, unit: ua.dimension === 'mass' ? 'g' : 'ml' };
};

/** A total in a unit worth reading: 1200 g as 1.2 kg, 2 tsp + 1 tbsp as 1⅔ tbsp, 350 ml as 3.5 dl */
const readable = ({ quantity, unit }: Amount, units: string[]): Amount => {
  const info = UNITS[unit];
  // Grams and millilitres read better in bigger units; other units stay as the recipes wrote them
  if (!info || (units.every(u => u === unit) && unit !== 'g' && unit !== 'ml')) return { quantity, unit };
  const base = quantity * info.base;
  if (info.dimension === 'mass') return base >= 1000 ? { quantity: base / 1000, unit: 'kg' } : { quantity: base, unit: 'g' };
  if (units.every(u => SPOONS.has(u))) {
    const swedish = units.some(u => SWEDISH_SPOONS.has(u));
    return base >= 15 ? { quantity: base / 15, unit: swedish ? 'msk' : 'tbsp' } : { quantity: base / 5, unit: swedish ? 'tsk' : 'tsp' };
  }
  return base >= 1000 ? { quantity: base / 1000, unit: 'l' } : base >= 100 ? { quantity: base / 100, unit: 'dl' } : { quantity: base, unit: 'ml' };
};

/** Units counted out, by their plural ("5 klyftor", "4 rashers") */
const PLURALS: Record<string, string> = {
  klyfta: 'klyftor', skiva: 'skivor', burk: 'burkar', påse: 'påsar', kruka: 'krukor', flaska: 'flaskor', nypa: 'nypor',
  clove: 'cloves', slice: 'slices', can: 'cans', rasher: 'rashers', bunch: 'bunches', handful: 'handfuls', pinch: 'pinches',
  sprig: 'sprigs', bulb: 'bulbs', jar: 'jars', bottle: 'bottles', pack: 'packs', cup: 'cups',
};
const unitFor = (quantity: number, unit: string) => (quantity > 1 && PLURALS[unit]) || unit;

/** What the meals need of an item, in all ("1.2 kg"); empty without meals */
export const mealsTotal = (sources: ShoppingListSource[]): string => {
  if (sources.length === 0) return '';
  const total = sources.slice(1).reduce<Amount>((sum, s) => addAmounts(sum, s), sources[0]);
  const shown = readable(total, sources.map(s => s.unit));
  return formatAmount(shown.quantity, unitFor(shown.quantity, shown.unit));
};

/** The amount to show for an item: the one typed in, or what its meals need */
export const itemAmount = (item: ShoppingListItem): string => item.amount ?? mealsTotal(Object.values(item.sources || {}));

/** The names of the meals an item is for */
export const itemMeals = (item: ShoppingListItem): string[] =>
  [...new Set(Object.values(item.sources || {}).sort((a, b) => a.date.localeCompare(b.date)).map(s => s.meal))];

/** A planned meal to add to the list, with its ingredient lines read */
export interface MealToAdd {
  instanceId: string;
  date: string;
  name: string;
  lines: Array<Amount & { name: string }>;
}

export interface ListAdditions {
  /** New items */
  create: ShoppingListItem[];
  /** Meals' needs to add to items already on the list, by item id */
  add: Map<string, Record<string, ShoppingListSource>>;
}

/**
 * What adding meals changes on the list. Each line joins an unticked item with the same key
 * (one whose amount wasn't typed in, which would hide it), or starts a new one.
 */
export const planAdditions = (
  items: ShoppingListItem[],
  meals: MealToAdd[],
  by: string,
  now: number,
  newId: () => string,
): ListAdditions => {
  const open = new Map<string, ShoppingListItem>();
  items.forEach(item => { if (!item.checked && item.amount === undefined && !open.has(item.key)) open.set(item.key, item); });
  const created = new Map<string, ShoppingListItem>();
  const add = new Map<string, Record<string, ShoppingListSource>>();

  meals.forEach(meal => meal.lines.forEach(line => {
    const key = itemKey(line.name, line.unit);
    const need: ShoppingListSource = { date: meal.date, meal: meal.name, quantity: line.quantity, unit: line.unit };
    const join = (sources: Record<string, ShoppingListSource>) => {
      const before = sources[meal.instanceId];
      sources[meal.instanceId] = before ? { ...before, ...addAmounts(before, need) } : need;
    };
    const fresh = created.get(key);
    const existing = open.get(key);
    if (fresh) join(fresh.sources);
    else if (existing) {
      if (!add.has(existing.id)) add.set(existing.id, {});
      join(add.get(existing.id)!);
    } else {
      const item: ShoppingListItem = { id: newId(), key, name: line.name, sources: {}, addedBy: by, addedAt: now };
      join(item.sources);
      created.set(key, item);
    }
  }));

  return { create: [...created.values()], add };
};

/** Taking a meal off the list: items only it needed go, the others lose its share */
export const planMealRemoval = (items: ShoppingListItem[], instanceId: string) => {
  const touched = items.filter(item => item.sources?.[instanceId]);
  const gone = (item: ShoppingListItem) => Object.keys(item.sources).length === 1 && item.amount === undefined;
  return {
    remove: touched.filter(gone).map(item => item.id),
    trim: touched.filter(item => !gone(item)).map(item => item.id),
  };
};

/** The list as text to paste ("1.2 kg potatis"), unticked items only */
export const listText = (items: ShoppingListItem[]): string =>
  items.filter(item => !item.checked).map(item => [itemAmount(item), item.name].filter(Boolean).join(' ')).join('\n');

/** The planned meals on the list: recorded there, or with a share in an item (the record can be behind) */
export const mealsOnList = (list: ShoppingList): Map<string, ShoppingListMeal> => {
  const meals = new Map(Object.entries(list.meals || {}));
  list.items.forEach(item => Object.entries(item.sources || {}).forEach(([id, source]) => {
    if (!meals.has(id)) meals.set(id, { date: source.date, name: source.meal });
  }));
  return meals;
};
