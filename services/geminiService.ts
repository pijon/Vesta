import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GEMINI_TEXT_MODEL, GEMINI_FAST_MODEL } from "../constants";
import { Recipe, DayPlan, FoodLogItem, PurchasableItem } from "../types";

const apiKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

const recipeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    calories: { type: Type.NUMBER },
    protein: { type: Type.NUMBER },
    fat: { type: Type.NUMBER },
    carbs: { type: Type.NUMBER },
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
  required: ['name', 'calories', 'ingredients']
};

export const parseRecipeText = async (text: string, attempt = 1): Promise<Partial<Recipe>> => {
  if (!apiKey) throw new Error("API Key not found");

  const prompt = `
    You are an expert nutritionist specializing in Mediterranean-style nutrition. Extract and structure recipe details from the text below.

    CRITICAL INSTRUCTIONS:

    1. INGREDIENTS PROCESSING:
       - FLATTEN all ingredient sections into ONE single list
       - If recipe has "For the sauce", "For the marinade", "For the topping", etc., ignore these headers
       - Remove checkboxes (☐), bullets (•, -, *), and formatting characters
       - Keep ingredient text clean and readable
       - Preserve quantities and measurements exactly as written

    2. NUTRITIONAL ESTIMATION (if not provided):
       - Calories: Estimate based on ingredients and portion size
       - Protein: Calculate from protein sources (meat, fish, eggs, dairy, legumes)
       - Fat: Calculate from oils, butter, cheese, nuts, fatty meats
       - Carbs: Calculate from grains, fruits, starchy vegetables, sugars
       - For context: Most meals should be 200-400 calories per serving to support health goals
       - Be accurate and conservative - underestimate rather than overestimate

    3. MACRONUTRIENT ACCURACY:
       - If macros are partially provided, ensure they're consistent with calories
       - Verify: (protein × 4) + (carbs × 4) + (fat × 9) ≈ total calories
       - If macros don't match calories, recalculate them

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
       - Remove unnecessary text like "Step 1:", just use the instruction
       - Be clear and concise

    Recipe Text: "${text}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
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

    const data = JSON.parse(output);
    return {
      ...data,
      id: crypto.randomUUID()
    };

  } catch (error) {
    console.warn(`[Recipe Parse] Attempt ${attempt} failed:`, error);

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

const dayPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    tips: { type: Type.STRING },
    totalCalories: { type: Type.NUMBER },
    meals: {
      type: Type.ARRAY,
      items: recipeSchema
    }
  },
  required: ['meals', 'totalCalories']
};

export const generateMealPlan = async (preferences: string): Promise<DayPlan> => {
  if (!apiKey) throw new Error("API Key not found");

  const prompt = `
    You are an expert nutritionist specializing in Mediterranean-style nutrition. Create a balanced, nutritious one-day meal plan.

    TARGET: Approximately 800 calories total for the entire day

    DIETARY PREFERENCES: "${preferences}"

    MEAL STRUCTURE:
    - Generate 2-3 meals (breakfast + 1-2 main meals OR breakfast + main meal + light snack)
    - Breakfast: 200-300 calories
    - Main meal(s): 300-500 calories each
    - Light meal/snack: 100-200 calories (optional)
    - Use tag "main meal" for lunch/dinner type meals
    - Use tag "light meal" for lighter options under 250 calories

    NUTRITIONAL BALANCE:
    - Prioritize protein: Each meal should include quality protein (meat, fish, eggs, legumes, dairy)
    - Include healthy fats: Olive oil, nuts, avocado (in moderation)
    - Low-carb vegetables: Prioritize non-starchy vegetables (leafy greens, cruciferous, etc.)
    - Minimize refined carbs: Avoid white bread, pasta, rice, sugar
    - Fiber-rich: Include vegetables, salads, or low-sugar fruits
    - Target macros for the day: ~80-100g protein, ~30-40g fat, ~50-70g carbs

    NUTRITION PRINCIPLES:
    - Mediterranean-style diet emphasis (olive oil, fish, vegetables, legumes)
    - High protein to support lean body composition
    - Low glycemic index foods to stabilize blood sugar
    - Nutrient-dense, minimally processed foods
    - Meals should be satisfying and reduce hunger

    PRACTICAL REQUIREMENTS:
    - Each meal must have complete ingredients list
    - Each meal must have step-by-step instructions
    - Servings should be 1 (single portion)
    - Recipes should be simple enough for home cooking
    - Use common, accessible ingredients

    HELPFUL TIP:
    - Include one practical tip for following healthy nutrition successfully
    - Tips could cover: hydration, meal timing, exercise, sleep, mindset, food prep, etc.
    - Keep tips actionable and encouraging

    IMPORTANT: Respect the dietary preferences provided. If "vegetarian", use no meat/fish. If "vegan", use no animal products. If "gluten-free", avoid wheat/gluten.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: dayPlanSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    const data = JSON.parse(output);

    // Ensure meals have IDs and arrays
    const mealsWithIds = data.meals.map((m: any) => ({
      ...m,
      id: crypto.randomUUID(),
      ingredients: m.ingredients || [],
      instructions: m.instructions || [],
      servings: m.servings || 1
    }));

    return {
      date: new Date().toISOString().split('T')[0],
      meals: mealsWithIds,
      completedMealIds: [],
      tips: data.tips || "Stay hydrated!",
      totalCalories: data.totalCalories
    };

  } catch (error) {
    console.error("Error generating meal plan:", error);
    throw error;
  }
};

const foodItemsSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      calories: { type: Type.NUMBER }
    },
    required: ['name', 'calories']
  }
};

export const analyzeFoodLog = async (text: string): Promise<FoodLogItem[]> => {
  if (!apiKey) throw new Error("API Key not found");

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
    - Be conservative: estimate on HIGHER side for 800 kcal goal
    - Round to nearest 5 calories

    EXAMPLES:
    "2 scrambled eggs with cheese and toast" → [
      {name: "2 scrambled eggs with cheese", calories: 280},
      {name: "1 slice toast", calories: 80}
    ]

    User Input: "${text}"

    Return empty array if text is too vague to identify specific foods.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: foodItemsSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    const items = JSON.parse(output);
    const endTime = performance.now();
    console.log(`[Food Log] Analysis completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    return items.map((item: any) => ({
      id: crypto.randomUUID(),
      name: item.name,
      calories: item.calories,
      timestamp: Date.now()
    }));

  } catch (error) {
    console.error("Error analyzing food log:", error);
    throw error;
  }
};

export const analyzeFoodImage = async (imageBase64: string, mimeType: string): Promise<FoodLogItem[]> => {
  if (!apiKey) throw new Error("API Key not found");

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
    - Be conservative: estimate HIGHER for 800 kcal goal
    - If image unclear or no food visible, return empty array

    EXAMPLE:
    Breakfast plate → [
      {name: "2 scrambled eggs", calories: 180},
      {name: "2 slices toast with butter", calories: 200},
      {name: "Coffee with milk", calories: 20}
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
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

    const items = JSON.parse(output);
    const endTime = performance.now();
    console.log(`[Food Image] Analysis completed in ${((endTime - startTime) / 1000).toFixed(2)}s`);

    return items.map((item: any) => ({
      id: crypto.randomUUID(),
      name: item.name,
      calories: item.calories,
      timestamp: Date.now()
    }));

  } catch (error) {
    console.error("Error analyzing food image:", error);
    throw error;
  }
};



export type DayConfig = {
  date: string;
  type: 'fast' | 'non-fast';
  meals: number;
  useLeftovers: boolean;
  ignore: boolean;
};

export const planSpecificDays = async (
  recipes: Recipe[],
  dayConfigs: DayConfig[],
  season: string = 'Current'
): Promise<{ date: string, mealIds: string[], type?: 'fast' | 'non-fast' }[]> => {
  if (!apiKey) throw new Error("API Key not found");

  // Filter out ignored days
  const activeDays = dayConfigs.filter(d => !d.ignore);
  if (activeDays.length === 0) return [];

  // OPTIMIZATION: Map complex UUIDs to simple integer IDs
  const recipeMap = new Map<string, string>();
  const simplifiedRecipes = recipes.map((r, index) => {
    const simpleId = (index + 1).toString();
    recipeMap.set(simpleId, r.id);
    return {
      id: simpleId,
      name: r.name,
      calories: r.calories,
      tags: r.tags
    };
  });

  const schedulePrompt = activeDays.map(day => `
    DATE: ${day.date}
    TYPE: ${day.type} (${day.type === 'fast' ? '~800 kcal' : 'Standard nourishment'})
    MEALS: ${day.meals} meals
    LEFTOVERS: ${day.useLeftovers ? 'MUST use leftovers from previous dinner for lunch' : 'No constraint'}
  `).join('\n');

  const prompt = `
    You are an expert meal planner for Mediterranean-style nutrition. Create a plan for the following specific schedule:

    ${schedulePrompt}

    VARIETY REQUIREMENTS:
    1. PROTEIN ROTATION: Rotate protein sources (chicken, fish, eggs, legumes, etc.)
    2. MEAL TYPE BALANCE: Varied breakfasts (eggs, yogurt, oats)
    3. LEFTOVERS: If a day requests leftovers, you MUST schedule the previous day's DINNER as the current day's LUNCH.

    RECIPE SELECTION RULES:
    1. Use ONLY the recipes provided in the JSON list below (return simple IDs like "1", "2")
    2. Match calorie targets: Fast days (~800), Standard (~2000)
    3. SEASONAL PREFERENCE: Current season is "${season}".

    AVAILABLE RECIPES:
    ${JSON.stringify(simplifiedRecipes)}

    CRITICAL: Return a JSON array matching the requested dates.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING, description: "YYYY-MM-DD" },
              mealIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              type: { type: Type.STRING, enum: ['fast', 'non-fast'] }
            },
            required: ["date", "mealIds", "type"]
          }
        }
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    const parsedData: { date: string, mealIds: string[], type?: 'fast' | 'non-fast' }[] = JSON.parse(output);

    // Map back simple IDs to Real UUIDs
    const finalPlan = parsedData.map(day => ({
      ...day,
      mealIds: day.mealIds
        .map(simpleId => recipeMap.get(simpleId))
        .filter((id): id is string => !!id)
    }));

    return finalPlan;
  } catch (error) {
    console.error("Error generating plan:", error);
    throw error;
  }
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
  if (!apiKey) throw new Error("API Key not found");

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
    console.log(`[AI Parsing] Cache hit: ${uniqueTexts.length - missingTexts.length} items.Fetching ${missingTexts.length} new items.`);

    // Batch in chunks of 150 (Flash model has large context) to reduce round-trips
    const chunkSize = 150;
    const chunkPromises = [];

    for (let i = 0; i < missingTexts.length; i += chunkSize) {
      const chunk = missingTexts.slice(i, i + chunkSize);
      chunkPromises.push((async () => {

        const prompt = `
        You are an ingredient parsing specialist.Parse ingredient strings into structured, normalized data for recipe management.

  TASK: Extract ingredient name(normalized, lowercase), quantity(as number), and unit from each ingredient string.

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
- Return EXACTLY one result per input ingredient(maintain 1: 1 correspondence)
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
        ${JSON.stringify(chunk)}
`;

        try {
          const response = await ai.models.generateContent({
            model: GEMINI_TEXT_MODEL,
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
              console.warn(`[AI Parsing] Chunk mismatch.Sent ${chunk.length}, got ${parsedChunk.length}. Falling back to individual processing or partial cache not implemented.`);
              // Ideally we retry or handle this, but for now we just try to save what matched if strictly ordered, 
              // but safe to skip cache save for safety if length mismatches
            }
          }
        } catch (error) {
          console.error("Error parsing ingredient chunk:", error);
          // Don't throw, just continue. Missing items will fail lookup later and maybe just be skipped or return error
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
  } else {
    console.log(`[AI Parsing] All ${ingredientTexts.length} ingredients found in cache.Instant return.`);
  }

  // 4. Construct Result
  const results = ingredientTexts.map(text => {
    const cached = cache[text];
    if (cached) return cached;

    // Fallback for failed items: return raw but valid structure
    return { name: text.toLowerCase().trim(), quantity: 1, unit: 'item' };
  });

  return results;
};

const purchasableItemSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      ingredientName: { type: Type.STRING },
      requiredQuantity: { type: Type.STRING, description: "What recipe needs" },
      purchasableQuantity: { type: Type.STRING, description: "What to buy at store" },
      purchasableSize: { type: Type.STRING, description: "Common store package size" },
      rationale: { type: Type.STRING, description: "Brief explanation of conversion" }
    },
    required: ['ingredientName', 'requiredQuantity', 'purchasableQuantity', 'purchasableSize']
  }
};

export const convertToPurchasableQuantities = async (
  aggregatedIngredients: Array<{ name: string, quantity: number, unit: string }>
): Promise<PurchasableItem[]> => {
  if (!apiKey) throw new Error("API Key not found");

  const prompt = `
    You are a grocery shopping assistant specializing in converting recipe quantities to realistic store - buyable amounts.

  TASK: Convert aggregated recipe ingredient quantities into practical grocery store package sizes that customers can actually purchase.

    SHOPPING CONTEXT - Consider:
- Common package sizes in supermarkets(e.g., olive oil comes in 250ml, 500ml, 1L bottles)
  - Buy the smallest package that covers the need(but realistic - don't suggest buying a single egg)
    - Fresh produce often sold by weight or count(e.g., "3 tomatoes" or "500g tomatoes")
  - Dry goods come in standard packages(flour in 1kg bags, rice in 1kg / 2kg bags)
  - Spices and seasonings come in small jars(50g - 100g typical)
  - Dairy products have standard sizes(milk in 1L / 2L, cheese in 200g - 500g blocks)
  - Meat and fish sold by weight or pre - packaged(chicken breast in 500g - 1kg packs)

    Format:
    - ingredientName: Must EXACTLY match the input 'name' field.Do not change spelling or capitalization.
    - requiredQuantity: Show what the recipe needs with unit conversion if helpful(e.g., "1.5 tbsp (≈22ml)")
  - purchasableQuantity: Suggest the smallest realistic package that covers the need
    - purchasableSize: The numeric size for comparison
      - rationale: Brief explanation(max 10 words)

Examples:
Input: { name: "olive oil", quantity: 1.5, unit: "tbsp" }
Output: {
  ingredientName: "olive oil",
    requiredQuantity: "1.5 tbsp (≈22ml)",
      purchasableQuantity: "250ml bottle",
        purchasableSize: "250ml",
          rationale: "Smallest bottle size, provides many servings"
}

Input: { name: "chicken breast", quantity: 750, unit: "g" }
Output: {
  ingredientName: "chicken breast",
    requiredQuantity: "750g",
      purchasableQuantity: "750g pack",
        purchasableSize: "750g",
          rationale: "Standard supermarket pack size"
}

Input: { name: "cumin", quantity: 1, unit: "pinch" }
Output: {
  ingredientName: "cumin",
    requiredQuantity: "1 pinch",
      purchasableQuantity: "50g jar",
        purchasableSize: "50g",
          rationale: "Standard spice jar size"
}

    Ingredients to convert:
    ${JSON.stringify(aggregatedIngredients)}
`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: purchasableItemSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    return JSON.parse(output);
  } catch (error) {
    console.error("Error converting to purchasable quantities:", error);
    throw error;
  }
};

export const generateRecipeFromIngredients = async (
  ingredients: string[],
  targetCalories: number = 400,
  mealType: 'breakfast' | 'main meal' | 'light meal' = 'main meal'
): Promise<Partial<Recipe>> => {
  if (!apiKey) throw new Error("API Key not found");

  const prompt = `
    You are an expert nutritionist.Create a single recipe using the ingredients provided.

  AVAILABLE INGREDIENTS: ${ingredients.join(', ')}

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
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
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