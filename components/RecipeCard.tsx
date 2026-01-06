import React, { useState } from 'react';
import { Meal } from '../types';
import { RecipeIllustration } from './RecipeIllustration';

interface RecipeCardProps {
  meal: Meal;
  onAdd: (meal: Meal) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ meal, onAdd }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 transition-all hover:shadow-md flex flex-col h-full group">
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
        <div className="mb-3">
          <div className="flex justify-between items-start">
             <h3 className="text-lg font-medium text-slate-900 leading-tight mb-1 font-serif group-hover:text-emerald-700 transition-colors">{meal.name}</h3>
             <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{meal.calories} kcal</span>
          </div>
          <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed mt-1">{meal.description}</p>
        </div>
        
        <div className="flex gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-5">
          <span className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">P: {meal.protein || '-'}g</span>
          <span className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">F: {meal.fat || '-'}g</span>
          <span className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">C: {meal.carbs || '-'}g</span>
        </div>

        {expanded && (
            <div className="mt-2 mb-6 pt-4 border-t border-slate-100 text-sm space-y-4 animate-fade-in">
                <div>
                    <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2 text-xs uppercase tracking-wide">
                        Ingredients
                    </h4>
                    <ul className="pl-4 space-y-1 text-slate-600 text-xs">
                        {meal.ingredients.map((ing, i) => <li key={i} className="list-disc pl-1">{ing}</li>)}
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2 text-xs uppercase tracking-wide">
                         Instructions
                    </h4>
                    <ol className="list-decimal pl-4 space-y-2 text-slate-600 text-xs">
                        {meal.instructions?.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                </div>
            </div>
        )}

        <div className="mt-auto flex gap-2">
            <button 
                onClick={() => setExpanded(!expanded)}
                className="flex-1 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
                {expanded ? 'Hide' : 'Details'}
            </button>
            <button 
                onClick={() => onAdd(meal)}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-emerald-600 rounded-xl transition-colors shadow-sm"
            >
               Log Meal
            </button>
        </div>
      </div>
    </div>
  );
};