import React, { useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { Recipe } from '../types';
import { Sheet } from './Sheet';

interface IngredientRecipeModalProps {
  onSave: (recipe: Recipe) => Promise<void>;
  onClose: () => void;
}

type MealType = 'breakfast' | 'main meal' | 'light meal';

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'main meal', label: 'Main meal' },
  { value: 'light meal', label: 'Light meal' },
];

/** Create a recipe from the ingredients at hand: describe them, preview what the AI suggests, then save it. */
export const IngredientRecipeModal: React.FC<IngredientRecipeModalProps> = ({
  onSave,
  onClose
}) => {
  const [ingredientInput, setIngredientInput] = useState('');
  const [targetCalories, setTargetCalories] = useState(400);
  const [mealType, setMealType] = useState<MealType>('main meal');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);

  const handleGenerate = async () => {
    const ingredients = ingredientInput
      .split(',')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    if (ingredients.length === 0) return;

    setIsGenerating(true);
    setError(null);
    try {
      const { generateRecipeFromIngredients } = await import('../services/geminiService');
      const partialRecipe = await generateRecipeFromIngredients(ingredients, targetCalories, mealType);

      if (partialRecipe) {
        const recipe: Recipe = {
          id: crypto.randomUUID(),
          name: partialRecipe.name || 'Generated recipe',
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
    } catch (e: unknown) {
      console.error('Recipe generation failed:', e);
      setError(`We couldn't create a recipe. ${e instanceof Error ? e.message : 'Please try again.'}`);
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

  const handleDiscard = () => {
    setGeneratedRecipe(null);
    setIngredientInput('');
    onClose();
  };

  if (generatedRecipe) {
    return (
      <Sheet
        title={generatedRecipe.name}
        subtitle={generatedRecipe.description}
        size="lg"
        onClose={handleDiscard}
        footer={
          <div className="flex flex-wrap gap-2">
            <button onClick={handleDiscard} className="btn-ghost">Discard</button>
            <button onClick={() => setGeneratedRecipe(null)} className="btn-secondary"><RotateCcw size={16} aria-hidden="true" /> Try again</button>
            <button onClick={handleSaveRecipe} className="btn-primary flex-1">Save to my recipes</button>
          </div>
        }
      >
        <div className="space-y-6 pt-1">
          <dl className="grid grid-cols-4 gap-2">
            {[
              { label: 'Calories', value: generatedRecipe.calories, unit: 'kcal' },
              { label: 'Protein', value: generatedRecipe.protein, unit: 'g' },
              { label: 'Fat', value: generatedRecipe.fat, unit: 'g' },
              { label: 'Carbs', value: generatedRecipe.carbs, unit: 'g' },
            ].map((s, i) => (
              <div key={s.label} className={`tile !p-3 ${i === 0 ? 'tile-calories' : 'tile-neutral'}`}>
                <dt className="text-xs font-semibold">{s.label}</dt>
                <dd className="font-display font-extrabold text-lg leading-7 whitespace-nowrap">
                  {s.value}<span className="font-sans text-xs font-semibold"> {s.unit}</span>
                </dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="generated-ingredients">
            <h3 id="generated-ingredients" className="heading-3 mb-2">Ingredients</h3>
            <ul className="space-y-1.5">
              {generatedRecipe.ingredients.map((ingredient, i) => (
                <li key={i} className="flex items-start gap-2.5 leading-snug">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {ingredient}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="generated-steps">
            <h3 id="generated-steps" className="heading-3 mb-2">Steps</h3>
            <ol className="space-y-3">
              {generatedRecipe.instructions?.map((instruction, i) => (
                <li key={i} className="flex items-start gap-3 leading-relaxed">
                  <span className="size-7 shrink-0 rounded-full bg-ink text-on-ink flex items-center justify-center font-display font-extrabold text-sm">{i + 1}</span>
                  <span className="pt-0.5">{instruction}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Create a recipe from ingredients"
      onClose={onClose}
      footer={
        <button
          onClick={handleGenerate}
          disabled={isGenerating || ingredientInput.trim().length === 0}
          className="btn-primary btn-block"
        >
          {isGenerating ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
          {isGenerating ? 'Creating your recipe…' : 'Create recipe'}
        </button>
      }
    >
      <div className="space-y-5 pt-1">
        <div>
          <label htmlFor="ingredients-at-hand" className="block text-sm font-semibold mb-1.5">What ingredients do you have?</label>
          <textarea
            id="ingredients-at-hand"
            value={ingredientInput}
            onChange={(e) => setIngredientInput(e.target.value)}
            placeholder="Chicken breast, spinach, eggs, tomatoes, olive oil"
            className="input w-full resize-none leading-snug"
            rows={4}
          />
          <p className="text-xs text-muted mt-1.5">Separate them with commas.</p>
        </div>

        <div>
          <label htmlFor="ingredients-calories" className="block text-sm font-semibold mb-1.5">Calories to aim for</label>
          <span className="relative block">
            <input
              id="ingredients-calories"
              type="number"
              value={targetCalories}
              onChange={(e) => setTargetCalories(parseInt(e.target.value) || 0)}
              className="input w-full !pr-12"
              min={100}
              max={800}
              step={50}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">kcal</span>
          </span>
          <p className="text-xs text-muted mt-1.5">Most meals are 200 to 500 kcal.</p>
        </div>

        <fieldset>
          <legend className="block text-sm font-semibold mb-1.5">Meal</legend>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setMealType(value)} aria-pressed={mealType === value} className="chip">
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-error" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
};
