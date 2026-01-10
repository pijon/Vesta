import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GEMINI_TEXT_MODEL } from "../constants";
import { Recipe, DayPlan, FoodLogItem, PurchasableItem } from "../types";

const apiKey = process.env.API_KEY;
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
    type: { type: Type.STRING, enum: ['breakfast', 'main meal', 'snack', 'light meal'] }
  },
  required: ['name', 'calories', 'ingredients']
};

export const parseRecipeText = async (text: string, attempt = 1): Promise<Partial<Recipe>> => {
  if (!apiKey) throw new Error("API Key not found");

  const prompt = `
    Extract recipe details from the text below.
    
    CRITICAL INSTRUCTIONS:
    1. FLATTEN all ingredient sections. If the recipe has "For the sauce", "For the marinade", etc., ignore these headers and just list all ingredients in one single list.
    2. Estimate calories per serving if not provided.
    3. Determine the meal type (breakfast, main meal, snack, light meal).
    4. Default servings to 1 if not found.
    5. Clean up ingredient strings (remove checkboxes or bullets).

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
        Generate a one-day meal plan (breakfast, main meal, main meal or light meal) that totals approximately 800 calories.
        Follow these dietary preferences: "${preferences}".
        Include a tip for following the Fast 800 diet.
        Ensure each meal has a sensible serving size (usually 1).
        Note: Use 'main meal' for lunch and dinner type meals.
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
        Analyze the following text and identify food items and their estimated calories.
        Text: "${text}"
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
        Analyze the food items in this image and estimate their calories.
        List each distinct food item you can identify with its estimated calorie content.
        Be specific about portion sizes when visible (e.g., "1 slice of bread", "half cup of rice").
        Be conservative in estimates to help users stay within their 800 kcal daily limit.
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
    type: r.type
  }));

  const prompt = `
    You are an expert meal planner for the Fast 800 diet.
    
    Task: Create a 7-day meal plan starting from ${startDate}.
    Diet Mode: ${dietMode === 'daily' ? 'Strict 800 calories every day' : `5:2 Diet. 2 days should be "fast" days (800 kcal), and 5 days should be "non-fast" days (approx ${nonFastCalories} kcal)`}.
    
    Rules:
    1. If Diet Mode is "Strict 800", every day target ~800 calories.
    2. If Diet Mode is "5:2", randomly select 2 days (e.g., Mon/Thu or random) to be FAST days (~800 kcal). The other 5 days should be NON-FAST days (~${nonFastCalories} kcal).
    3. Use ONLY the recipes provided in the JSON list below. Do not invent recipes.
    4. Return the exact ID of the recipe used.
    5. IMPORTANT: For each day, specify "type": "fast" or "non-fast".
    
    Available Recipes:
    ${JSON.stringify(simplifiedRecipes)}
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
    type: r.type
  }));

  const prompt = `
    You are an expert meal planner for the Fast 800 diet.
    
    Task: Create a meal plan for a SINGLE DAY (${date}).
    Target Calories: Approximately ${targetCalories} kcal.
    
    Rules:
    1. Select a combination of meals that sum up to roughly ${targetCalories} calories.
    2. Use ONLY the recipes provided in the JSON list below.
    3. Return the exact IDs of the recipes used.
    4. Provide a helpful daily tip.
    
    Available Recipes:
    ${JSON.stringify(simplifiedRecipes)}
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

export const parseIngredients = async (ingredientTexts: string[]): Promise<Array<{ name: string, quantity: number, unit: string }>> => {
  if (!apiKey) throw new Error("API Key not found");

  const prompt = `
    Parse the following ingredient strings into structured data.
    Extract the ingredient name (normalized, lowercase), quantity (as number), and unit.
    If no quantity is specified, use 1. If no unit, use "item".
    Handle vague quantities intelligently:
    - "to taste" → quantity: 1, unit: "pinch"
    - "a pinch" → quantity: 1, unit: "pinch"
    - "a dash" → quantity: 1, unit: "dash"

    Examples:
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
    ${JSON.stringify(ingredientTexts)}
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
    if (!output) throw new Error("No response from AI");

    return JSON.parse(output);
  } catch (error) {
    console.error("Error parsing ingredients:", error);
    throw error;
  }
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
    You are a grocery shopping assistant. Convert recipe ingredient quantities to realistic store-buyable amounts.

    Consider:
    - Common package sizes in supermarkets (e.g., olive oil comes in 250ml, 500ml, 1L bottles)
    - Buy the smallest package that covers the need (but realistic - don't suggest buying a single egg)
    - Fresh produce often sold by weight or count (e.g., "3 tomatoes" or "500g tomatoes")
    - Dry goods come in standard packages (flour in 1kg bags, rice in 1kg/2kg bags)
    - Spices and seasonings come in small jars (50g-100g typical)
    - Dairy products have standard sizes (milk in 1L/2L, cheese in 200g-500g blocks)
    - Meat and fish sold by weight or pre-packaged (chicken breast in 500g-1kg packs)

    Format:
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