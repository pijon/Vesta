import React, { useState } from 'react';
import { AggregatedIngredient } from '../types';

interface IngredientReviewCardProps {
  ingredient: AggregatedIngredient;
  inPantry: boolean;
  onTogglePantry: (ingredientName: string, inPantry: boolean) => void;
}

export const IngredientReviewCard: React.FC<IngredientReviewCardProps> = ({
  ingredient,
  inPantry,
  onTogglePantry
}) => {
  const [showRecipes, setShowRecipes] = useState(false);

  return (
    <div
      className={`card p-4 transition-all ${inPantry
        ? 'ring-1 ring-primary/20 bg-primary/5'
        : 'hover:shadow-md'
        }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-charcoal dark:text-stone-200 capitalize">
            {ingredient.name}
          </h3>
          <p className="text-sm text-charcoal/60 dark:text-stone-400">
            {ingredient.totalQuantity} {ingredient.unit}
          </p>
        </div>

        <button
          onClick={() => onTogglePantry(ingredient.name, !inPantry)}
          className={`btn-sm transition-all ${inPantry
            ? 'btn-primary'
            : 'btn-secondary text-charcoal/60 dark:text-stone-400'
            }`}
        >
          {inPantry ? '✓ Have This' : 'Need to Buy'}
        </button>
      </div>

      {ingredient.recipes.length > 1 && (
        <div className="mt-2">
          <button
            onClick={() => setShowRecipes(!showRecipes)}
            className="text-xs text-primary hover:text-primary-dark font-medium"
          >
            {showRecipes ? '▼' : '▶'} Used in {ingredient.recipes.length} recipes
          </button>

          {showRecipes && (
            <div className="mt-2 space-y-1">
              {ingredient.recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="text-xs text-charcoal/60 dark:text-stone-400 pl-3 border-l-2 border-primary/20"
                >
                  {recipe.name}: {recipe.quantity} {ingredient.unit}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
