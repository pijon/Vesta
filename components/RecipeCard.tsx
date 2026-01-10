import React from 'react';
import { Meal } from '../types';
import { getCategoryColor } from '../utils';
import { RecipeIllustration } from './RecipeIllustration';

interface RecipeCardProps {
  meal: Meal;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ meal, onClick, actionLabel, onAction }) => {
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
        <div className="absolute top-4 left-4 flex gap-2 flex-wrap max-w-[90%]">
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-md bg-surface/90 ${categoryColors.text}`}>
            {meal.type}
          </span>
          {meal.servings > 1 && (
            <span className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm">
              {meal.servings} Servings
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <div className="flex justify-between items-start gap-3 mb-2">
            <h3 className="text-xl font-bold text-slate-800 leading-tight font-serif group-hover:text-emerald-700 transition-colors line-clamp-2">
              {meal.name}
            </h3>
            <span className="flex-shrink-0 text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
              {meal.calories}
            </span>
          </div>
        </div>

        {/* Macros */}
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

        <div className="mt-auto pt-4 border-t border-slate-50">
          {onAction ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAction(e);
              }}
              className="w-full py-3 text-sm font-bold text-white bg-slate-900 hover:bg-emerald-600 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              {actionLabel || 'Select'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
              <span>View Recipe</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transform group-hover:translate-x-1 transition-transform"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};