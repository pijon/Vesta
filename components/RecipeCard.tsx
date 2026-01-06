import React, { useState } from 'react';
import { Meal } from '../types';
import { PLACEHOLDER_IMAGE } from '../constants';

interface RecipeCardProps {
  meal: Meal;
  onAdd: (meal: Meal) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ meal, onAdd }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 transition-all hover:shadow-md">
      <div className="relative h-48 bg-slate-200">
        <img 
          src={`${PLACEHOLDER_IMAGE}?random=${meal.id}`} 
          alt={meal.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-slate-700 shadow-sm">
          {meal.type}
        </div>
        <div className="absolute top-3 right-3 bg-slate-800/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm">
          Serves {meal.servings || 1}
        </div>
        <div className="absolute bottom-3 right-3 bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
          {meal.calories} kcal
        </div>
      </div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-slate-800 leading-tight">{meal.name}</h3>
        </div>
        <p className="text-slate-500 text-sm mb-4 line-clamp-2">{meal.description}</p>
        
        <div className="flex gap-4 text-xs font-medium text-slate-400 mb-4">
          <span>PRO: {meal.protein}g</span>
          <span>FAT: {meal.fat}g</span>
          <span>CARB: {meal.carbs}g</span>
        </div>

        {expanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-sm space-y-4 animate-fade-in">
                <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Ingredients</h4>
                    <ul className="list-disc pl-4 space-y-1 text-slate-600">
                        {meal.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Instructions</h4>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                        {meal.instructions?.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                </div>
            </div>
        )}

        <div className="flex gap-2 mt-2">
            <button 
                onClick={() => setExpanded(!expanded)}
                className="flex-1 py-2 text-sm font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
                {expanded ? 'Hide Recipe' : 'View Recipe'}
            </button>
            <button 
                onClick={() => onAdd(meal)}
                className="flex-1 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
               <span>Log Meal</span>
            </button>
        </div>
      </div>
    </div>
  );
};