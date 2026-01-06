import React, { useState, useEffect } from 'react';
import { getWeeklyPlan, saveDayPlan, getRecipes, getDayPlan } from '../services/storageService';
import { planWeekWithExistingRecipes } from '../services/geminiService';
import { Recipe, DayPlan } from '../types';
import { DAILY_CALORIE_LIMIT } from '../constants';
import { RecipeIllustration } from './RecipeIllustration';

export const Planner: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [weekDates, setWeekDates] = useState<string[]>([]);
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
  const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  // Modal UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack'>('all');

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

  const handleRecipeSelect = (recipe: Recipe) => {
    if (!dayPlan) return;
    
    let newMeals = [...dayPlan.meals];
    
    if (swapIndex !== null && swapIndex >= 0 && swapIndex < newMeals.length) {
        // Swap existing meal
        newMeals[swapIndex] = recipe;
    } else {
        // Add new meal
        newMeals.push(recipe);
    }
    
    // Recalculate total calories
    const totalCals = newMeals.reduce((acc, m) => acc + m.calories, 0);

    const updatedPlan = { ...dayPlan, meals: newMeals, totalCalories: totalCals };
    saveDayPlan(updatedPlan);
    setDayPlan(updatedPlan);
    
    closeModal();
  };

  const removeMeal = (index: number) => {
    if (!dayPlan) return;
    const newMeals = [...dayPlan.meals];
    newMeals.splice(index, 1);
    
    const totalCals = newMeals.reduce((acc, m) => acc + m.calories, 0);
    
    const updatedPlan = { ...dayPlan, meals: newMeals, totalCalories: totalCals };
    saveDayPlan(updatedPlan);
    setDayPlan(updatedPlan);
  };

  const openAddModal = () => {
      setSwapIndex(null);
      setSearchTerm('');
      setActiveFilter('all');
      setShowAddModal(true);
  };

  const openSwapModal = (index: number) => {
      setSwapIndex(index);
      setSearchTerm('');
      setActiveFilter('all');
      setShowAddModal(true);
  };

  const closeModal = () => {
      setShowAddModal(false);
      setSwapIndex(null);
  };

  const handleAutoPlan = async () => {
    const recipes = getRecipes();
    if (recipes.length < 3) {
        alert("You need at least a few recipes in your library for the AI to create a plan. Go to the Recipes tab to add some!");
        return;
    }

    if (!confirm(`Generate a 7-day plan starting from ${selectedDate}? This will overwrite plans for these days.`)) {
        return;
    }

    setIsGenerating(true);
    try {
        const weeklyPlan = await planWeekWithExistingRecipes(recipes, selectedDate);
        
        // Process and save
        weeklyPlan.forEach(day => {
            // Map IDs back to full recipe objects
            const meals = day.mealIds.map(id => recipes.find(r => r.id === id)).filter(r => r !== undefined) as Recipe[];
            
            const totalCals = meals.reduce((acc, m) => acc + m.calories, 0);
            
            const planForDay: DayPlan = {
                date: day.date,
                meals: meals,
                completedMealIds: [], // Reset completed status for new plan
                tips: day.dailyTip || "Stay on track!",
                totalCalories: totalCals
            };
            
            saveDayPlan(planForDay);
        });

        // Refresh current view
        setDayPlan(getDayPlan(selectedDate));

    } catch (error) {
        console.error(error);
        alert("Failed to generate plan. Please try again.");
    } finally {
        setIsGenerating(false);
    }
  };

  const totalCalories = dayPlan?.meals.reduce((sum, m) => sum + m.calories, 0) || 0;
  const isOverLimit = totalCalories > DAILY_CALORIE_LIMIT;

  const filteredRecipes = availableRecipes.filter(recipe => {
      const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = activeFilter === 'all' || recipe.type === activeFilter;
      return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-4xl font-normal text-[#1F2823] tracking-tight font-serif">Weekly Planner</h2>
            <p className="text-[#1F2823]/70 font-medium mt-1">Design your week.</p>
        </div>
        <button
            onClick={handleAutoPlan}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg ${isGenerating ? 'bg-[#1F2823]/50 text-white cursor-wait' : 'bg-[#1F2823] text-white hover:bg-[#1F2823]/90 hover:shadow-[#1F2823]/30'}`}
        >
            {isGenerating ? (
                <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Planning...
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.93 4.93 14.14 14.14"/><path d="m19.07 4.93-14.14 14.14"/></svg>
                    Auto-Plan
                </>
            )}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Date Scroller Column */}
          <div className="lg:col-span-12">
             <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar snap-x">
                {weekDates.map(date => {
                const d = new Date(date);
                const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = d.getDate();
                const isSelected = date === selectedDate;
                
                return (
                    <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 rounded-2xl transition-all snap-center border-2 ${
                        isSelected 
                        ? 'bg-[#1F2823] text-white border-[#1F2823] shadow-lg shadow-[#1F2823]/20' 
                        : 'bg-[#D4E0D1] text-[#1F2823] border-[#1F2823]/10 hover:border-[#1F2823]/30'
                    }`}
                    >
                    <span className={`text-xs font-bold uppercase tracking-wide ${isSelected ? 'text-[#9CA3AF]' : 'opacity-60'}`}>{dayName}</span>
                    <span className={`text-2xl font-serif mt-1 ${isSelected ? 'text-white' : 'text-[#1F2823]'}`}>{dayNum}</span>
                    </button>
                );
                })}
            </div>
          </div>

          {/* Main Day View - Dark Card */}
          <div className="lg:col-span-8">
            <div className="bg-[#1F2823] rounded-3xl border border-[#2A362F] shadow-xl shadow-[#1F2823]/10 overflow-hidden min-h-[500px] flex flex-col">
                <div className="p-6 border-b border-[#2A362F] flex justify-between items-center bg-[#1F2823] sticky top-0 z-10">
                    <div>
                         <h3 className="font-normal text-2xl text-white font-serif">
                            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}
                        </h3>
                        <p className="text-[#9CA3AF] text-sm font-medium">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                    </div>
                    
                    <div className={`text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-2 ${isOverLimit ? 'bg-red-400 text-[#1F2823]' : 'bg-[#A3E635] text-[#1F2823]'}`}>
                        {totalCalories} / {DAILY_CALORIE_LIMIT} kcal
                    </div>
                </div>

                <div className="p-6 space-y-4 flex-1">
                {dayPlan?.meals.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-[#52525B] py-20 border border-dashed border-[#2A362F] rounded-2xl">
                        <div className="w-16 h-16 bg-[#2A362F] rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#52525B]"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <p className="font-medium">No meals planned.</p>
                        <p className="text-sm">Add a meal or use Auto-Plan.</p>
                    </div>
                ) : (
                    dayPlan?.meals.map((meal, idx) => (
                    <div key={`${meal.id}-${idx}`} className="flex items-center justify-between p-4 bg-[#2A362F] border border-[#3E4C43] rounded-2xl hover:border-[#A3E635]/50 transition-all group overflow-hidden">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#151C18] flex-shrink-0">
                                <RecipeIllustration 
                                    name={meal.name} 
                                    ingredients={meal.ingredients} 
                                    type={meal.type} 
                                    className="w-full h-full"
                                />
                            </div>
                            <div>
                                <p className="font-normal text-white text-lg font-serif">{meal.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-[#1F2823] bg-[#9CA3AF] px-2 py-0.5 rounded uppercase tracking-wide opacity-80">{meal.type}</span>
                                    <span className="text-xs font-bold text-[#A3E635]">{meal.calories} kcal</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openSwapModal(idx)} className="p-2.5 rounded-xl bg-[#1F2823] text-[#9CA3AF] hover:text-white hover:bg-[#323E37] transition-all" title="Swap Recipe">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                            </button>
                            <button onClick={() => removeMeal(idx)} className="p-2.5 rounded-xl bg-[#1F2823] text-[#9CA3AF] hover:text-red-400 hover:bg-[#323E37] transition-all" title="Remove Meal">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>
                    ))
                )}

                <button 
                    onClick={openAddModal}
                    className="w-full py-4 mt-4 border border-dashed border-[#52525B] rounded-2xl text-[#9CA3AF] font-semibold hover:border-[#A3E635] hover:text-[#A3E635] hover:bg-[#A3E635]/5 transition-all flex items-center justify-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Add Meal
                </button>
                </div>
            </div>
          </div>

          {/* Daily Info Column */}
          <div className="lg:col-span-4 space-y-6">
             {/* Nutrition Summary (Simulated for now) */}
             <div className="bg-[#1F2823] p-6 rounded-3xl border border-[#2A362F] shadow-xl shadow-[#1F2823]/10">
                 <h4 className="font-normal text-white mb-4 font-serif text-xl">Daily Targets</h4>
                 <div className="space-y-4">
                     <div>
                         <div className="flex justify-between text-sm mb-2">
                             <span className="font-medium text-[#9CA3AF]">Calories</span>
                             <span className="font-bold text-white">{totalCalories} / {DAILY_CALORIE_LIMIT}</span>
                         </div>
                         <div className="h-1 bg-[#2A362F] rounded-full overflow-hidden">
                             <div className="h-full bg-[#A3E635] rounded-full" style={{width: `${Math.min(100, (totalCalories/DAILY_CALORIE_LIMIT)*100)}%`}}></div>
                         </div>
                     </div>
                 </div>
             </div>
             
             {/* Tip Card - Use Inverse Colors for contrast */}
             <div className="bg-[#2A362F] p-6 rounded-3xl border border-[#3E4C43] shadow-lg">
                 <div className="flex items-center gap-2 mb-3">
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A3E635]"><path d="M2 12h20"></path><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path><path d="m4 8 16-4"></path><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.55a2 2 0 0 1 2.43 1.45l.45 1.81"></path></svg>
                     <span className="font-bold uppercase tracking-wide text-xs text-[#A3E635]">Daily Insight</span>
                 </div>
                 <p className="text-sm font-medium leading-relaxed text-[#D4E0D1]">
                     {dayPlan?.tips || "Consistency is key. Focus on nutrient-dense foods to stay full longer."}
                 </p>
             </div>
          </div>
      </div>

      {/* Improved Add/Swap Meal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2823]/60 backdrop-blur-md p-4 animate-fade-in">
           <div className="bg-[#D4E0D1] w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] border border-[#1F2823]/10">
              {/* Header */}
              <div className="p-6 border-b border-[#1F2823]/10 flex justify-between items-center bg-[#D4E0D1] rounded-t-3xl">
                 <div>
                    <h3 className="font-normal text-3xl text-[#1F2823] font-serif">{swapIndex !== null ? 'Swap Meal' : 'Add Meal'}</h3>
                    <p className="text-sm text-[#1F2823]/60 font-medium mt-1">Select a recipe from your library</p>
                 </div>
                 <button onClick={closeModal} className="p-2.5 bg-[#1F2823]/5 hover:bg-[#1F2823]/10 rounded-full transition-colors text-[#1F2823]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
              </div>

              {/* Search & Filter */}
              <div className="p-6 space-y-4 border-b border-[#1F2823]/10 bg-[#D4E0D1]">
                  <div className="relative">
                      <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-3.5 h-5 w-5 text-[#1F2823]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input 
                        type="text" 
                        placeholder="Search recipes..." 
                        className="w-full pl-11 pr-4 py-3 bg-[#1F2823]/5 border border-[#1F2823]/10 rounded-2xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#1F2823] placeholder-[#1F2823]/40 text-[#1F2823]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                          <button
                             key={type}
                             onClick={() => setActiveFilter(type as any)}
                             className={`px-4 py-2 rounded-xl text-xs font-bold uppercase whitespace-nowrap transition-all border ${
                                 activeFilter === type 
                                 ? 'bg-[#1F2823] text-white border-[#1F2823]' 
                                 : 'bg-transparent text-[#1F2823] border-[#1F2823]/20 hover:border-[#1F2823]'
                             }`}
                          >
                             {type}
                          </button>
                      ))}
                  </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto p-4 flex-1 bg-[#D4E0D1]">
                 <div className="grid gap-3">
                     {filteredRecipes.length === 0 ? (
                        <div className="text-center py-16 text-[#1F2823]/50">
                            <p className="font-medium">No matching recipes found.</p>
                            <p className="text-xs mt-1">Try adjusting your search or filters.</p>
                        </div>
                     ) : (
                         filteredRecipes.map(recipe => (
                             <button 
                                key={recipe.id}
                                onClick={() => handleRecipeSelect(recipe)}
                                className="flex items-center gap-5 p-3 rounded-2xl bg-white border border-[#1F2823]/10 hover:border-[#1F2823] hover:shadow-lg transition-all text-left group w-full overflow-hidden"
                             >
                                <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#1F2823]/10 flex-shrink-0 relative">
                                    <RecipeIllustration 
                                        name={recipe.name} 
                                        ingredients={recipe.ingredients} 
                                        type={recipe.type}
                                        className="w-full h-full"
                                    />
                                </div>
                                <div className="flex-1 min-w-0 py-1">
                                    <h4 className="font-bold text-lg text-[#1F2823] truncate font-serif">{recipe.name}</h4>
                                    <p className="text-xs text-[#1F2823]/60 line-clamp-1 mb-2 font-sans">{recipe.description || 'Delicious home cooked meal'}</p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-[#1F2823]/70 bg-[#1F2823]/5 px-2 py-0.5 rounded uppercase tracking-wide">{recipe.type}</span>
                                        <span className="text-xs font-bold text-[#1F2823]">{recipe.calories} kcal</span>
                                    </div>
                                </div>
                                <div className="pr-2">
                                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all ${swapIndex !== null ? 'bg-[#1F2823] text-white border-[#1F2823]' : 'bg-[#1F2823] text-white border-[#1F2823]'}`}>
                                        {swapIndex !== null ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        )}
                                    </div>
                                </div>
                             </button>
                         ))
                     )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};