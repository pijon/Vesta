import React from 'react';
import { EatingOutDish } from '../types';
import { dishLabel } from '../utils/eatingOutHistory';

interface EatingOutDishListProps {
  dishes: EatingOutDish[];
  /** Calories to stay within, so each row can say how it compares (nothing to compare when unset) */
  budget?: number;
  /** The dish currently chosen, to mark its row */
  selectedId?: string;
  onPick: (dish: EatingOutDish) => void;
}

/** Dishes eaten out before, one tap to use. Calories are the user's own from last time. */
export const EatingOutDishList: React.FC<EatingOutDishListProps> = ({ dishes, budget, selectedId, onPick }) => (
  <ul>
    {dishes.map(d => {
      const left = budget === undefined ? undefined : budget - d.calories;
      return (
        <li key={d.id}>
          <button
            type="button"
            onClick={() => onPick(d)}
            aria-pressed={selectedId === d.id}
            className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] aria-pressed:bg-surface-sunken"
          >
            <span className="flex-1 min-w-0">
              <span className="font-semibold leading-snug">{d.dish || d.place}</span>
              <span className="block text-xs text-muted mt-0.5">
                {d.dish ? `${d.place || 'Eating out'} · ` : ''}{d.times > 1 ? `${d.times} times` : 'once'}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-display font-extrabold leading-5">{d.calories}</span>
              {left !== undefined ? (
                <span className={`block text-[11px] font-semibold leading-3 ${left < 0 ? 'text-warning' : 'text-muted'}`}>
                  {left < 0 ? `${-left} over` : `${left} left`}
                </span>
              ) : (
                <span className="block text-[11px] font-semibold text-muted leading-3">kcal</span>
              )}
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);
