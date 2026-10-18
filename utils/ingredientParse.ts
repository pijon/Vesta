import { ParsedIngredientLine } from '../types';
import { NUMBER, parseAmount } from './scaleIngredient';

/**
 * Reads plain ingredient lines ("400 g broccoli", "1 ½ dl grädde", "2 eggs, beaten") in code, so
 * the shopping list only asks the AI about the rest. Returns null when unsure: no leading amount,
 * two foods in one line ("salt and pepper"), or a name too long to be just a food.
 */

/** Unit spellings, Swedish and English, to the unit shown */
const UNITS: Record<string, string> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', kg: 'kg', kilo: 'kg',
  ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  tsk: 'tsk', msk: 'msk', krm: 'krm',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup', oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  st: 'item', pc: 'item', pcs: 'item',
  klyfta: 'klyfta', klyftor: 'klyfta', clove: 'clove', cloves: 'clove',
  burk: 'burk', burkar: 'burk', can: 'can', cans: 'can', tin: 'can', tins: 'can',
  paket: 'paket', pkt: 'paket', pack: 'pack', packs: 'pack', package: 'pack', packages: 'pack', packet: 'pack', packets: 'pack',
  knippe: 'knippe', knippen: 'knippe', bunch: 'bunch', bunches: 'bunch',
  nypa: 'nypa', pinch: 'pinch', pinches: 'pinch',
  skiva: 'skiva', skivor: 'skiva', slice: 'slice', slices: 'slice',
  handful: 'handful', handfuls: 'handful',
  kruka: 'kruka', krukor: 'kruka', påse: 'påse', påsar: 'påse', förp: 'förp', förpackning: 'förp',
  bulb: 'bulb', bulbs: 'bulb', rasher: 'rasher', rashers: 'rasher', sprig: 'sprig', sprigs: 'sprig',
  jar: 'jar', jars: 'jar', bottle: 'bottle', bottles: 'bottle', flaska: 'flaska', flaskor: 'flaska',
};

/** Size, freshness and preparation words, which don't change what to buy */
const MODIFIERS = new Set([
  'fresh', 'freshly', 'young', 'trimmed', 'heaped', 'rounded', 'level', 'large', 'small', 'medium', 'big', 'organic', 'ripe', 'chopped', 'finely', 'roughly', 'diced',
  'minced', 'sliced', 'grated', 'crushed', 'peeled', 'beaten', 'halved', 'shredded', 'cubed', 'thinly',
  'färsk', 'färska', 'färskt', 'stor', 'stora', 'stort', 'liten', 'litet', 'små', 'mogen', 'mogna',
  'hackad', 'hackade', 'hackat', 'finhackad', 'finhackade', 'grovhackad', 'grovhackade', 'riven', 'rivna',
  'rivet', 'finriven', 'finrivet', 'nymalen', 'rågad', 'rågade', 'struken', 'strukna', 'skivad', 'skivade', 'tärnad', 'tärnade', 'pressad', 'pressade', 'strimlad', 'strimlade', 'skalad', 'skalade',
]);

// "ca 500 g", "about 2 eggs"
const ABOUT = /^\s*(?:ca\.?|cirka|about|approx\.?|approximately)\s+/i;
const AMOUNT = new RegExp(String.raw`^\s*(${NUMBER})(?:\s*[-–]\s*(${NUMBER}))?\s*`);
// \b is ASCII-only in JS ("l" in "lök" would match), so a unit must end at a space, dot or the end
const UNIT = /^([a-zåäö]+)\.?(?=\s|$)\s*/i;
const TWO_FOODS = /\b(?:or|and|eller|och)\b|[&+/]/i;
const MAX_NAME_WORDS = 4;

export const parseIngredientLine = (text: string): ParsedIngredientLine | null => {
  const line = text.replace(ABOUT, '');
  const amount = line.match(AMOUNT);
  if (!amount) return null;
  // A range buys for the larger amount
  const quantity = parseAmount(amount[2] ?? amount[1]);
  if (!(quantity > 0)) return null;

  // A size before the unit ("1 rågad msk", "1 large handful") doesn't change it
  let rest = line.slice(amount[0].length)
    .replace(/^(?:(\S+)\s+)(?=\S)/, (whole, word: string) => MODIFIERS.has(word.toLowerCase()) ? '' : whole);
  let unit = 'item';
  const unitMatch = rest.match(UNIT);
  const knownUnit = unitMatch && UNITS[unitMatch[1].toLowerCase()];
  if (knownUnit) {
    unit = knownUnit;
    rest = rest.slice(unitMatch[0].length);
  }

  const words = rest
    .replace(/\([^)]*\)/g, ' ')
    // "2 kycklingfiléer à cirka 150 g" buys 2 fillets
    .split(/,|\s+à\s+/)[0]
    .replace(/\bextra virgin\b/i, ' ')
    .toLowerCase()
    .replace(/^\s*(?:of|av)\s+/, '')
    .split(/\s+/)
    .filter(word => word && !MODIFIERS.has(word));
  const name = words.join(' ');
  if (!name || /\d/.test(name) || TWO_FOODS.test(name) || words.length > MAX_NAME_WORDS) return null;

  return { text, name, quantity, unit };
};

/** One name for singular and plural ("egg" / "eggs", "tomato" / "tomatoes"), for adding up */
export const ingredientKey = (name: string): string => {
  const words = name.trim().toLowerCase().split(/\s+/);
  const last = words.pop() ?? '';
  const singular = last.endsWith('ies') ? `${last.slice(0, -3)}y`
    : last.endsWith('oes') ? last.slice(0, -2)
    : last.endsWith('s') && !last.endsWith('ss') && last.length > 3 ? last.slice(0, -1)
    : last;
  return [...words, singular].join(' ');
};

/** A recipe's read lines for its current ingredients: earlier readings kept, new lines read in code where possible */
export const readRecipeLines = (ingredients: string[], known: ParsedIngredientLine[] = []): ParsedIngredientLine[] => {
  const byText = new Map(known.map(line => [line.text, line]));
  return [...new Set(ingredients)].flatMap(text => {
    const line = byText.get(text) ?? parseIngredientLine(text);
    return line ? [line] : [];
  });
};
