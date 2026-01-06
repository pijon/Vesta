import React, { useState, useEffect } from 'react';
import { getWeeklyPlan, saveDayPlan, getRecipes, getDayPlan } from '../services/storageService';
import { Recipe, DayPlan } from '../types';
import { DAILY_CALORIE_LIMIT } from '../constants';

export const Planner: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    // Generate next 7 days
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    setWeekDates(dates);
    setAvailableRecipes(getRecipes());
  }, []);

  useEffect(() => {
    setDayPlan(getDayPlan(selectedDate));
  }, [selectedDate]);

  const addMeal = (recipe: Recipe) => {
    if (!dayPlan) return;
    const newMeals = [...dayPlan.meals, recipe];
    const updatedPlan = { ...dayPlan, meals: newMeals };
    saveDayPlan(updatedPlan);
    setDayPlan(updatedPlan);
    setShowAddModal(false);
  };

  const removeMeal = (index: number) => {
    if (!dayPlan) return;
    const newMeals = [...dayPlan.meals];
    newMeals.splice(index, 1);
    const updatedPlan = { ...dayPlan, meals: newMeals };
    saveDayPlan(updatedPlan);
    setDayPlan(updatedPlan);
  };

  const totalCalories = dayPlan?.meals.reduce((sum, m) => sum + m.calories, 0) || 0;
  const isOverLimit = totalCalories > DAILY_CALORIE_LIMIT;

  return (
    <div className="space-y-6 pb-20">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Weekly Planner</h2>
        <p className="text-slate-500 text-sm">Plan your meals to stay on track.</p>
      </header>

      {/* Date Scroller */}
      <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar">
        {weekDates.map(date => {
          const d = new Date(date);
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = d.getDate();
          const isSelected = date === selectedDate;
          
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl transition-all ${
                isSelected 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' 
                  : 'bg-white text-slate-600 border border-slate-100'
              }`}
            >
              <span className="text-xs font-medium uppercase">{dayName}</span>
              <span className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{dayNum}</span>
            </button>
          );
        })}
      </div>

      {/* Day View */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">
                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <div className={`text-sm font-bold px-3 py-1 rounded-full ${isOverLimit ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {totalCalories} / {DAILY_CALORIE_LIMIT} kcal
            </div>
        </div>

        <div className="p-4 space-y-3">
          {dayPlan?.meals.length === 0 ? (
             <div className="text-center py-10 text-slate-400">
                <p>No meals planned for this day.</p>
             </div>
          ) : (
            dayPlan?.meals.map((meal, idx) => (
               <div key={`${meal.id}-${idx}`} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs uppercase">
                        {meal.type[0]}
                      </div>
                      <div>
                          <p className="font-medium text-slate-800">{meal.name}</p>
                          <p className="text-xs text-slate-500">{meal.calories} kcal</p>
                      </div>
                  </div>
                  <button onClick={() => removeMeal(idx)} className="text-slate-300 hover:text-red-500 p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
               </div>
            ))
          )}

          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full py-3 mt-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium hover:border-emerald-500 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
             Add Meal to Plan
          </button>
        </div>
      </div>

      {/* Add Meal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-4">
           <div className="bg-white w-full max-w-md rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-lg">Select Recipe</h3>
                  <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">Close</button>
              </div>
              <div className="overflow-y-auto p-4 space-y-2">
                 {availableRecipes.length === 0 ? (
                     <p className="text-center text-slate-500 py-4">No recipes found. Add some in the Recipe tab!</p>
                 ) : (
                     availableRecipes.map(recipe => (
                         <button 
                            key={recipe.id} 
                            onClick={() => addMeal(recipe)}
                            className="w-full text-left p-3 hover:bg-emerald-50 rounded-xl transition-colors flex justify-between items-center group"
                         >
                            <div>
                                <p className="font-medium text-slate-800">{recipe.name}</p>
                                <p className="text-xs text-slate-500">{recipe.calories} kcal • {recipe.type}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-200 group-hover:text-emerald-800 flex items-center justify-center text-slate-400 transition-colors">
                                +
                            </div>
                         </button>
                     ))
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
