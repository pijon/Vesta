import React from 'react';
import { Meal } from '../types';
import { getCategoryColor } from '../utils';
import { RecipeIllustration } from './RecipeIllustration';

interface RecipeCardProps {
  meal: Meal;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  showMacros?: boolean;
  onToggleFavorite?: (e: React.MouseEvent) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ meal, onClick, actionLabel, onAction, showMacros = true, onToggleFavorite }) => {
  const categoryColors = getCategoryColor(meal.type);

  return (
    <div
      onClick={onClick}
      className={`glass-panel rounded-3xl overflow-hidden transition-all duration-300 flex flex-col h-full group ${onClick ? 'cursor-pointer hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1' : ''}`}
    >
      {/* Card Header / Illustration */}
      <div className={`relative h-48 overflow-hidden ${!meal.image ? categoryColors.bg : 'bg-slate-900'} transition-colors duration-300`}>
        {meal.image ? (
          <img
            src={meal.image}
            alt={meal.name}
            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <RecipeIllustration
            className="w-full h-full transform transition-transform duration-700 group-hover:scale-110"
            theme={{
              bg: categoryColors.bg,
              text: categoryColors.text,
              accent: categoryColors.bg === 'bg-slate-100' ? '#94a3b8' : undefined // Default accent backup
            }}
          />
        )}

        {/* Badges */}
        <div className="absolute top-4 left-4 flex gap-2 flex-wrap max-w-[70%]">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md bg-surface/90 ${categoryColors.text}`}>
            {meal.type}
          </span>
          {meal.servings > 1 && (
            <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm">
              {meal.servings} Servings
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleFavorite) onToggleFavorite(e);
          }}
          className={`absolute top-4 right-4 p-2 rounded-full shadow-md backdrop-blur-md transition-all duration-300 ${meal.isFavorite
            ? 'bg-white/90 text-red-500 hover:bg-white hover:scale-110'
            : 'bg-black/20 text-white hover:bg-white/90 hover:text-red-500 hover:scale-110'
            }`}
          title={meal.isFavorite ? "Remove from favourites" : "Add to favourites"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={meal.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <div className="flex justify-between items-start gap-3 mb-2">
            <h3 className="text-xl font-bold text-slate-800 leading-tight font-serif transition-colors line-clamp-2"
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = ''}
            >
              {meal.name}
            </h3>
            <span className="flex-shrink-0 text-sm font-bold bg-calories-bg px-2.5 py-1 rounded-lg border border-calories-border" style={{ color: 'var(--calories)' }}>
              {meal.calories}
            </span>
          </div>
        </div>

        {/* Macros */}
        {showMacros && (
          <div className="flex gap-2 mb-6">
            {[
              { label: 'P', value: meal.protein, color: 'bg-orange-50 text-orange-700 border-orange-100' },
              { label: 'F', value: meal.fat, color: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
              { label: 'C', value: meal.carbs, color: 'bg-blue-50 text-blue-700 border-blue-100' }
            ].map((macro, i) => (
              <div key={i} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl border ${macro.color}`}>
                <span className="text-[10px] uppercase font-bold opacity-60">{macro.label}</span>
                <span className="text-sm font-bold">{macro.value || '-'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-slate-50">
          {onAction ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(e);
              }}
              className="w-full py-3 text-sm font-bold text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
              style={{ backgroundColor: 'var(--neutral-900)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--neutral-900)'}
            >
              {actionLabel || 'Select'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-400 transition-colors"
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = ''}
            >
              <span>View Recipe</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-1 transition-transform"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};