import { isNutritionNumber } from '../utils/recipeNutrition';
import type { Type as SchemaType, Schema, GenerateContentParameters } from "@google/genai";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import {
  GEMINI_FAST_MODEL,
  GEMINI_MODEL_PRIMARY,
  GEMINI_MODEL_STABLE,
  DEFAULT_FEATURE_FLAGS
} from "../constants";
import { Recipe, FoodLogItem, KnownFood, FeatureFlags, MealSlot, QuickMealKind } from "../types";
import { scrubPII } from "../utils/piiScrubber";

// Helper to determine active model
const getModel = (): string => {
  try {
    const saved = localStorage.getItem('fast800_devFeatureFlags');
    const flags: FeatureFlags = saved ? JSON.parse(saved) : DEFAULT_FEATURE_FLAGS;

    // Primary (3.8 Flash) if flag is on, lighter Flash-Lite if off
    // If flag is undefined (old config), fallback to default (true -> primary)
    const useExperimental = flags.useGeminiExperimental ?? DEFAULT_FEATURE_FLAGS.useGeminiExperimental;

    return useExperimental ? GEMINI_MODEL_PRIMARY : GEMINI_MODEL_STABLE;
  } catch (e) {
    console.warn("Failed to read feature flags for model selection, defaulting to stable", e);
    return GEMINI_MODEL_STABLE;
  }
};

const SIDE_DISH_PROMPT = `
  You are an expert chef and nutritionist. Suggest 3 suitable side dishes for the following main meal.
  
  MAIN MEAL: "{mainMealName}"
  CURRENT CALORIES: {mainMealCalories}
  
  Valid Side Dish Types:
  - Salad (light, fresh)
  - Vegetable side (steamed, roasted)
  - Carbohydrate (rice, potatoes, bread) - ONLY if main meal lacks carbs
  
  Constraints:
  - Total calories for side should be between 100-300kcal
  - Must complement the flavors of the main dish
  - Must be simple to prepare
  
  Return JSON array of 3 Recipe objects.
`;

// The schema type names, as plain strings: importing the SDK's Type enum at runtime put all of
// @google/genai into the startup bundle, though the request goes through the Cloud Function.
const Type = {
  OBJECT: 'OBJECT' as SchemaType.OBJECT,
  ARRAY: 'ARRAY' as SchemaType.ARRAY,
  STRING: 'STRING' as SchemaType.STRING,
  NUMBER: 'NUMBER' as SchemaType.NUMBER,
};

interface AiRequest {
  model: string;
  contents: GenerateContentParameters['contents'];
  config?: { responseMimeType?: string; responseSchema?: Schema; urlContext?: boolean };
}
interface AiResponse { text: string; urlRetrieved: boolean }

// Gemini runs in the generateAi Cloud Function so the API key stays server-side. The function
// checks the model, enforces a daily per-user limit and falls back to Flash-Lite on 503/429.
const generateAi = httpsCallable<AiRequest, AiResponse>(functions, 'generateAi', { timeout: 120_000 });
const generateWithFallback = async (params: AiRequest): Promise<AiResponse> => (await generateAi(params)).data;

const recipeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    calories: { type: Type.NUMBER, nullable: true },
    protein: { type: Type.NUMBER, nullable: true },
    fat: { type: Type.NUMBER, nullable: true },
    carbs: { type: Type.NUMBER, nullable: true },
    servings: { type: Type.NUMBER },
    ingredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    instructions: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Tags like 'breakfast', 'main meal', 'snack', 'vegetarian', 'quick', etc."
    }
  },
  required: ['name', 'ingredients']
};

/** Returns the URL when the import input is a link rather than pasted recipe text. */
export const getRecipeUrl = (input: string): string | null => {
  const match = input.trim().match(/^https?:\/\/\S+/);
  return match ? match[0] : null;
};

// The browser cannot fetch recipe sites directly (no CORS headers), so Gemini's
// urlContext tool reads the page and copies the recipe out as plain text.
// Without this step the model only sees the URL and invents a recipe from the slug.
export const fetchRecipeFromUrl = async (url: string): Promise<string> => {
  const response = await generateWithFallback({
    model: getModel(),
    contents: `Read the recipe at ${url}. Copy it out verbatim as plain text, in its original language: title, number of servings/portions, any nutrition values stated on the page (and whether they are per portion), the full ingredient list with quantities, and every instruction step. Do not add, translate, scale or invent anything. If you cannot read the page or it contains no recipe, reply exactly FETCH_FAILED.`,
    config: { urlContext: true }
  });

  const retrieved = response.urlRetrieved;
  const text = response.text?.trim();
  if (!retrieved || !text || text.includes('FETCH_FAILED')) {
    throw new Error("Could not read a recipe from that link. Try pasting the recipe text instead.");
  }
  return text;
};

export const parseRecipeText = async (text: string, attempt = 1): Promise<Partial<Recipe>> => {
  const prompt = `
    You are an expert nutritionist specializing in Mediterranean-style nutrition. Extract and structure recipe details from the text below.

    CRITICAL INSTRUCTIONS:

    1. INGREDIENTS PROCESSING:
       - If the recipe has separate parts or dishes ("For the sauce", "Gremolata", "Gräddkokt purjolök"), keep them: put a markdown heading line such as "## Sauce" before that part's ingredients, in the original language
       - Only add headings when the recipe really has two or more parts; a plain recipe is one list with no heading
       - Headings are lines that start with "## " and contain nothing else
       - Remove checkboxes (☐), bullets (•, -, *), and formatting characters
       - Keep ingredient text clean and readable
       - Preserve quantities and measurements exactly as written

    2. NUTRITION:
       - If the text states calories or macros per serving/portion, use those values exactly. Do not adjust them.
       - If a value is missing, return null or omit it. Never estimate or invent nutrition.
       - Keep explicit zero values as zero.

    3. LANGUAGE AND FIDELITY:
       - Keep the recipe in its original language. Do not translate the name, ingredients or instructions.
       - Use only ingredients and steps that appear in the text. Never invent or substitute any.

    4. TAGS SELECTION:
       Meal type (choose one): breakfast, main meal, snack, light meal
       Dietary: vegetarian, vegan, pescatarian, dairy-free, gluten-free
       Characteristics: high protein, low carb, quick (under 30 min), batch cook
       Cuisine: mediterranean, asian, mexican, indian, etc. (if applicable)

    5. SERVINGS:
       - Default to 1 if not specified
       - If recipe says "serves 4", set servings to 4
       - Ensure nutritional values are PER SERVING

    6. INSTRUCTIONS:
       - Keep numbered steps in order
       - If the ingredients have parts, put the same "## Name" heading line before each part's steps (steps that begin with a part name such as "Dillgremolata:" belong under that heading; drop the prefix)
       - Keep bold (**word**) only if the source uses it
       - Remove unnecessary text like "Step 1:", just use the instruction
       - Be clear and concise

    Recipe Text: "${scrubPII(text)}"
  `;

  try {
    const activeModel = getModel();
    console.log(`[Gemini Service] Using Model: ${activeModel}`);

    const response = await generateWithFallback({
      model: activeModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: recipeSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    // Debug logging
    console.log(`[Recipe Parse] Attempt ${attempt} success. Output length: ${output.length}`);

    const data = JSON.parse(output) as Partial<Recipe>;
    const result: Partial<Recipe> = {...data, id:crypto.randomUUID()};
    for (const key of ['calories','protein','fat','carbs'] as const) {
      if (!isNutritionNumber(result[key])) delete result[key];
    }
    result.calorieStatus = isNutritionNumber(result.calories) ? 'known' : 'unknown';
    return result;

  } catch (error: any) {
    console.warn(`[Recipe Parse] Attempt ${attempt} failed:`, error);

    // If API error specific to model, maybe retry? 
    // For now standard retry logic
    if (attempt < 3) {
      console.log(`[Recipe Parse] Retrying (Attempt ${attempt + 1})...`);
      // Simple backoff
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return parseRecipeText(text, attempt + 1);
    }

    console.error("Recipe parsing failed after 3 attempts.", error);
    throw error;
  }
};

const foodItemsSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      calories: { type: Type.NUMBER },
      protein: { type: Type.NUMBER, description: 'Grams of protein in this item' }
    },
    required: ['name', 'calories', 'protein']
  }
};

interface RawFoodItem { name: string; calories: number; protein?: number }

/** AI items → log items, with local IDs (never trust IDs from the model) */
const toFoodLogItems = (items: RawFoodItem[]): FoodLogItem[] => items.map(item => ({
  id: crypto.randomUUID(),
  name: item.name,
  calories: Math.round(item.calories),
  ...(typeof item.protein === 'number' && item.protein >= 0 ? { protein: Math.round(item.protein) } : {}),
  timestamp: Date.now(),
}));

/**
 * Protein for foods already logged without it, estimated from the name and calories (which pin
 * down the portion). Returns grams in the same order; null where the model couldn't say.
 */
export const estimateProtein = async (items: { name: string; calories: number }[]): Promise<(number | null)[]> => {
  if (!items.length) return [];
  const response = await generateWithFallback({
    model: GEMINI_FAST_MODEL,
    contents: `Estimate grams of protein for each food. The calories give the portion size.
Answer with one whole number per food, in the same order. Use -1 only if it isn't a food or drink.

${items.map((item, i) => `${i + 1}. ${scrubPII(item.name)} (${Math.round(item.calories)} kcal)`).join('\n')}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    },
  });
  const grams = JSON.parse(response.text || '[]') as number[];
  return items.map((_, i) => {
    const g = grams[i];
    return typeof g === 'number' && g >= 0 && g <= 300 ? Math.round(g) : null;
  });
};

/** Calories in one typical portion of a meal known only by name, for planning. Null when the model can't say. */
export const estimateMealCalories = async (name: string, kind: QuickMealKind, slot: MealSlot): Promise<number | null> => {
  const where = kind === 'out' ? 'eaten at a restaurant or takeaway' : kind === 'ready' ? 'bought ready-made' : 'cooked at home';
  const response = await generateWithFallback({
    model: GEMINI_FAST_MODEL,
    contents: `Estimate the calories in one typical adult portion of this ${slot === 'snack' ? 'snack' : slot}, ${where}: "${scrubPII(name)}".
Answer with one whole number of kcal. Use -1 only if it isn't a food or drink.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: { type: Type.OBJECT, properties: { calories: { type: Type.NUMBER } }, required: ['calories'] },
    },
  });
  const { calories } = JSON.parse(response.text || '{}') as { calories?: number };
  return typeof calories === 'number' && calories > 0 && calories <= 5000 ? Math.round(calories) : null;
};

/** The user's own numbers for foods they mention, so the AI reuses them instead of guessing */
const knownFoodsPrompt = (known: KnownFood[]) => known.length ? `
    THE USER'S OWN FOODS (their numbers for one portion):
${known.map(f => `    - ${scrubPII(f.name)}: ${f.calories} kcal${typeof f.protein === 'number' ? `, ${f.protein} g protein` : ''}`).join('\n')}
    When an item is one of these, use that name and those values, scaled by the amount eaten
    ("half", "2 portions"). Estimate everything else as usual.
` : '';

export const analyzeFoodLog = async (text: string, known: KnownFood[] = []): Promise<FoodLogItem[]> => {
  const startTime = performance.now();

  const prompt = `
    You are a nutritionist analyzing food intake. Identify ALL food/drink items with accurate calorie estimates.

    PORTION SIZE DEFAULTS (when not specified):
    - Apple/Banana → ~100 kcal
    - Bread slice → 80 kcal
    - Sandwich → 300-400 kcal
    - Coffee (with milk) → 20 kcal
    - Handful nuts → 170 kcal
    - Chicken breast (150g) → 250 kcal

    RULES:
    - Split combined items: "coffee and toast" → ["coffee", "toast"]
    - Include condiments if mentioned: "toast with butter" → ["toast", "butter"]
    - Account for cooking method: "fried" adds oil calories
    - Estimate realistically for the amount described; don't pad or trim calories to suit a diet
    - Round to nearest 5 calories

    EXAMPLES:
    "2 scrambled eggs with cheese and toast" → [
      {name: "2 scrambled eggs with cheese", calories: 280, protein: 19},
      {name: "1 slice toast", calories: 80, protein: 3}
    ]

    PROTEIN: grams of protein per item, estimated for the same portion (whole number).
${knownFoodsPrompt(known)}
    User Input: "${scrubPII(text)}"

    Return empty array if text is too vague to identify specific foods.
  `;

  try {
    const response = await generateWithFallback({
      model: GEMINI_FAST_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: foodItemsSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    const items = JSON.parse(output) as RawFoodItem[];
    const endTime = performance.now();
    console.log(`[Food Log] Analysis completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    return toFoodLogItems(items);

  } catch (error) {
    console.error("Error analyzing food log:", error);
    throw error;
  }
};

export const analyzeFoodImage = async (imageBase64: string, mimeType: string): Promise<FoodLogItem[]> => {
  const startTime = performance.now();

  const prompt = `
    You are a nutritionist analyzing food images. Identify all visible food/drink items with accurate calorie estimates.

    VISUAL ANALYSIS:
    1. Identify each distinct food item visible
    2. Estimate portion size using visual cues (plate size, utensils, hands)
       - Standard plate ≈ 25-27cm
       - Adult fist ≈ 1 cup volume
    3. Detect cooking method (fried foods have added oil calories)
    4. Look for hidden calories (sauces, dressings, butter, oil)

    PORTION ESTIMATION:
    - Small (¼ plate/fist-sized) → reduce calories accordingly
    - Medium (⅓ plate/palm-sized) → standard serving
    - Large (½ plate/2 fists) → 1.5-2x standard serving
    - Protein (palm-size) ≈ 100-150g
    - Grains/starches (fist-size) ≈ 1 cup ≈ 200 kcal

    COMMON FOODS:
    - Rice/Pasta (1 cup) → 200-220 kcal
    - Chicken breast (150g) → 250 kcal
    - Salmon (150g) → 280 kcal
    - Fried foods → add 100-150 kcal for oil
    - Bread slice → 80 kcal

    OUTPUT RULES:
    - Be specific: "Grilled chicken breast (150g)" not just "chicken"
    - Include cooking method: "Fried rice" vs "Steamed rice"
    - Separate items: Don't combine "chicken and rice" into one
    - Estimate realistically for the portion you can see; don't pad or trim calories to suit a diet
    - If image unclear or no food visible, return empty array

    EXAMPLE:
    Breakfast plate → [
      {name: "2 scrambled eggs", calories: 180, protein: 12},
      {name: "2 slices toast with butter", calories: 200, protein: 6},
      {name: "Coffee with milk", calories: 20, protein: 1}
    ]

    PROTEIN: grams of protein per item, estimated for the same portion (whole number).
  `;

  try {
    const activeModel = getModel();
    const response = await generateWithFallback({
      model: activeModel,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: foodItemsSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    const items = JSON.parse(output) as RawFoodItem[];
    const endTime = performance.now();
    console.log(`[Food Image] Analysis completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    return toFoodLogItems(items);

  } catch (error) {
    console.error("Error analyzing food image:", error);
    throw error;
  }
};

/**
 * Reads a wish for the week ("more fish", "no pasta", "quick dinners") into the recipes the local
 * week planner (utils/weekPlanner.ts) should favour and those it should leave out. The model only
 * sorts the family's recipes; it never picks the plan.
 */
export const readWeekHint = async (
  hint: string,
  recipes: Pick<Recipe, 'id' | 'name' | 'tags'>[]
): Promise<{ prefer: string[]; avoid: string[] }> => {
  if (!hint.trim() || recipes.length === 0) return { prefer: [], avoid: [] };
  const response = await generateWithFallback({
    model: GEMINI_FAST_MODEL,
    contents: `Someone is planning their meals for the week and wrote this wish: "${scrubPII(hint.trim())}"

Here are their recipes, numbered:
${recipes.map((r, i) => `${i + 1}. ${scrubPII(r.name)}${r.tags?.length ? ` [${r.tags.map(scrubPII).join(', ')}]` : ''}`).join('\n')}

Answer with the numbers of the recipes that fit the wish well (prefer), and of those that go against it (avoid). Leave out recipes the wish says nothing about. Use only numbers from the list.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prefer: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          avoid: { type: Type.ARRAY, items: { type: Type.NUMBER } },
        },
        required: ['prefer', 'avoid'],
      },
    },
  });
  const parsed = JSON.parse(response.text || '{}') as { prefer?: unknown[]; avoid?: unknown[] };
  // Numbers back to the real ids; anything not on the list is dropped
  const ids = (list: unknown[] | undefined) => (list || [])
    .map(n => (typeof n === 'number' ? recipes[n - 1]?.id : undefined))
    .filter((id): id is string => !!id);
  const avoid = ids(parsed.avoid);
  return { prefer: ids(parsed.prefer).filter(id => !avoid.includes(id)), avoid };
};

const ingredientParseSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Normalized ingredient name (lowercase)" },
      quantity: { type: Type.NUMBER, description: "Numeric quantity, default to 1 if unspecified" },
      unit: { type: Type.STRING, description: "Unit of measurement (tbsp, g, ml, cup, etc), 'item' if none" }
    },
    required: ['name', 'quantity', 'unit']
  }
};

const INGREDIENT_CACHE_KEY = 'vesta_ingredient_cache';

export const parseIngredients = async (ingredientTexts: string[]): Promise<Array<{ name: string, quantity: number, unit: string }>> => {
  // 1. Load Cache
  let cache: Record<string, { name: string, quantity: number, unit: string }> = {};
  try {
    const stored = localStorage.getItem(INGREDIENT_CACHE_KEY);
    if (stored) cache = JSON.parse(stored);
  } catch (e) {
    console.warn("Failed to load ingredient cache", e);
  }

  // 2. Identify Missing Items & Deduplicate
  const uniqueTexts = Array.from(new Set(ingredientTexts));
  const missingTexts: string[] = [];

  uniqueTexts.forEach(text => {
    if (!cache[text]) {
      missingTexts.push(text);
    }
  });

  // 3. Process Missing Items (if any)
  if (missingTexts.length > 0) {
    console.log(`[AI Parsing] Cache hit: ${uniqueTexts.length - missingTexts.length} items. Fetching ${missingTexts.length} new items.`);

    // Chunks run in parallel; smaller ones answer fast enough to stay well inside the request timeout
    const chunkSize = 40;
    const chunkPromises = [];
    let failedChunks = 0;

    for (let i = 0; i < missingTexts.length; i += chunkSize) {
      const chunk = missingTexts.slice(i, i + chunkSize);
      chunkPromises.push((async () => {

        const prompt = `
        You are an ingredient parsing specialist. Parse ingredient strings into structured, normalized data for recipe management.

  TASK: Extract ingredient name (normalized, lowercase), quantity (as number), and unit from each ingredient string.

        BASIC RULES:
- If no quantity is specified, use 1
  - If no unit is specified, use "item"
    - Handle vague quantities intelligently:
          * "to taste" → quantity: 1, unit: "pinch"
  * "a pinch" → quantity: 1, unit: "pinch"
    * "a dash" → quantity: 1, unit: "dash"
      * "a handful" → quantity: 1, unit: "handful"

EXAMPLES:
"2 tbsp olive oil" → { name: "olive oil", quantity: 2, unit: "tbsp" }
"500g chicken breast" → { name: "chicken breast", quantity: 500, unit: "g" }
"1 onion, diced" → { name: "onion", quantity: 1, unit: "item" }
"Salt and pepper to taste" → { name: "salt and pepper", quantity: 1, unit: "pinch" }
"Fresh basil leaves" → { name: "basil leaves", quantity: 1, unit: "handful" }
"2 eggs" → { name: "eggs", quantity: 2, unit: "item" }
"1 egg, beaten" → { name: "eggs", quantity: 1, unit: "item" }
"Large egg" → { name: "eggs", quantity: 1, unit: "item" }

        CRITICAL NORMALIZATION RULES:
- Return EXACTLY one result per input ingredient (maintain 1:1 correspondence)
  - NEVER translate: keep the name and unit in the language of the line ("svartpeppar" stays "svartpeppar", "½ förp" stays "förp", "1 nypa salt" stays "nypa")
  - Use PLURAL form for countable items: "egg" → "eggs", "tomato" → "tomatoes", "onion" → "onions"
    - Use SINGULAR form for uncountable items: "rice", "flour", "water", "salt"
      - Remove ALL modifiers: "fresh", "extra virgin", "organic", "free-range", "large", "small"
        - Remove preparation instructions: "diced", "chopped", "beaten", "minced"
          - Be consistent with the SAME canonical name:
          * "egg", "eggs", "large egg" → ALL become "eggs"
  * "onion", "onions", "red onion" → ALL become "onions"
    * "olive oil", "extra virgin olive oil", "EVOO" → ALL become "olive oil"
      * "tomato", "tomatoes", "cherry tomatoes" → ALL become "tomatoes"
        - For compound ingredients like "salt and pepper", keep as ONE item
          - The output array MUST have the same length as the input array

        Ingredient strings:
        ${JSON.stringify(chunk.map(scrubPII))}
`;

        try {
          const activeModel = getModel();
          const response = await generateWithFallback({
            model: activeModel,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: ingredientParseSchema
            }
          });

          const output = response.text;
          if (output) {
            const parsedChunk: Array<{ name: string, quantity: number, unit: string }> = JSON.parse(output);

            if (parsedChunk.length === chunk.length) {
              // Update cache
              chunk.forEach((text, index) => {
                cache[text] = parsedChunk[index];
              });
            } else {
              console.warn("Chunk mismatch in parsing");
              failedChunks++;
            }
          } else {
            failedChunks++;
          }
        } catch (error) {
          console.error("Error parsing ingredient chunk:", error);
          failedChunks++;
        }
      })());
    }

    // Wait for all chunks to complete
    await Promise.all(chunkPromises);

    // Save Updated Cache
    try {
      localStorage.setItem(INGREDIENT_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error("Failed to save ingredient cache", e);
    }
    // A guessed parse ("2 tbsp olive oil" as one item) makes a wrong list; what did parse is
    // cached, so trying again only asks for the rest
    if (failedChunks > 0) throw new Error("We couldn't read some of the ingredients. Try again.");
  } else {
    console.log(`[AI Parsing] All ${ingredientTexts.length} ingredients found in cache. Instant return.`);
  }

  // 4. Construct Result
  return ingredientTexts.map(text => cache[text]);
};

export const generateRecipeFromIngredients = async (
  ingredients: string[],
  targetCalories: number = 400,
  mealType: 'breakfast' | 'main meal' | 'light meal' = 'main meal'
): Promise<Partial<Recipe>> => {
  const prompt = `
    You are an expert nutritionist.Create a single recipe using the ingredients provided.

  AVAILABLE INGREDIENTS: ${ingredients.map(scrubPII).join(', ')}

TARGET: ${targetCalories} calories per serving
    MEAL TYPE: ${mealType}

REQUIREMENTS:
1. Use ONLY the ingredients listed above(you can use basic pantry staples: salt, pepper, water, cooking spray)
2. Create a complete recipe with name, ingredients(with quantities), and step - by - step instructions
3. Calculate accurate nutritional information(calories, protein, fat, carbs) per serving
4. Target calories: ${targetCalories} kcal(±50 kcal acceptable)
5. Follow healthy principles: high protein, healthy fats, low refined carbs
6. Make it simple enough for home cooking
    7. Servings should be 1 unless recipe naturally serves more

    NUTRITIONAL ACCURACY:
- Be precise with portion sizes to hit calorie target
  - Verify: (protein × 4) + (carbs × 4) + (fat × 9) ≈ total calories
    - Account for cooking methods(oil for frying adds calories)

    INGREDIENT USAGE - CRITICAL:
- DO NOT use ALL ingredients provided
  - Select ONLY ingredients that work well together for a cohesive dish
    - Typical recipes use 4 - 7 ingredients(not counting salt, pepper, water)
      - Prioritize protein sources as the main component
        - Choose complementary vegetables and flavors
          - Skip ingredients that don't fit the dish you're creating
            - It's perfectly fine to leave out ingredients that don't belong together
              - Add appropriate tags(${mealType}, and others like quick, high protein, low carb, etc.)

    EXAMPLES OF SELECTIVE USAGE:
- Given: "chicken, eggs, spinach, tomatoes, salmon, rice"
      → Use: chicken, spinach, tomatoes(don't force eggs, salmon, and rice into the same dish)
  - Given: "beef, lettuce, cheese, tuna, pasta"
      → Use: beef, lettuce, cheese(make a burger / salad, skip tuna and pasta)
- Given: "eggs, bacon, broccoli, chocolate, yogurt"
      → Use: eggs, bacon, broccoli(breakfast scramble, skip chocolate and yogurt)

    RECIPE CREATIVITY:
  - Create interesting, flavorful combinations
- Consider cooking methods that enhance flavors(grilling, roasting, sautéing)
- Balance textures and colors for visual appeal
  - Make it restaurant - quality but home - cookable

OUTPUT: Complete recipe with name, ingredients list with quantities, instructions, and accurate nutrition per serving.
  `;

  try {
    const activeModel = getModel();
    const response = await generateWithFallback({
      model: activeModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: recipeSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    const data = JSON.parse(output);
    return {
      ...data,
      id: crypto.randomUUID()
    };

  } catch (error) {
    console.error("Error generating recipe from ingredients:", error);
    throw error;
  }
};

export const suggestSideDishes = async (mainMealName: string, mainMealCalories: number): Promise<Recipe[]> => {
  const prompt = SIDE_DISH_PROMPT
    .replace("{mainMealName}", scrubPII(mainMealName))
    .replace("{mainMealCalories}", mainMealCalories.toString());

  try {
    const activeModel = getModel();
    const response = await generateWithFallback({
      model: activeModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: recipeSchema
        }
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    const recipes: Recipe[] = JSON.parse(output);
    return recipes.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      tags: [...(r.tags || []), 'side dish']
    }));

  } catch (error) {
    console.error("Error suggesting side dishes:", error);
    return [];
  }
};