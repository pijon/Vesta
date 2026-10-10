import React, { useState } from 'react';
import { ChevronDown, Check, ShoppingBasket } from 'lucide-react';
import { AggregatedIngredient } from '../types';

interface IngredientReviewCardProps {
  ingredient: AggregatedIngredient;
  inPantry: boolean;
  onTogglePantry: (ingredientName: string, inPantry: boolean) => void;
}

/** One ingredient in the pantry check: tap the pill to flip between "Buy" and "Have it". */
export const IngredientReviewCard: React.FC<IngredientReviewCardProps> = ({
  ingredient,
  inPantry,
  onTogglePantry
}) => {
  const [showRecipes, setShowRecipes] = useState(false);
  const usedIn = ingredient.recipes.length;

  return (
    <li className="rounded-[14px] hover:bg-surface-sunken transition-colors">
      <div className="flex items-center gap-3 px-2 py-2.5">
        <div className={`flex-1 min-w-0 ${inPantry ? 'text-muted' : ''}`}>
          <p className="font-semibold first-letter:uppercase leading-snug">{ingredient.name}</p>
          <p className="text-xs text-muted mt-0.5">
            {ingredient.totalQuantity} {ingredient.unit}
            {usedIn > 1 ? (
              <>
                {' · '}
                <button
                  onClick={() => setShowRecipes(!showRecipes)}
                  aria-expanded={showRecipes}
                  className="inline-flex items-center gap-0.5 font-semibold hover:text-main rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  {usedIn} recipes
                  <ChevronDown size={12} className={`transition-transform ${showRecipes ? 'rotate-180' : ''}`} />
                </button>
              </>
            ) : usedIn === 1 ? ` · ${ingredient.recipes[0].name}` : null}
          </p>
        </div>

        <button
          onClick={() => onTogglePantry(ingredient.name, !inPantry)}
          aria-pressed={inPantry}
          aria-label={inPantry ? `${ingredient.name}: have it at home. Tap to buy instead` : `${ingredient.name}: need to buy. Tap if you have it`}
          className={`shrink-0 min-h-9 px-3.5 inline-flex items-center gap-1.5 rounded-full text-sm font-semibold transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${inPantry
            ? 'bg-weight-bg text-weight-text'
            : 'bg-calories-bg text-calories-text'}`}
        >
          {inPantry ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : <ShoppingBasket size={14} aria-hidden="true" />}
          {inPantry ? 'Have it' : 'Buy'}
        </button>
      </div>

      {showRecipes && (
        <ul className="pb-2.5 px-2 space-y-0.5">
          {ingredient.recipes.map((recipe) => (
            <li key={recipe.id} className="text-xs text-muted pl-3 border-l-2 border-border">
              {recipe.name}: {recipe.quantity} {ingredient.unit}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};
