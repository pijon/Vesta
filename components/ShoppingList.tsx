import React, { useState, useEffect } from 'react';
import { getWeeklyPlan, getShoppingState, saveShoppingState } from '../services/storageService';
import { ShoppingState } from '../types';

export const ShoppingList: React.FC = () => {
  const [allItems, setAllItems] = useState<string[]>([]);
  const [state, setState] = useState<ShoppingState>({ checked: [], removed: [] });

  useEffect(() => {
    setState(getShoppingState());
    const plan = getWeeklyPlan();
    
    const ingredients: string[] = [];
    Object.values(plan).forEach(day => {
        if (new Date(day.date) >= new Date(new Date().setHours(0,0,0,0))) {
            day.meals.forEach(meal => {
                ingredients.push(...meal.ingredients);
            });
        }
    });

    const unique = Array.from(new Set(ingredients)).sort();
    setAllItems(unique);
  }, []);

  const toggleItem = (item: string) => {
    const isChecked = state.checked.includes(item);
    let newChecked;
    
    if (isChecked) {
        newChecked = state.checked.filter(i => i !== item);
    } else {
        newChecked = [...state.checked, item];
    }
    
    const newState = { ...state, checked: newChecked };
    setState(newState);
    saveShoppingState(newState);
  };

  const removeItem = (item: string) => {
    const newState = {
        checked: state.checked.filter(i => i !== item),
        removed: [...state.removed, item]
    };
    setState(newState);
    saveShoppingState(newState);
  };

  const resetList = () => {
    if(confirm("This will uncheck all items and restore removed ones. Continue?")) {
        const newState = { checked: [], removed: [] };
        setState(newState);
        saveShoppingState(newState);
    }
  };

  const visibleItems = allItems.filter(i => !state.removed.includes(i));
  const toBuy = visibleItems.filter(i => !state.checked.includes(i));
  const purchased = visibleItems.filter(i => state.checked.includes(i));

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
        <header className="flex justify-between items-start">
            <div>
                <h2 className="text-4xl font-normal text-[#1F2823] tracking-tight font-serif">Grocery List</h2>
                <p className="text-[#1F2823]/70 font-medium mt-1">Ingredients for your planned upcoming meals.</p>
            </div>
            {allItems.length > 0 && (
                <button onClick={resetList} className="text-xs font-semibold text-[#1F2823] bg-white border border-[#1F2823]/10 px-3 py-1 rounded-full hover:bg-[#1F2823] hover:text-white transition-colors">
                    Reset List
                </button>
            )}
        </header>

        {allItems.length === 0 ? (
             <div className="p-10 text-center text-[#1F2823]/40 bg-white rounded-2xl border border-dashed border-[#1F2823]/10">
                <p>No meals planned.</p>
                <p className="text-sm">Go to the Planner to add meals and generate your list.</p>
            </div>
        ) : (
            <div className="space-y-6">
                {/* To Buy Section - Dark Card */}
                <div className="bg-[#1F2823] rounded-3xl shadow-xl shadow-[#1F2823]/10 border border-[#2A362F] overflow-hidden">
                    <div className="p-5 bg-[#1F2823] border-b border-[#2A362F] flex justify-between items-center">
                        <h3 className="font-normal text-white font-serif text-lg">To Buy ({toBuy.length})</h3>
                    </div>
                    {toBuy.length === 0 && purchased.length === 0 ? (
                        <div className="p-8 text-center text-[#9CA3AF]">
                             <p>List is empty.</p>
                        </div>
                    ) : toBuy.length === 0 && purchased.length > 0 ? (
                        <div className="p-8 text-center text-[#A3E635]">
                             <p>🎉 All done! You've bought everything.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-[#2A362F]">
                            {toBuy.map((item, i) => (
                                <li key={`buy-${i}`} className="flex items-center justify-between p-4 hover:bg-[#2A362F]/50 group transition-colors">
                                    <div className="flex items-center flex-1 cursor-pointer" onClick={() => toggleItem(item)}>
                                        <div className="w-5 h-5 rounded border border-[#52525B] mr-4 flex items-center justify-center text-white transition-colors group-hover:border-[#A3E635]">
                                            {/* Unchecked state */}
                                        </div>
                                        <span className="text-white font-medium">{item}</span>
                                    </div>
                                    <button 
                                        onClick={() => removeItem(item)}
                                        className="text-[#52525B] hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Remove from list"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Purchased Section */}
                {purchased.length > 0 && (
                    <div className="bg-[#1F2823]/5 rounded-3xl border border-[#1F2823]/5 overflow-hidden">
                         <div className="p-4 border-b border-[#1F2823]/5 flex justify-between items-center">
                            <h3 className="font-semibold text-[#1F2823]/40 text-sm uppercase tracking-wide">Purchased ({purchased.length})</h3>
                        </div>
                        <ul className="divide-y divide-[#1F2823]/5">
                            {purchased.map((item, i) => (
                                <li key={`done-${i}`} className="flex items-center justify-between p-4 hover:bg-[#1F2823]/5 group">
                                    <div className="flex items-center flex-1 cursor-pointer" onClick={() => toggleItem(item)}>
                                        <div className="w-5 h-5 rounded bg-[#1F2823] border border-[#1F2823] mr-4 flex items-center justify-center text-[#A3E635]">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <span className="text-[#1F2823]/50 line-through decoration-[#1F2823]/20">{item}</span>
                                    </div>
                                    <button 
                                        onClick={() => removeItem(item)}
                                        className="text-[#1F2823]/20 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                        title="Remove from list"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};