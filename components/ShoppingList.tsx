import React, { useState, useEffect } from 'react';
import { getWeeklyPlan } from '../services/storageService';

export const ShoppingList: React.FC = () => {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const plan = getWeeklyPlan();
    // Get meals from today onwards for the next 7 days ideally, but let's grab all future plan keys
    // For simplicity, we just aggregate everything in the Plan that matches this week.
    
    // Flatten all ingredients
    const allIngredients: string[] = [];
    Object.values(plan).forEach(day => {
        // Only include if date is today or future? Let's just include all for now to be simple
        if (new Date(day.date) >= new Date(new Date().setHours(0,0,0,0))) {
            day.meals.forEach(meal => {
                allIngredients.push(...meal.ingredients);
            });
        }
    });

    // Simple deduping (could be smarter with AI but manual is fine for v1)
    const unique = Array.from(new Set(allIngredients)).sort();
    setItems(unique);
  }, []);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
        <header>
            <h2 className="text-2xl font-bold text-slate-800">Grocery List</h2>
            <p className="text-slate-500 text-sm">Ingredients for your planned upcoming meals.</p>
        </header>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {items.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                    <p>No meals planned. Go to Planner to populate your list.</p>
                </div>
            ) : (
                <ul className="divide-y divide-slate-100">
                    {items.map((item, i) => (
                        <li key={i} className="flex items-center p-4 hover:bg-slate-50">
                            <input type="checkbox" className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 mr-3 accent-emerald-600" />
                            <span className="text-slate-700">{item}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    </div>
  );
};
