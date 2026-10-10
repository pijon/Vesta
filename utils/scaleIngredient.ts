/**
 * Scales the amount at the start of an ingredient line ("500 g chicken", "1 1/2 dl milk",
 * "½ tsp salt", "2-3 cloves garlic", "1,5 dl grädde"). Lines without a leading amount are
 * returned unchanged.
 */
const UNICODE_FRACTIONS: Record<string, number> = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅛': 1 / 8 };
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[½⅓⅔¼¾⅛])?|[½⅓⅔¼¾⅛])`;
const AMOUNT = new RegExp(String.raw`^(\s*)(${NUMBER})(?:\s*[-–]\s*(${NUMBER}))?`);
const METRIC = /^\s*(g|kg|mg|ml|cl|dl|l|gram|grams|gr)\b/i;

const parse = (text: string): number => {
  const t = text.trim();
  const glyph = t.match(/[½⅓⅔¼¾⅛]$/);
  const base = glyph ? t.slice(0, -1).trim() : t;
  const extra = glyph ? UNICODE_FRACTIONS[glyph[0]] : 0;
  if (!base) return extra;
  const mixed = base.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) + extra;
  const fraction = base.match(/^(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]) + extra;
  return Number(base.replace(',', '.')) + extra;
};

const FRACTION_GLYPHS: [number, string][] = [[1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']];

const format = (value: number, metric: boolean, comma: boolean) => {
  if (metric || value >= 10) {
    const rounded = value >= 100 ? Math.round(value / 5) * 5 : value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return comma ? String(rounded).replace('.', ',') : String(rounded);
  }
  const whole = Math.floor(value);
  const rest = value - whole;
  const glyph = FRACTION_GLYPHS.find(([f]) => Math.abs(rest - f) < 0.06);
  if (rest < 0.06) return String(whole || (value > 0 ? '¼' : '0'));
  if (rest > 0.94) return String(whole + 1);
  if (glyph) return whole ? `${whole}${glyph[1]}` : glyph[1];
  const decimal = String(Math.round(value * 10) / 10);
  return comma ? decimal.replace('.', ',') : decimal;
};

export const scaleIngredient = (line: string, factor: number): string => {
  if (factor === 1) return line;
  const match = line.match(AMOUNT);
  if (!match) return line;
  const [whole, lead, from, to] = match;
  const rest = line.slice(whole.length);
  const metric = METRIC.test(rest);
  const comma = /,\d/.test(whole);
  const scaled = format(parse(from) * factor, metric, comma);
  const scaledTo = to ? `–${format(parse(to) * factor, metric, comma)}` : '';
  return `${lead}${scaled}${scaledTo}${rest}`;
};
