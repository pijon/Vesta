import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GEMINI_TEXT_MODEL } from "../constants";
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

  const prompt = `
    You are a professional nutritionist helping users track their food intake for their daily nutrition goals.

    TASK: Analyze the text below and identify ALL food and drink items consumed with accurate calorie estimates.

    ACCURACY REQUIREMENTS:
    - Use standard portion sizes from nutritional databases (USDA, NHS, etc.)
    - For specific quantities (e.g., "2 eggs", "100g chicken"), calculate exact calories
    - For vague quantities (e.g., "a sandwich", "some chips"), use typical serving sizes
    - Be conservative: When in doubt, estimate on the HIGHER side to help users stay within their 800 kcal limit
    - Round to nearest 5 calories for clarity

    PORTION SIZE ASSUMPTIONS (when not specified):
    - "An apple" → medium apple (182g) ≈ 95 kcal
    - "A banana" → medium banana (118g) ≈ 105 kcal
    - "A slice of bread" → one slice (30g) ≈ 80 kcal
    - "A sandwich" → 2 slices bread + filling ≈ 300-400 kcal (estimate based on filling)
    - "A cup of coffee" → black coffee ≈ 5 kcal, with milk ≈ 20 kcal
    - "A handful of nuts" → 30g ≈ 170 kcal
    - "A bowl of rice" → 1 cup cooked (195g) ≈ 200 kcal
    - "Chicken breast" → 150g ≈ 250 kcal
    - "A snack bag of chips" → 25g ≈ 130 kcal

    PARSING RULES:
    - Split combined items: "coffee and toast" → ["coffee", "toast"]
    - Identify implicit foods: "had breakfast" is too vague - ask for specifics, but if clear context like "scrambled eggs breakfast", include it
    - Include condiments/toppings if mentioned: "toast with butter" → ["toast", "butter"]
    - Include cooking methods in calorie calculation: "fried" adds oil calories, "grilled" doesn't
    - Recognize drinks: coffee, tea, juice, soda, alcohol (these all have calories!)
    - Handle meal descriptions: "chicken salad" → estimate chicken portion + salad vegetables + likely dressing

    COMMON PITFALLS TO AVOID:
    - Don't ignore "small" items like milk in coffee, butter on toast, oil in cooking
    - Don't forget drinks - they can be high calorie (juice, soda, alcohol)
    - Don't underestimate restaurant/takeaway portions (they're usually larger)
    - Don't miss cooking fats (1 tbsp oil = 120 kcal)

    EXAMPLES:
    Input: "2 scrambled eggs with cheese and a slice of toast"
    Output: [
      {name: "2 scrambled eggs with cheese", calories: 280},
      {name: "1 slice toast", calories: 80}
    ]

    Input: "Grilled chicken salad with olive oil dressing"
    Output: [
      {name: "Grilled chicken breast (150g)", calories: 250},
      {name: "Mixed salad vegetables", calories: 30},
      {name: "Olive oil dressing (1 tbsp)", calories: 120}
    ]

    Input: "Coffee with milk and a biscuit"
    Output: [
      {name: "Coffee with milk", calories: 20},
      {name: "Biscuit", calories: 70}
    ]

    User Input: "${text}"

    IMPORTANT: Only include items that are clearly identifiable as food or drink. If the text is too vague (like "had something"), return an empty array.
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

  const prompt = `
    You are a professional nutritionist analyzing food images for daily nutrition tracking.

    TASK: Identify all visible food and drink items in this image and provide accurate calorie estimates.

    VISUAL ANALYSIS APPROACH:
    1. IDENTIFY each distinct food item visible
    2. ESTIMATE portion size using visual cues:
       - Compare to common objects (plate size, utensils, hands if visible)
       - Standard plate diameter ≈ 25-27cm (10 inches)
       - Standard coffee cup ≈ 240ml (8 oz)
       - Adult fist ≈ 1 cup volume reference
    3. ASSESS cooking method if visible (fried foods have added oil calories)
    4. DETECT hidden calories (sauces, dressings, butter, oil on surface)

    PORTION SIZE ESTIMATION:
    - Small portion: ¼ of plate or fist-sized → estimate accordingly
    - Medium portion: ⅓ of plate or palm-sized → standard serving
    - Large portion: ½ of plate or 2 fists → 1.5-2x standard serving
    - For proteins: Size of palm (thickness + area) ≈ 100-150g
    - For grains/starches: Fist-sized portion ≈ 1 cup cooked ≈ 200 kcal
    - For vegetables: Fill of plate matters less (low calorie density)

    CALORIE ESTIMATION RULES:
    - Be CONSERVATIVE: Estimate on the HIGHER side for calorie goal adherence
    - Account for cooking fats: Fried foods add 100-200 kcal from oil
    - Include visible sauces/toppings: Creamy sauces ≈ 100 kcal per 2 tbsp
    - Restaurant portions: Usually 30-50% larger than home portions
    - Hidden calories: Butter on bread, oil on vegetables, sugar in drinks

    COMMON FOODS REFERENCE:
    - Rice (1 cup cooked): 200 kcal
    - Pasta (1 cup cooked): 220 kcal
    - Chicken breast (150g): 250 kcal
    - Salmon (150g): 280 kcal
    - Beef (150g): 300-400 kcal depending on fat
    - Fried foods: Add 100-150 kcal for frying oil
    - Cheese (30g slice): 110 kcal
    - Bread (1 slice): 80 kcal
    - Potato (medium baked): 160 kcal
    - Fries (small serving): 220 kcal

    OUTPUT FORMAT:
    - Be specific with descriptions: "Grilled chicken breast (150g)" not just "chicken"
    - Include cooking method: "Fried rice" vs "Steamed rice"
    - Mention visible toppings: "Toast with butter" not just "toast"
    - Separate items: Don't combine "chicken and rice" into one item
    - Use portion indicators: "Small bowl of soup" or "2 eggs"

    EXAMPLES:
    Image of breakfast plate → [
      {name: "2 scrambled eggs", calories: 180},
      {name: "2 slices toast with butter", calories: 200},
      {name: "Coffee with milk", calories: 20}
    ]

    Image of salad bowl → [
      {name: "Grilled chicken breast (150g)", calories: 250},
      {name: "Mixed green salad (2 cups)", calories: 40},
      {name: "Cherry tomatoes (10 pieces)", calories: 30},
      {name: "Caesar dressing (2 tbsp)", calories: 150}
    ]

    IMPORTANT:
    - If image is unclear or doesn't show food, return empty array
    - Only estimate what you can actually see
    - When uncertain about portion size, state it: "Rice (estimated 1 cup)"
    - Conservative estimates help users avoid exceeding their 800 kcal daily goal
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

const weeklyPlanSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      date: { type: Type.STRING, description: "YYYY-MM-DD format" },
      mealIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "IDs of the selected recipes"
      },
      dailyTip: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['fast', 'non-fast'] }
    },
    required: ["date", "mealIds", "type"]
  }
};

export const planWeekWithExistingRecipes = async (recipes: Recipe[], startDate: string, dietMode: 'daily' | '5:2' = 'daily', nonFastCalories: number = 2000): Promise<{ date: string, mealIds: string[], dailyTip?: string, type?: 'fast' | 'non-fast' }[]> => {
  if (!apiKey) throw new Error("API Key not found");

  // Simplify recipes to reduce token usage and focus AI on nutrition/type
  const simplifiedRecipes = recipes.map(r => ({
    id: r.id,
    name: r.name,
    calories: r.calories,
    tags: r.tags
  }));

  const prompt = `
    You are an expert meal planner for Mediterranean-style nutrition. Create a balanced, varied 7-day meal plan.

    START DATE: ${startDate}
    DIET MODE: ${dietMode === 'daily' ? 'Consistent daily calorie goal' : `5:2 Pattern - 2 low-calorie days, 5 standard days (${nonFastCalories} kcal)`}

    CALORIE TARGETS:
    ${dietMode === 'daily'
      ? '- Every day: ~800 calories total\n    - Each day should have type: "fast"'
      : `- Fast days (2 days): ~800 calories total, type: "fast"\n    - Non-fast days (5 days): ~${nonFastCalories} calories total, type: "non-fast"\n    - Spread fast days across the week (e.g., Monday + Thursday, or Tuesday + Friday) - avoid consecutive days`
    }

    VARIETY REQUIREMENTS:
    1. PROTEIN ROTATION: Rotate protein sources throughout the week
       - Don't repeat the same protein on consecutive days
       - Mix: chicken, fish, eggs, legumes, tofu, beef, pork, seafood
       - Aim for fish at least 2-3 times per week (Mediterranean diet principle)

    2. CUISINE DIVERSITY: Vary cuisines if recipes allow
       - Don't serve Mediterranean meals every single day
       - Mix different flavor profiles: Asian, Mexican, Indian, Mediterranean, etc.

    3. MEAL TYPE BALANCE: Ensure variety in breakfast choices
       - Don't repeat the same breakfast multiple days in a row
       - Mix: egg-based, yogurt-based, oatmeal, smoothies, etc.

    4. RECIPE REUSE LIMITS:
       - Avoid using the exact same recipe more than twice in the week
       - If limited recipes available, space out repetitions (at least 3 days apart)

    NUTRITIONAL BALANCE (across the week):
    - High protein emphasis: Most meals should include quality protein
    - Adequate healthy fats: Include sources like olive oil, nuts, avocado
    - Low-carb vegetables: Prioritize non-starchy vegetables
    - Fiber-rich foods: Include in most meals
    - Limited refined carbs: Minimize white bread, pasta, rice, sugar

    MEAL STRUCTURE GUIDELINES:
    - Each day should have 2-3 meals total (breakfast + 1-2 main meals OR breakfast + main meal + light meal)
    - Fast days (800 kcal): Usually 2-3 meals
    - Non-fast days (${nonFastCalories} kcal): Usually 3 meals
    - Select recipes whose tags match the meal time (breakfast tag for breakfast, main meal tag for lunch/dinner)

    RECIPE SELECTION RULES:
    1. Use ONLY the recipes provided in the JSON list below - do not invent recipes
    2. Return the exact recipe ID from the list
    3. Match calorie targets as closely as possible
    4. Prioritize recipes with appropriate tags for the meal slot
    5. Consider recipe calories when building daily totals

    DAILY TIP REQUIREMENTS:
    - Provide one unique, actionable tip for each day
    - Vary tip topics: hydration, exercise, sleep, mindset, meal prep, portion control, etc.
    - Keep tips positive, practical, and encouraging
    - Don't repeat the same tip multiple days

    AVAILABLE RECIPES:
    ${JSON.stringify(simplifiedRecipes)}

    CRITICAL: Each day object MUST include "type": "fast" or "non-fast" based on calorie target for that day.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: weeklyPlanSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    return JSON.parse(output);
  } catch (error) {
    console.error("Error generating weekly plan:", error);
    throw error;
  }
};

const singleDayPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    mealIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "IDs of the selected recipes"
    },
    dailyTip: { type: Type.STRING }
  },
  required: ["mealIds"]
};

export const planDayWithExistingRecipes = async (recipes: Recipe[], date: string, targetCalories: number = 800): Promise<{ mealIds: string[], dailyTip?: string }> => {
  if (!apiKey) throw new Error("API Key not found");

  // Simplify recipes
  const simplifiedRecipes = recipes.map(r => ({
    id: r.id,
    name: r.name,
    calories: r.calories,
    tags: r.tags
  }));

  const prompt = `
    You are an expert meal planner for Mediterranean-style nutrition. Create a balanced single-day meal plan.

    DATE: ${date}
    CALORIE TARGET: Approximately ${targetCalories} kcal total for the day

    MEAL STRUCTURE:
    ${targetCalories <= 900
      ? '- 2-3 meals total (breakfast + 1-2 main meals OR breakfast + main meal + light snack)\n    - Breakfast: 200-300 kcal\n    - Main meal(s): 300-500 kcal each\n    - Light meal/snack: 100-200 kcal (if included)'
      : `- 3 meals total (breakfast + lunch + dinner)\n    - Breakfast: ${Math.round(targetCalories * 0.25)}-${Math.round(targetCalories * 0.3)} kcal\n    - Lunch: ${Math.round(targetCalories * 0.35)}-${Math.round(targetCalories * 0.4)} kcal\n    - Dinner: ${Math.round(targetCalories * 0.3)}-${Math.round(targetCalories * 0.35)} kcal`
    }

    NUTRITIONAL BALANCE:
    - Prioritize protein: Include quality protein in each meal (meat, fish, eggs, legumes, dairy)
    - Healthy fats: Use sources like olive oil, nuts, avocado
    - Low-carb vegetables: Emphasize non-starchy vegetables
    - Minimize refined carbs: Avoid white bread, pasta, rice, sugar
    - Fiber-rich: Include vegetables, salads, or low-sugar fruits
    - Target macros: ~${Math.round(targetCalories * 0.3 / 4)}g protein, ~${Math.round(targetCalories * 0.25 / 9)}g fat, ~${Math.round(targetCalories * 0.25 / 4)}g carbs

    MEAL DISTRIBUTION:
    - Start with breakfast (tag: "breakfast")
    - Include 1-2 main meals (tag: "main meal")
    - Optional: Add light meal or snack (tag: "light meal" or "snack") if under calorie target
    - Select recipes whose tags match the appropriate meal time

    RECIPE SELECTION RULES:
    1. Use ONLY the recipes provided in the JSON list below - do not invent recipes
    2. Return the exact recipe ID from the list
    3. Combine recipes to match the ${targetCalories} kcal target as closely as possible
    4. Aim to be within ±50 kcal of the target
    5. Prioritize recipes with tags matching the meal slot (breakfast, main meal, etc.)
    6. Ensure variety: Try to select recipes with different protein sources and flavors

    DAILY TIP:
    - Provide one practical, actionable tip for maintaining healthy nutrition
    - Topics can include: hydration, meal timing, exercise, sleep, mindset, food prep, portion control
    - Keep it positive, encouraging, and specific
    - Make it relevant to the ${targetCalories} kcal target (e.g., tips for managing hunger on low-calorie days)

    AVAILABLE RECIPES:
    ${JSON.stringify(simplifiedRecipes)}

    IMPORTANT: The sum of selected recipe calories should be as close to ${targetCalories} kcal as possible. Prioritize meeting the calorie target over other preferences.
  `;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: singleDayPlanSchema
      }
    });

    const output = response.text;
    if (!output) throw new Error("No response from AI");

    return JSON.parse(output);
  } catch (error) {
    console.error("Error generating day plan:", error);
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
    console.log(`[AI Parsing] Cache hit: ${uniqueTexts.length - missingTexts.length} items. Fetching ${missingTexts.length} new items.`);

    // Batch in chunks of 20 to avoid token limits if list is huge
    const chunkSize = 20;
    for (let i = 0; i < missingTexts.length; i += chunkSize) {
      const chunk = missingTexts.slice(i, i + chunkSize);

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
        "2 tbsp olive oil" → {name: "olive oil", quantity: 2, unit: "tbsp"}
        "500g chicken breast" → {name: "chicken breast", quantity: 500, unit: "g"}
        "1 onion, diced" → {name: "onion", quantity: 1, unit: "item"}
        "Salt and pepper to taste" → {name: "salt and pepper", quantity: 1, unit: "pinch"}
        "Fresh basil leaves" → {name: "basil leaves", quantity: 1, unit: "handful"}
        "2 eggs" → {name: "eggs", quantity: 2, unit: "item"}
        "1 egg, beaten" → {name: "eggs", quantity: 1, unit: "item"}
        "Large egg" → {name: "eggs", quantity: 1, unit: "item"}

        CRITICAL NORMALIZATION RULES:
        - Return EXACTLY one result per input ingredient (maintain 1:1 correspondence)
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
            console.warn(`[AI Parsing] Chunk mismatch. Sent ${chunk.length}, got ${parsedChunk.length}. Falling back to individual processing or partial cache not implemented.`);
            // Ideally we retry or handle this, but for now we just try to save what matched if strictly ordered, 
            // but safe to skip cache save for safety if length mismatches
          }
        }
      } catch (error) {
        console.error("Error parsing ingredient chunk:", error);
        // Don't throw, just continue. Missing items will fail lookup later and maybe just be skipped or return error
      }
    }

    // Save Updated Cache
    try {
      localStorage.setItem(INGREDIENT_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error("Failed to save ingredient cache", e);
    }
  } else {
    console.log(`[AI Parsing] All ${ingredientTexts.length} ingredients found in cache. Instant return.`);
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
    You are a grocery shopping assistant specializing in converting recipe quantities to realistic store-buyable amounts.

    TASK: Convert aggregated recipe ingredient quantities into practical grocery store package sizes that customers can actually purchase.

    SHOPPING CONTEXT - Consider:
    - Common package sizes in supermarkets (e.g., olive oil comes in 250ml, 500ml, 1L bottles)
    - Buy the smallest package that covers the need (but realistic - don't suggest buying a single egg)
    - Fresh produce often sold by weight or count (e.g., "3 tomatoes" or "500g tomatoes")
    - Dry goods come in standard packages (flour in 1kg bags, rice in 1kg/2kg bags)
    - Spices and seasonings come in small jars (50g-100g typical)
    - Dairy products have standard sizes (milk in 1L/2L, cheese in 200g-500g blocks)
    - Meat and fish sold by weight or pre-packaged (chicken breast in 500g-1kg packs)

    Format:
    - ingredientName: Must EXACTLY match the input 'name' field. Do not change spelling or capitalization.
    - requiredQuantity: Show what the recipe needs with unit conversion if helpful (e.g., "1.5 tbsp (≈22ml)")
    - purchasableQuantity: Suggest the smallest realistic package that covers the need
    - purchasableSize: The numeric size for comparison
    - rationale: Brief explanation (max 10 words)

    Examples:
    Input: {name: "olive oil", quantity: 1.5, unit: "tbsp"}
    Output: {
      ingredientName: "olive oil",
      requiredQuantity: "1.5 tbsp (≈22ml)",
      purchasableQuantity: "250ml bottle",
      purchasableSize: "250ml",
      rationale: "Smallest bottle size, provides many servings"
    }

    Input: {name: "chicken breast", quantity: 750, unit: "g"}
    Output: {
      ingredientName: "chicken breast",
      requiredQuantity: "750g",
      purchasableQuantity: "750g pack",
      purchasableSize: "750g",
      rationale: "Standard supermarket pack size"
    }

    Input: {name: "cumin", quantity: 1, unit: "pinch"}
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
    You are an expert nutritionist. Create a single recipe using the ingredients provided.

    AVAILABLE INGREDIENTS: ${ingredients.join(', ')}

    TARGET: ${targetCalories} calories per serving
    MEAL TYPE: ${mealType}

    REQUIREMENTS:
    1. Use ONLY the ingredients listed above (you can use basic pantry staples: salt, pepper, water, cooking spray)
    2. Create a complete recipe with name, ingredients (with quantities), and step-by-step instructions
    3. Calculate accurate nutritional information (calories, protein, fat, carbs) per serving
    4. Target calories: ${targetCalories} kcal (±50 kcal acceptable)
    5. Follow healthy principles: high protein, healthy fats, low refined carbs
    6. Make it simple enough for home cooking
    7. Servings should be 1 unless recipe naturally serves more

    NUTRITIONAL ACCURACY:
    - Be precise with portion sizes to hit calorie target
    - Verify: (protein × 4) + (carbs × 4) + (fat × 9) ≈ total calories
    - Account for cooking methods (oil for frying adds calories)

    INGREDIENT USAGE - CRITICAL:
    - DO NOT use ALL ingredients provided
    - Select ONLY ingredients that work well together for a cohesive dish
    - Typical recipes use 4-7 ingredients (not counting salt, pepper, water)
    - Prioritize protein sources as the main component
    - Choose complementary vegetables and flavors
    - Skip ingredients that don't fit the dish you're creating
    - It's perfectly fine to leave out ingredients that don't belong together
    - Add appropriate tags (${mealType}, and others like quick, high protein, low carb, etc.)

    EXAMPLES OF SELECTIVE USAGE:
    - Given: "chicken, eggs, spinach, tomatoes, salmon, rice"
      → Use: chicken, spinach, tomatoes (don't force eggs, salmon, and rice into the same dish)
    - Given: "beef, lettuce, cheese, tuna, pasta"
      → Use: beef, lettuce, cheese (make a burger/salad, skip tuna and pasta)
    - Given: "eggs, bacon, broccoli, chocolate, yogurt"
      → Use: eggs, bacon, broccoli (breakfast scramble, skip chocolate and yogurt)

    RECIPE CREATIVITY:
    - Create interesting, flavorful combinations
    - Consider cooking methods that enhance flavors (grilling, roasting, sautéing)
    - Balance textures and colors for visual appeal
    - Make it restaurant-quality but home-cookable

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