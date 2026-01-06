import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DayPlan, UserStats, Recipe } from '../types';
import { DAILY_CALORIE_LIMIT } from '../constants';
import { saveDayPlan, getWeeklyPlan } from '../services/storageService';

interface DashboardProps {
  todayPlan: DayPlan;
  stats: UserStats;
  onWeightUpdate: (w: number) => void;
  refreshData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ todayPlan, stats, onWeightUpdate, refreshData }) => {
  const [weightInput, setWeightInput] = useState(stats.currentWeight.toString());

  const toggleMeal = (mealIndex: number) => {
    const meal = todayPlan.meals[mealIndex];
    if (!meal) return;

    let newCompleted = [...todayPlan.completedMealIds];
    // We use index as ID proxy for simplicity in this specific daily view since meals might be duplicates
    // But ideally we use unique IDs. Let's assume we toggle based on the meal object's specific ID instance.
    const uniqueId = meal.id; 
    
    // Since our recipe IDs are static from library, we need a way to distinguish multiple same recipes on one day.
    // For this prototype, let's rely on the assumption that in `Planner.tsx` we didn't assign unique instance IDs,
    // so we will track completion by index if possible, OR we update Planner to clone recipes.
    // **Correction**: Planner stores Recipe objects directly. Let's just use the index for toggling in the UI for now.
    
    // Actually, let's update the Logic: We will store "indices of completed meals" in the DayPlan to be safe.
    // But `completedMealIds` in types is string[]. Let's just assume for now we don't have duplicate meals per day.
    
    if (newCompleted.includes(uniqueId)) {
        newCompleted = newCompleted.filter(id => id !== uniqueId);
    } else {
        newCompleted.push(uniqueId);
    }
    
    const updatedPlan = { ...todayPlan, completedMealIds: newCompleted };
    saveDayPlan(updatedPlan);
    refreshData();
  };

  // Calculate stats based on PLAN, not just consumed
  const totalPlanned = todayPlan.meals.reduce((sum, m) => sum + m.calories, 0);
  const consumed = todayPlan.meals
    .filter(m => todayPlan.completedMealIds.includes(m.id))
    .reduce((sum, m) => sum + m.calories, 0);
  
  const percentage = Math.min(100, (consumed / DAILY_CALORIE_LIMIT) * 100);

  const handleSaveWeight = () => {
      const w = parseFloat(weightInput);
      if (w > 0) onWeightUpdate(w);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <header className="mb-2">
        <h2 className="text-2xl font-bold text-slate-800">Today's Overview</h2>
        <p className="text-slate-500 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </header>

      {/* Progress Cards */}
      <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
             <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Eaten / Plan</p>
             <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${consumed > DAILY_CALORIE_LIMIT ? 'text-red-500' : 'text-emerald-600'}`}>{consumed}</span>
                <span className="text-slate-400 font-medium">/ {totalPlanned}</span>
             </div>
             <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{width: `${percentage}%`}}></div>
             </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Weight (kg)</p>
              <div className="flex gap-2 items-center mt-1">
                 <input 
                    type="number" 
                    className="w-full text-2xl font-bold text-slate-800 bg-transparent outline-none border-b border-dashed border-slate-300 focus:border-emerald-500 p-0"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                 />
                 <button onClick={handleSaveWeight} className="bg-slate-800 text-white rounded-lg p-2 hover:bg-slate-900">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                 </button>
              </div>
          </div>
      </div>

      {/* Today's Plan Checklist */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
            <h3 className="font-bold text-slate-700">Today's Meals</h3>
        </div>
        <div className="divide-y divide-slate-100">
            {todayPlan.meals.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                    <p>Nothing planned for today.</p>
                    <button onClick={() => {}} className="text-emerald-600 font-medium mt-2">Go to Planner</button>
                </div>
            ) : (
                todayPlan.meals.map((meal, index) => {
                    const isCompleted = todayPlan.completedMealIds.includes(meal.id);
                    return (
                        <div key={index} className={`p-4 flex items-center justify-between transition-colors ${isCompleted ? 'bg-slate-50/50' : 'hover:bg-slate-50'}`}>
                             <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => toggleMeal(index)}
                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-emerald-400'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </button>
                                <div className={isCompleted ? 'opacity-50 line-through' : ''}>
                                    <p className="font-medium text-slate-800">{meal.name}</p>
                                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">{meal.type} • {meal.calories} kcal</p>
                                </div>
                             </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>
    </div>
  );
};
