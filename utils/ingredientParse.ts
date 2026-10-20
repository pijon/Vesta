import { ParsedIngredientLine } from '../types';
import { NUMBER, parseAmount } from './scaleIngredient';

/**
 * Reads plain ingredient lines ("400 g broccoli", "1 ½ dl grädde", "2 eggs, beaten") in code, so
 * the shopping list only asks the AI about the rest. Returns null when unsure: two foods in one
 * line ("rice and beans"), a name too long to be just a food, or a size that isn't a count ("2 x 400 g tomatoes").
 * Foods with no amount ("olive oil", "salt") come back with quantity 0, which the list shows as no amount.
 */

/** Unit spellings, Swedish and English, to the unit shown */
const UNITS: Record<string, string> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', kg: 'kg', kilo: 'kg',
  ml: 'ml', cl: 'cl', dl: 'dl', l: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l',
  tsk: 'tsk', msk: 'msk', krm: 'krm', tesked: 'tsk', matsked: 'msk', kryddmått: 'krm',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', tbsp: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup', oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  st: 'item', pc: 'item', pcs: 'item',
  klyfta: 'klyfta', klyftor: 'klyfta', clove: 'clove', cloves: 'clove',
  burk: 'burk', burkar: 'burk', can: 'can', cans: 'can', tin: 'can', tins: 'can',
  paket: 'paket', pkt: 'paket', pack: 'pack', packs: 'pack', package: 'pack', packages: 'pack', packet: 'pack', packets: 'pack',
  knippe: 'knippe', knippen: 'knippe', bunch: 'bunch', bunches: 'bunch',
  nypa: 'nypa', pinch: 'pinch', pinches: 'pinch',
  skiva: 'skiva', skivor: 'skiva', slice: 'slice', slices: 'slice',
  handful: 'handful', handfuls: 'handful', näve: 'näve', nävar: 'näve', kvist: 'kvist', kvistar: 'kvist',
  kruka: 'kruka', krukor: 'kruka', påse: 'påse', påsar: 'påse', förp: 'förp', förpackning: 'förp',
  bulb: 'bulb', bulbs: 'bulb', rasher: 'rasher', rashers: 'rasher', sprig: 'sprig', sprigs: 'sprig',
  jar: 'jar', jars: 'jar', bottle: 'bottle', bottles: 'bottle', flaska: 'flaska', flaskor: 'flaska',
};

/** Size, freshness and preparation words, which don't change what to buy */
const MODIFIERS = new Set([
  'fresh', 'freshly', 'young', 'trimmed', 'heaped', 'rounded', 'level', 'large', 'small', 'medium', 'big', 'organic', 'ripe', 'chopped', 'finely', 'roughly', 'diced',
  'minced', 'sliced', 'grated', 'crushed', 'peeled', 'beaten', 'halved', 'shredded', 'cubed', 'thinly',
  'thin', 'thick', 'tunna', 'tunn', 'tjocka', 'boneless', 'skinless', 'toasted', 'drained', 'rinsed', 'defrosted', 'grillad', 'rostad', 'rostade',
  'tinade', 'tinad', 'avrunna', 'avrunnen', 'sköljda', 'urkärnade', 'skurna', 'putsad', 'lätt', 'ibitar',
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
// "400g" or "15ml" stuck to a word says the pack size, not what it is
const SIZE = /^\d+(?:[.,]\d+)?(?:g|kg|ml|cl|dl|l)$/;
// Containers a "2 x 400 g" counts
const CONTAINERS = new Set(['can', 'cans', 'tin', 'tins', 'packet', 'packets', 'pack', 'burk', 'burkar', 'paket', 'jar', 'jars', 'förp']);
// "juice of ½ lemon", "finrivet skal från 1 citron": what's bought is the fruit
const FRUIT_PARTS = new Set(['juice', 'zest', 'saften', 'saft', 'skal', 'finrivet', 'finrivna', 'rivet', 'grated', 'finely', 'squeezed', 'färskpressad', 'och', 'and', 'of', 'from', 'från', 'av']);
const PARTS_OF_FRUIT = /^(?:juice|zest|saften|saft|skal)$/;
// "a splash of", "en liten näve": how much, for lines with no amount
const HOW_MUCH = /^(?:(?:några|a few|a|an|en|ett|few|some)\s+)?(?:(?:liten|lite|small|large|big|stor|good|generous)\s+)?(?:splash|squeeze|dash|drop|drops|bit|bunch|handful|pinch|näve|nypa|knippe|kvistar|kvist|sprigs|sprig|skvätt|stänk|droppar)\s+(?:of\s+|av\s+)?/i;
const NOT_A_FOOD = new Set(['cut', 'to', 'for', 'into', 'with', 'plus', 'serve', 'optional']);

const SALT = new Set(['salt', 'flingsalt', 'havssalt', 'himalayasalt']);
const PEPPER = new Set(['peppar', 'pepper', 'svartpeppar', 'vitpeppar']);
// Words around them that say how much or how fine, not what
const SEASONING_FILLER = new Set([
  'och', 'and', 'eller', 'or', 'to', 'taste', 'efter', 'smak', 'a', 'an', 'of', 'av', 'some', 'lite', 'ground', 'freshly', 'fresh', 'nymalen', 'malen', 'malet', 'krossad',
  'sea', 'kosher', 'maldon', 'pink', 'himalaya', 'black', 'white', 'svart', 'vit', 'tesked', 'matsked', 'kryddmått', 'teaspoon', 'tablespoon',
]);

/**
 * Salt and pepper are bought once and rarely run out, so they go on the list without an amount
 * (quantity 0), however the recipe measures them. "salt och nymalen svartpeppar" is one line.
 */
const readSeasoning = (text: string): ParsedIngredientLine | null => {
  const words = text.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[\s,.;]+/).filter(Boolean)
    .filter(word => !/^[\d½⅓⅔¼¾⅛/–-]+$/.test(word) && !UNITS[word] && !SEASONING_FILLER.has(word));
  const salt = words.some(word => SALT.has(word));
  const pepper = words.some(word => PEPPER.has(word));
  if ((!salt && !pepper) || !words.every(word => SALT.has(word) || PEPPER.has(word))) return null;
  return { text, name: salt && pepper ? 'salt and pepper' : salt ? 'salt' : 'pepper', quantity: 0, unit: 'item' };
};

/** The food in the rest of a line, or null when unsure. Of "A or B" the first is kept ("olive or rapeseed oil" is olive oil). */
const nameOf = (rest: string): string | null => {
  const cleaned = rest
    .replace(/\([^)]*\)/g, ' ')
    // "2 kycklingfiléer à cirka 150 g" buys 2 fillets
    .split(/,|\s+à\s+|\s+[–-]\s+/)[0]
    .replace(/\s+(?:till|to)\s+(?:servering|serve|såsen)\b.*$/i, '')
    .replace(/\s+(?:skuren|skuret|skurna|cut)\b.*$/i, '')
    .replace(/\bextra virgin\b/i, ' ')
    .toLowerCase()
    .replace(/^\s*(?:of|av)\s+/, '')
    .trim();
  const [first, second] = cleaned.split(/\s+(?:or|eller)\s+/);
  const firstWords = first.split(/\s+/);
  const secondWords = second?.split(/\s+/) ?? [];
  let chosen = firstWords;
  // "oliv- eller rapsolja" is rapsolja; "olive or rapeseed oil" is olive oil
  if (second && first.endsWith('-')) chosen = secondWords;
  else if (second && !/\d/.test(second) && firstWords.length === 1 && secondWords.length > 1) chosen = [first, ...secondWords.slice(1)];

  const words = chosen.filter((word, i) =>
    word && !MODIFIERS.has(word) && !SIZE.test(word) && !((word === 'och' || word === 'and') && MODIFIERS.has(chosen[i + 1] ?? '')));
  const name = words.join(' ');
  if (!name || /\d/.test(name) || TWO_FOODS.test(name) || words.length > MAX_NAME_WORDS) return null;
  return name;
};

export const parseIngredientLine = (text: string): ParsedIngredientLine | null => {
  const seasoning = readSeasoning(text);
  if (seasoning) return seasoning;
  let line = text.replace(ABOUT, '').trim();

  // "juice of ½ lemon" buys half a lemon
  const tokens = line.split(/\s+/);
  let parts = 0;
  while (parts < tokens.length && FRUIT_PARTS.has(tokens[parts].toLowerCase())) parts++;
  if (parts > 0 && parts < tokens.length && tokens.slice(0, parts).some(token => PARTS_OF_FRUIT.test(token.toLowerCase()))) line = tokens.slice(parts).join(' ');

  // "2 x 400 g can tomatoes" is 2 cans
  const packs = line.match(new RegExp(String.raw`^(${NUMBER})\s*[x×]\s*\d+(?:[.,]\d+)?\s*(?:g|kg|ml|cl|dl|l|oz)\b\s*(.*)$`, 'i'));
  if (packs && CONTAINERS.has(packs[2].split(/\s+/)[0].toLowerCase())) line = `${packs[1]} ${packs[2]}`;

  const amount = line.match(AMOUNT);
  if (!amount) return readWithoutLeadingAmount(text, line);
  // A range buys for the larger amount
  const quantity = parseAmount(amount[2] ?? amount[1]);
  if (!(quantity >= 0)) return null;

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

  const name = nameOf(rest);
  // "0 tsk olivolja": listed without an amount
  return name ? { text, name, quantity, unit: quantity === 0 ? 'item' : unit } : null;
};

/** "Kanel 1/2 tesked", "Vitlök 3 skivade", or just "Olivolja" (listed without an amount) */
const readWithoutLeadingAmount = (text: string, line: string): ParsedIngredientLine | null => {
  const after = line.match(new RegExp(String.raw`^([^\d½⅓⅔¼¾⅛]+?)\s+(${NUMBER})(?:\s*[-–]\s*(${NUMBER}))?\s*(.*)$`));
  if (after) {
    const tail = after[4].toLowerCase().split(/\s+/).filter(Boolean);
    const unit = tail.length > 0 ? UNITS[tail[0]] : undefined;
    if (unit) tail.shift();
    const quantity = parseAmount(after[3] ?? after[2]);
    const name = nameOf(after[1]);
    if (name && quantity > 0 && tail.every(word => MODIFIERS.has(word))) return { text, name, quantity, unit: unit ?? 'item' };
  }
  if (/\d/.test(line.replace(/\([^)]*\)/g, ' ').split(',')[0])) return null;
  const name = nameOf(line.replace(HOW_MUCH, ''));
  return name && name.split(' ').length <= 3 && !NOT_A_FOOD.has(name.split(' ')[0]) ? { text, name, quantity: 0, unit: 'item' } : null;
};

/** Always at hand, so never on the shopping list ("1 l vatten", "water") */
export const isWater = (name: string): boolean => ['water', 'vatten'].includes(name.trim().toLowerCase());

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
