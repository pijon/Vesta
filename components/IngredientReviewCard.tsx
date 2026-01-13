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
      className={`border rounded-2xl p-4 transition-all ${inPantry
          ? 'bg-primary/5 border-primary/20'
          : 'bg-surface border-border'
        }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-main capitalize">
            {ingredient.name}
          </h3>
          <p className="text-sm text-muted">
            {ingredient.totalQuantity} {ingredient.unit}
          </p>
        </div>

        <button
          onClick={() => onTogglePantry(ingredient.name, !inPantry)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${inPantry
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-surface-highlight text-muted hover:text-main hover:bg-surface-highlight/80'
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
                  className="text-xs text-muted pl-3 border-l-2 border-primary/20"
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
