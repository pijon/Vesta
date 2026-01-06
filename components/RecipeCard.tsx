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
    <div className="bg-[#1F2823] rounded-3xl overflow-hidden shadow-lg border border-[#2A362F] transition-all hover:border-[#3E4C43] flex flex-col h-full group">
      <div className="relative h-48 bg-[#151C18]">
        <img 
          src={`${PLACEHOLDER_IMAGE}?random=${meal.id}`} 
          alt={meal.name}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1F2823] to-transparent"></div>
        <div className="absolute top-4 left-4 bg-[#1F2823]/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">
          {meal.type}
        </div>
        <div className="absolute bottom-4 left-4 text-white">
            <p className="font-serif text-3xl leading-none">{meal.calories} <span className="text-sm font-sans font-medium text-[#9CA3AF]">kcal</span></p>
        </div>
      </div>
      
      <div className="p-6 flex flex-col flex-1">
        <div className="mb-4">
          <h3 className="text-xl font-normal text-white leading-tight mb-2 font-serif">{meal.name}</h3>
          <p className="text-[#9CA3AF] text-sm line-clamp-2 leading-relaxed">{meal.description}</p>
        </div>
        
        <div className="flex gap-4 text-xs font-bold text-[#52525B] uppercase tracking-wide mb-6">
          <span className="bg-[#2A362F] px-2 py-1 rounded text-[#9CA3AF]">P: {meal.protein || '-'}g</span>
          <span className="bg-[#2A362F] px-2 py-1 rounded text-[#9CA3AF]">F: {meal.fat || '-'}g</span>
          <span className="bg-[#2A362F] px-2 py-1 rounded text-[#9CA3AF]">C: {meal.carbs || '-'}g</span>
        </div>

        {expanded && (
            <div className="mt-2 mb-6 pt-4 border-t border-[#2A362F] text-sm space-y-5 animate-fade-in">
                <div>
                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635]"></span> Ingredients
                    </h4>
                    <ul className="pl-4 space-y-1.5 text-[#9CA3AF]">
                        {meal.ingredients.map((ing, i) => <li key={i} className="leading-relaxed relative before:content-['•'] before:absolute before:-left-3 before:text-[#52525B]">{ing}</li>)}
                    </ul>
                </div>
                <div>
                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-white"></span> Instructions
                    </h4>
                    <ol className="list-decimal pl-4 space-y-2 text-[#9CA3AF] marker:text-[#52525B] marker:font-medium">
                        {meal.instructions?.map((step, i) => <li key={i} className="leading-relaxed">{step}</li>)}
                    </ol>
                </div>
            </div>
        )}

        <div className="mt-auto flex gap-3">
            <button 
                onClick={() => setExpanded(!expanded)}
                className="flex-1 py-3 text-sm font-semibold text-[#9CA3AF] hover:text-white bg-[#2A362F] hover:bg-[#323E37] rounded-xl transition-colors"
            >
                {expanded ? 'Hide' : 'Details'}
            </button>
            <button 
                onClick={() => onAdd(meal)}
                className="flex-1 py-3 text-sm font-bold text-[#1F2823] bg-[#A3E635] hover:bg-[#bef264] rounded-xl transition-colors flex items-center justify-center gap-2"
            >
               <span>Log Meal</span>
            </button>
        </div>
      </div>
    </div>
  );
};