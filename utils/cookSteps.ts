/** Helpers for cook mode: the timers and ingredients a recipe step mentions. */

const UNITS = 'hours?|hrs?|timmar|timme|tim|minutes?|mins?|minuter|minut|min|seconds?|secs?|sekunder|sek';
const DURATION = new RegExp(`(\\d+(?:[.,]\\d+)?)(?:\\s*(?:-|–|to|till)\\s*(\\d+(?:[.,]\\d+)?))?\\s*(${UNITS})\\b`, 'gi');
/**
 * A bare number offered as an alternative to the time just before it ("15 minutes for soft or 20
 * for hard"), as long as nothing marks it as a weight, size or temperature.
 */
const ALTERNATIVE = /^[^.;!?]{0,40}?\b(?:or|eller)\s+(\d+(?:[.,]\d+)?)(?!\s*(?:[-–.,]?\d|°|%|(?:g|kg|mg|ml|cl|dl|l|cm|mm|in|inch(?:es)?|grader|degrees|st|pcs|x)\b))/i;

const secondsFor = (value: number, unit: string) => {
    const u = unit.toLowerCase();
    const factor = /^(h|tim)/.test(u) ? 3600 : /^(sec|sek)/.test(u) ? 1 : 60;
    return Math.round(value * factor);
};

/** Times mentioned in a step ("bake for 25–30 minutes" → 30 min). Ranges use the upper bound. */
export const timersIn = (text: string) => {
    const found: { label: string; seconds: number }[] = [];
    const add = (label: string, seconds: number) => {
        if (seconds > 0 && seconds <= 24 * 3600 && !found.some(f => f.seconds === seconds)) found.push({ label, seconds });
    };
    for (const m of text.matchAll(DURATION)) {
        const unit = m[3];
        add(m[0].trim(), secondsFor(parseFloat((m[2] ?? m[1]).replace(',', '.')), unit));
        const alt = text.slice((m.index ?? 0) + m[0].length).match(ALTERNATIVE);
        if (alt) add(`${alt[1]} ${unit}`, secondsFor(parseFloat(alt[1].replace(',', '.')), unit));
    }
    return found.sort((a, b) => a.seconds - b.seconds);
};

// Words in an ingredient line that say how much or how it's prepared, not what it is
const NOT_FOOD = new Set(`
    cup cups tbsp tsp tablespoon tablespoons teaspoon teaspoons gram grams kilo kilos litre litres liter liters
    ounce ounces pound pounds lbs rasher rashers clove cloves pinch handful handfuls can cans tin tins pack packs
    packet packets slice slices piece pieces bunch bunches sprig sprigs dash stick sticks jar jars bag bags
    fresh freshly ground chopped finely roughly grated sliced diced minced crushed peeled large small medium
    optional about some plus extra more good quality taste serve serving the and for with from into
    msk tsk krm burk burkar paket nypa färsk färska hackad hackade riven rivna skivad skivade stor stora liten små
    och med till eller cirka
`.split(/\s+/).filter(Boolean));

const words = (text: string): string[] => text.toLowerCase().match(/\p{L}+/gu) ?? [];
// Plural and definite endings a short stem may take (pea → peas, ägg → äggen)
const SHORT_ENDING = /^(?:s|es|en|et|na|arna|orna|erna)?$/;
const stem = (word: string) => (word.length > 4 && word.endsWith('es') ? word.slice(0, -2) : word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

/** The words that name the food in an ingredient line ("10g Parmesan, grated" → parmesan). */
const foodWords = (line: string) =>
    words(line.replace(/\([^)]*\)/g, '').split(',')[0])
        .filter(w => w.length >= 3 && !NOT_FOOD.has(w))
        .map(stem);

/**
 * Indexes of the ingredients a step mentions. A short stem has to match a whole word, give or take
 * a plural or definite ending (pea, not peach); a longer one may start a longer word (bacon → bacons).
 */
export const ingredientsInStep = (step: string, ingredients: string[]) => {
    const stepWords = words(step);
    return ingredients.flatMap((line, i) =>
        foodWords(line).some(food => stepWords.some(w => w.startsWith(food) && (food.length > 3 || SHORT_ENDING.test(w.slice(food.length))))) ? [i] : []
    );
};
