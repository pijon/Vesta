import React, { useState, useEffect, useMemo } from 'react';
import { getWeeklyPlan, getShoppingState, saveShoppingState } from '../services/storageService';
import { ShoppingState } from '../types';

interface ShoppingItem {
  name: string;
  recipes: string[];
}

export const ShoppingList: React.FC = () => {
  const [allItems, setAllItems] = useState<ShoppingItem[]>([]);
  const [state, setState] = useState<ShoppingState>({ checked: [], removed: [] });
  const [viewMode, setViewMode] = useState<'unified' | 'recipe'>('unified');

  useEffect(() => {
    setState(getShoppingState());
    const plan = getWeeklyPlan();
    
    const itemMap = new Map<string, Set<string>>();

    Object.values(plan).forEach(day => {
        if (new Date(day.date) >= new Date(new Date().setHours(0,0,0,0))) {
            day.meals.forEach(meal => {
                meal.ingredients.forEach(ing => {
                    const cleanIng = ing.trim();
                    if (!itemMap.has(cleanIng)) {
                        itemMap.set(cleanIng, new Set());
                    }
                    itemMap.get(cleanIng)?.add(meal.name);
                });
            });
        }
    });

    const items: ShoppingItem[] = Array.from(itemMap.entries()).map(([name, recipeSet]) => ({
        name,
        recipes: Array.from(recipeSet).sort()
    })).sort((a, b) => a.name.localeCompare(b.name));

    setAllItems(items);
  }, []);

  const toggleItem = (itemName: string) => {
    const isChecked = state.checked.includes(itemName);
    let newChecked;
    
    if (isChecked) {
        newChecked = state.checked.filter(i => i !== itemName);
    } else {
        newChecked = [...state.checked, itemName];
    }
    
    const newState = { ...state, checked: newChecked };
    setState(newState);
    saveShoppingState(newState);
  };

  const removeItem = (itemName: string) => {
    const newState = {
        checked: state.checked.filter(i => i !== itemName),
        removed: [...state.removed, itemName]
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

  // Derived data for Recipe View
  const recipesData = useMemo(() => {
    const map: Record<string, ShoppingItem[]> = {};
    const visible = allItems.filter(i => !state.removed.includes(i.name));
    
    visible.forEach(item => {
        item.recipes.forEach(recipeName => {
            if (!map[recipeName]) {
                map[recipeName] = [];
            }
            map[recipeName].push(item);
        });
    });
    
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allItems, state.removed]);

  const visibleItems = allItems.filter(i => !state.removed.includes(i.name));
  const toBuy = visibleItems.filter(i => !state.checked.includes(i.name));
  const purchased = visibleItems.filter(i => state.checked.includes(i.name));

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h2 className="text-4xl font-normal text-[#1F2823] tracking-tight font-serif">Grocery List</h2>
                <p className="text-[#1F2823]/70 font-medium mt-1">Ingredients for your planned upcoming meals.</p>
            </div>
            {allItems.length > 0 && (
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex bg-[#1F2823]/5 p-1 rounded-xl">
                        <button 
                            onClick={() => setViewMode('unified')} 
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'unified' ? 'bg-[#1F2823] text-white shadow-sm' : 'text-[#1F2823]/60 hover:text-[#1F2823]'}`}
                        >
                            Unified
                        </button>
                        <button 
                            onClick={() => setViewMode('recipe')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'recipe' ? 'bg-[#1F2823] text-white shadow-sm' : 'text-[#1F2823]/60 hover:text-[#1F2823]'}`}
                        >
                            By Recipe
                        </button>
                    </div>
                    <button onClick={resetList} className="text-xs font-semibold text-[#1F2823] bg-white border border-[#1F2823]/10 px-3 py-2 rounded-xl hover:bg-[#1F2823] hover:text-white transition-colors">
                        Reset List
                    </button>
                </div>
            )}
        </header>

        {allItems.length === 0 ? (
             <div className="p-10 text-center text-[#1F2823]/40 bg-white rounded-2xl border border-dashed border-[#1F2823]/10">
                <p>No meals planned.</p>
                <p className="text-sm">Go to the Planner to add meals and generate your list.</p>
            </div>
        ) : (
            <>
                {viewMode === 'unified' ? (
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
                                            <div className="flex items-center flex-1 cursor-pointer min-w-0" onClick={() => toggleItem(item.name)}>
                                                <div className="w-5 h-5 rounded border border-[#52525B] mr-4 flex-shrink-0 flex items-center justify-center text-white transition-colors group-hover:border-[#A3E635]">
                                                    {/* Unchecked state */}
                                                </div>
                                                <div className="flex flex-col min-w-0 pr-4">
                                                    <span className="text-white font-medium break-words">{item.name}</span>
                                                    <span className="text-[#52525B] text-xs mt-0.5 truncate group-hover:text-[#A3E635]/70 transition-colors">
                                                        {item.recipes.join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeItem(item.name)}
                                                className="text-[#52525B] hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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
                                            <div className="flex items-center flex-1 cursor-pointer min-w-0" onClick={() => toggleItem(item.name)}>
                                                <div className="w-5 h-5 rounded bg-[#1F2823] border border-[#1F2823] mr-4 flex-shrink-0 flex items-center justify-center text-[#A3E635]">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </div>
                                                <div className="flex flex-col min-w-0 pr-4">
                                                    <span className="text-[#1F2823]/50 line-through decoration-[#1F2823]/20 break-words">{item.name}</span>
                                                    <span className="text-[#1F2823]/30 text-xs mt-0.5 truncate">
                                                        {item.recipes.join(', ')}
                                                    </span>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => removeItem(item.name)}
                                                className="text-[#1F2823]/20 hover:text-red-400 p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {recipesData.map(([recipeName, items]) => {
                             const sortedItems = [...items].sort((a, b) => {
                                const aChecked = state.checked.includes(a.name);
                                const bChecked = state.checked.includes(b.name);
                                if (aChecked === bChecked) return a.name.localeCompare(b.name);
                                return aChecked ? 1 : -1;
                            });
                            
                            const allChecked = items.length > 0 && items.every(i => state.checked.includes(i.name));

                            return (
                                <div key={recipeName} className={`rounded-3xl border overflow-hidden transition-all ${allChecked ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm hover:border-[#1F2823]/20'}`}>
                                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                                        <h3 className={`font-serif font-medium truncate pr-4 text-lg ${allChecked ? 'text-slate-500 line-through' : 'text-[#1F2823]'}`} title={recipeName}>{recipeName}</h3>
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border ${allChecked ? 'text-slate-400 border-transparent' : 'text-emerald-700 bg-emerald-50 border-emerald-100'}`}>
                                            {items.filter(i => !state.checked.includes(i.name)).length} left
                                        </span>
                                    </div>
                                    <ul className="divide-y divide-slate-100">
                                        {sortedItems.map(item => {
                                            const isChecked = state.checked.includes(item.name);
                                            return (
                                                <li key={`${recipeName}-${item.name}`} onClick={() => toggleItem(item.name)} className="p-3 flex items-start gap-3 hover:bg-slate-50 cursor-pointer group">
                                                    <div className={`mt-0.5 w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-[#1F2823] border-[#1F2823] text-white' : 'border-slate-300 group-hover:border-[#1F2823]'}`}>
                                                        {isChecked && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                    </div>
                                                    <span className={`text-sm font-medium ${isChecked ? 'text-slate-400 line-through' : 'text-[#1F2823]'}`}>{item.name}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        )}
    </div>
  );
};