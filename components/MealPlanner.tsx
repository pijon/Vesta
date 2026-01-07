import React, { useState } from 'react';
import { generateMealPlan } from '../services/geminiService';
import { DayPlan, Meal } from '../types';
import { RecipeCard } from './RecipeCard';

interface MealPlannerProps {
  onAddMeal: (meal: Meal) => void;
}

export const MealPlanner: React.FC<MealPlannerProps> = ({ onAddMeal }) => {
  const [preferences, setPreferences] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newPlan = await generateMealPlan(preferences);
      setPlan(newPlan);
    } catch (err) {
      setError("Failed to generate plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">AI Meal Planner</h2>
        <p className="text-slate-500">Generate an 800-calorie compliant meal plan tailored to your taste.</p>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">Dietary Preferences / Restrictions</label>
        <textarea 
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
          rows={3}
          placeholder="e.g. Vegetarian, no mushrooms, love spicy food, intermittent fasting 16:8..."
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={isLoading}
          className={`mt-4 w-full py-3 rounded-xl font-semibold text-white transition-all transform active:scale-95 ${
            isLoading ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Thinking...
            </span>
          ) : 'Generate 800kcal Plan'}
        </button>
        {error && <p className="mt-3 text-red-500 text-sm text-center">{error}</p>}
      </div>

      {plan && (
        <div className="animate-fade-in space-y-6">
           <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
             <div className="flex items-start gap-3">
                <div className="bg-white p-2 rounded-full shadow-sm text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5c0-2.21-.79-4.3-2.23-5.91A10 10 0 0 0 12 2z"/></svg>
                </div>
                <div>
                    <h4 className="font-semibold text-emerald-900 text-sm mb-1">Dr. Mosley's Principles</h4>
                    <p className="text-emerald-800 text-sm leading-relaxed">{plan.tips}</p>
                    <p className="mt-2 text-xs font-bold text-emerald-600 uppercase">Total: {plan.totalCalories} kcal</p>
                </div>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plan.meals.map((meal) => (
                <RecipeCard 
                    key={meal.id} 
                    meal={meal} 
                    actionLabel="Log Meal"
                    onAction={() => onAddMeal(meal)} 
                />
              ))}
           </div>
        </div>
      )}
    </div>
  );
};