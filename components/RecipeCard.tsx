import React from 'react';
import { Meal } from '../types';
import { RecipeIllustration } from './RecipeIllustration';

interface RecipeCardProps {
  meal: Meal;
  onClick?: () => void; // Trigger modal view
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void; // Secondary action (e.g. Log, Plan)
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ meal, onClick, actionLabel, onAction }) => {
  return (
    <div 
        onClick={onClick}
        className={`bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 transition-all duration-300 flex flex-col h-full group ${onClick ? 'cursor-pointer hover:shadow-md hover:border-emerald-200' : ''}`}
    >
      <div className="relative h-48 bg-slate-50 overflow-hidden">
        <RecipeIllustration 
            name={meal.name} 
            ingredients={meal.ingredients} 
            type={meal.type}
            className="w-full h-full transition-transform duration-700 group-hover:scale-105" 
        />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-700 border border-slate-200/50 shadow-sm">
          {meal.type}
        </div>
      </div>
      
      <div className="p-5 flex flex-col flex-1">
        <div className="mb-4">
          <div className="flex justify-between items-start gap-2">
             <h3 className="text-lg font-medium text-slate-900 leading-tight mb-1 font-serif group-hover:text-emerald-700 transition-colors line-clamp-2">{meal.name}</h3>
             <span className="flex-shrink-0 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">{meal.calories} kcal</span>
          </div>
          <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed mt-1">{meal.description || 'A healthy, delicious meal option.'}</p>
        </div>
        
        <div className="flex gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-5">
          <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">P: {meal.protein || '-'}g</span>
          <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">F: {meal.fat || '-'}g</span>
          <span className="bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">C: {meal.carbs || '-'}g</span>
        </div>

        <div className="mt-auto">
            {onAction ? (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onAction(e);
                    }}
                    className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-emerald-600 rounded-xl transition-colors shadow-sm"
                >
                   {actionLabel || 'Select'}
                </button>
            ) : (
                <div className="text-center text-xs font-medium text-slate-400 group-hover:text-emerald-600 transition-colors">
                    View Recipe
                </div>
            )}
        </div>
      </div>
    </div>
  );
};