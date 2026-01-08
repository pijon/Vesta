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
      className={`border rounded-2xl p-4 transition-all ${
        inPantry
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-white border-slate-200'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-slate-900 capitalize">
            {ingredient.name}
          </h3>
          <p className="text-sm text-slate-600">
            {ingredient.totalQuantity} {ingredient.unit}
          </p>
        </div>

        <button
          onClick={() => onTogglePantry(ingredient.name, !inPantry)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
            inPantry
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {inPantry ? '✓ Have This' : 'Need to Buy'}
        </button>
      </div>

      {ingredient.recipes.length > 1 && (
        <div className="mt-2">
          <button
            onClick={() => setShowRecipes(!showRecipes)}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
          >
            {showRecipes ? '▼' : '▶'} Used in {ingredient.recipes.length} recipes
          </button>

          {showRecipes && (
            <div className="mt-2 space-y-1">
              {ingredient.recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="text-xs text-slate-600 pl-3 border-l-2 border-emerald-200"
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
