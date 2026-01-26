import React, { useState } from 'react';
import { Portal } from './Portal';
import { Recipe } from '../types';

interface IngredientRecipeModalProps {
  onSave: (recipe: Recipe) => Promise<void>;
  onClose: () => void;
}

export const IngredientRecipeModal: React.FC<IngredientRecipeModalProps> = ({
  onSave,
  onClose
}) => {
  const [ingredientInput, setIngredientInput] = useState('');
  const [targetCalories, setTargetCalories] = useState(400);
  const [mealType, setMealType] = useState<'breakfast' | 'main meal' | 'light meal'>('main meal');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);

  const handleGenerate = async () => {
    const ingredients = ingredientInput
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    if (ingredients.length === 0) return;

    setIsGenerating(true);
    try {
      const { generateRecipeFromIngredients } = await import('../services/geminiService');
      const partialRecipe = await generateRecipeFromIngredients(ingredients, targetCalories, mealType);

      if (partialRecipe) {
        const recipe: Recipe = {
          id: crypto.randomUUID(),
          name: partialRecipe.name || 'Generated Recipe',
          description: `Created from ingredients: ${ingredients.join(', ')}`,
          calories: partialRecipe.calories || targetCalories,
          protein: partialRecipe.protein || 0,
          fat: partialRecipe.fat || 0,
          carbs: partialRecipe.carbs || 0,
          ingredients: partialRecipe.ingredients || [],
          instructions: partialRecipe.instructions || [],
          tags: partialRecipe.tags || [mealType],
          servings: partialRecipe.servings || 1,
        };
        setGeneratedRecipe(recipe);
      }
    } catch (e: any) {
      console.error("Recipe generation failed:", e);
      alert(`Failed to generate recipe. \n\nError: ${e.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (generatedRecipe) {
      await onSave(generatedRecipe);
      onClose();
    }
  };

  const handleTryAgain = () => {
    setGeneratedRecipe(null);
  };

  const handleDiscard = () => {
    setGeneratedRecipe(null);
    setIngredientInput('');
    onClose();
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in"
        onClick={generatedRecipe ? undefined : onClose}
      >
        <div
          className="bg-white dark:bg-white/5 rounded-2xl p-6 md:p-8 w-full shadow-2xl animate-scale-in overflow-y-auto max-h-[90vh]"
          style={{ maxWidth: generatedRecipe ? '800px' : '500px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {generatedRecipe ? (
            // PREVIEW MODE
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif font-bold text-charcoal dark:text-stone-200">
                  Recipe Preview
                </h2>
                <button
                  onClick={handleDiscard}
                  className="p-2 hover:bg-stone-50 dark:bg-[#1A1714] rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Recipe Details */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-serif font-bold text-charcoal dark:text-stone-200 mb-2">{generatedRecipe.name}</h3>
                  <p className="text-sm text-charcoal/60 dark:text-stone-400">{generatedRecipe.description}</p>
                </div>

                {/* Nutrition */}
                <div className="grid grid-cols-4 gap-3 bg-stone-50 dark:bg-[#1A1714] p-4 rounded-xl border border-border">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-charcoal dark:text-stone-200">{generatedRecipe.calories}</div>
                    <div className="text-xs text-charcoal/60 dark:text-stone-400 font-medium">kcal</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-charcoal dark:text-stone-200">{generatedRecipe.protein}g</div>
                    <div className="text-xs text-charcoal/60 dark:text-stone-400 font-medium">Protein</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-charcoal dark:text-stone-200">{generatedRecipe.fat}g</div>
                    <div className="text-xs text-charcoal/60 dark:text-stone-400 font-medium">Fat</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-charcoal dark:text-stone-200">{generatedRecipe.carbs}g</div>
                    <div className="text-xs text-charcoal/60 dark:text-stone-400 font-medium">Carbs</div>
                  </div>
                </div>

                {/* Ingredients */}
                <div>
                  <h4 className="font-bold text-charcoal dark:text-stone-200 mb-3">Ingredients</h4>
                  <ul className="space-y-2">
                    {generatedRecipe.ingredients.map((ingredient, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-1">•</span>
                        <span className="text-charcoal dark:text-stone-200">{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                <div>
                  <h4 className="font-bold text-charcoal dark:text-stone-200 mb-3">Instructions</h4>
                  <ol className="space-y-3">
                    {generatedRecipe.instructions?.map((instruction, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {i + 1}
                        </span>
                        <span className="text-charcoal dark:text-stone-200 pt-0.5">{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-border">
                  <button
                    onClick={handleSaveRecipe}
                    className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all active:scale-95"
                  >
                    Save to Library
                  </button>
                  <button
                    onClick={handleTryAgain}
                    className="px-6 py-3 border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition-all"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleDiscard}
                    className="px-6 py-3 border border-border rounded-xl font-semibold hover:bg-stone-50 dark:bg-[#1A1714]/50 transition-colors text-charcoal/60 dark:text-stone-400"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </>
          ) : (
            // INPUT MODE
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-serif font-bold text-charcoal dark:text-stone-200">
                  Create Recipe from Ingredients
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-stone-50 dark:bg-[#1A1714] rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

        <div className="space-y-5">
          {/* Ingredients Input */}
          <div>
            <label className="block text-sm font-medium text-charcoal dark:text-stone-200 mb-2">
              What ingredients do you have?
            </label>
            <textarea
              value={ingredientInput}
              onChange={(e) => setIngredientInput(e.target.value)}
              placeholder="chicken breast, spinach, eggs, tomatoes, olive oil..."
              className="w-full p-3 border border-border rounded-xl bg-stone-50 dark:bg-[#1A1714] text-charcoal dark:text-stone-200 placeholder:text-charcoal/60 dark:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
              rows={4}
            />
            <p className="text-xs text-charcoal/60 dark:text-stone-400 mt-1.5">
              Separate ingredients with commas
            </p>
          </div>

          {/* Calorie Target */}
          <div>
            <label className="block text-sm font-medium text-charcoal dark:text-stone-200 mb-2">
              Target Calories
            </label>
            <div className="relative">
              <input
                type="number"
                value={targetCalories}
                onChange={(e) => setTargetCalories(parseInt(e.target.value) || 0)}
                className="w-full p-3 border border-border rounded-xl bg-stone-50 dark:bg-[#1A1714] text-charcoal dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
                min={100}
                max={800}
                step={50}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/60 dark:text-stone-400 text-sm">
                kcal
              </span>
            </div>
            <p className="text-xs text-charcoal/60 dark:text-stone-400 mt-1.5">
              Typical range: 200-500 kcal per meal
            </p>
          </div>

          {/* Meal Type */}
          <div>
            <label className="block text-sm font-medium text-charcoal dark:text-stone-200 mb-2">
              Meal Type
            </label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as 'breakfast' | 'main meal' | 'light meal')}
              className="w-full p-3 border border-border rounded-xl bg-stone-50 dark:bg-[#1A1714] text-charcoal dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-shadow"
            >
              <option value="breakfast">Breakfast</option>
              <option value="main meal">Main Meal</option>
              <option value="light meal">Light Meal</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || ingredientInput.trim().length === 0}
              className="flex-1 bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Recipe'
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-6 py-3 border border-border rounded-xl font-semibold hover:bg-stone-50 dark:bg-[#1A1714]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
            </>
          )}
      </div>
      </div>
    </Portal>
  );
};
