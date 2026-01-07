import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GEMINI_TEXT_MODEL } from "../constants";
import { Recipe, DayPlan, FoodLogItem } from "../types";

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

export const parseRecipeText = async (text: string): Promise<Partial<Recipe>> => {
  if (!apiKey) throw new Error("API Key not found");

  const prompt = `
    Extract recipe details from the following text. 
    Estimate calories per serving if not explicitly stated.
    Identify if it's best for breakfast, main meal, snack, or a light meal.
    Identify the number of servings (default to 1).
    Format ingredients into a clean list.
    
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
    
    const data = JSON.parse(output);
    return {
      ...data,
      id: crypto.randomUUID()
    };

  } catch (error) {
    console.error("Error parsing recipe:", error);
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
      dailyTip: { type: Type.STRING }
    },
    required: ["date", "mealIds"]
  }
};

export const planWeekWithExistingRecipes = async (recipes: Recipe[], startDate: string): Promise<{date: string, mealIds: string[], dailyTip?: string}[]> => {
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
    
    Rules:
    1. Target approximately 800 calories per day (range 750-900 is acceptable).
    2. Use ONLY the recipes provided in the JSON list below. Do not invent recipes.
    3. Return the exact ID of the recipe used.
    4. Try to vary the meals day-to-day if possible, but repeating favorites is okay if the user has few recipes.
    5. Ensure a mix of breakfast/main meal/light meal types if the recipe metadata allows.
    
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