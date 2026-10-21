const NAMED: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
const SWEDISH = { auml: 'ä', ouml: 'ö', aring: 'å', Auml: 'Ä', Ouml: 'Ö', Aring: 'Å', eacute: 'é' } as Record<string, string>;

/** Decodes entities, repeatedly, since some sites double-encode (`&amp;auml;`). */
export const decodeHtml = (input: string): string => {
  let text = input;
  for (let i = 0; i < 3; i++) {
    const next = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return NAMED[code] ?? SWEDISH[code] ?? whole;
    });
    if (next === text) break;
    text = next;
  }
  return text;
};

const isRecipeNode = (node: Record<string, unknown>): boolean => {
  const type = node['@type'];
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
};

const findRecipe = (node: unknown): Record<string, unknown> | null => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;
  return isRecipeNode(obj) ? obj : findRecipe(obj['@graph']);
};

const asText = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? decodeHtml(String(value)).trim() : '');

const stepTexts = (value: unknown): string[] => {
  if (typeof value === 'string') return [asText(value)];
  if (Array.isArray(value)) return value.flatMap(stepTexts);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.itemListElement)) return stepTexts(obj.itemListElement);
    return [asText(obj.text ?? obj.name)];
  }
  return [];
};

/**
 * Writes the page's schema.org Recipe (JSON-LD) out as plain text for the recipe parser,
 * or returns null when the page has none worth parsing.
 */
export const recipeTextFromHtml = (html: string): string | null => {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, json] of blocks) {
    let recipe: Record<string, unknown> | null;
    try {
      recipe = findRecipe(JSON.parse(json.trim()));
    } catch {
      continue;
    }
    if (!recipe) continue;

    const name = asText(recipe.name);
    const ingredients = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : []).map(asText).filter(Boolean);
    const steps = stepTexts(recipe.recipeInstructions).filter(Boolean);
    if (!name || ingredients.length === 0) continue;

    const yieldText = asText(Array.isArray(recipe.recipeYield) ? recipe.recipeYield[0] : recipe.recipeYield);
    const nutrition = recipe.nutrition && typeof recipe.nutrition === 'object' ? (recipe.nutrition as Record<string, unknown>) : {};
    const facts = [
      ['Calories', nutrition.calories],
      ['Protein', nutrition.proteinContent],
      ['Fat', nutrition.fatContent],
      ['Carbohydrates', nutrition.carbohydrateContent],
    ]
      .map(([label, value]) => (asText(value) ? `${label}: ${asText(value)}` : ''))
      .filter(Boolean);

    return [
      name,
      yieldText && `Servings: ${yieldText}`,
      facts.length > 0 && `Nutrition (as stated on the page): ${facts.join(', ')}`,
      `Ingredients:\n${ingredients.map((line) => `- ${line}`).join('\n')}`,
      steps.length > 0 && `Instructions:\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  return null;
};
