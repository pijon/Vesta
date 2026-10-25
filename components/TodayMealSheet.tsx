import React from 'react';
import { Shuffle, Trash2, UserX } from 'lucide-react';
import { Recipe } from '../types';
import { Sheet } from './Sheet';
import { mealKcalLabel, slotFor, slotLabel } from '../utils/planUtils';

interface TodayMealSheetProps {
  meal: Recipe;
  onSwap: () => void;
  /** The user isn't eating this family meal */
  onNotEating: () => void;
  onRemove: () => void;
  onClose: () => void;
}

/** What you can change about one of today's planned meals without going to the Planner. */
export const TodayMealSheet: React.FC<TodayMealSheetProps> = ({ meal, onSwap, onNotEating, onRemove, onClose }) => {
  const action = (icon: React.ReactNode, label: string, onClick: () => void, tone: 'default' | 'danger' = 'default') => (
    <li>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 min-h-12 px-3 rounded-[14px] text-left font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${tone === 'danger' ? 'text-error hover:bg-error-bg' : 'hover:bg-surface-sunken'}`}
      >
        <span className={`size-9 shrink-0 rounded-full flex items-center justify-center ${tone === 'danger' ? 'bg-error-bg' : 'bg-surface-sunken'}`} aria-hidden="true">{icon}</span>
        <span className="flex-1">{label}</span>
      </button>
    </li>
  );

  return (
    <Sheet title={meal.name} subtitle={<>Today · {slotLabel(slotFor(meal)).toLowerCase()} · {mealKcalLabel(meal)}</>} onClose={onClose}>
      <ul className="-mx-1">
        {action(<Shuffle size={18} />, 'Swap for another meal', onSwap)}
        {meal.familyMeal && action(<UserX size={18} />, 'I\'m not eating this', onNotEating)}
        {action(<Trash2 size={18} />, meal.familyMeal ? 'Remove for the whole family' : 'Remove from today', onRemove, 'danger')}
      </ul>
    </Sheet>
  );
};
