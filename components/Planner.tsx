import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getWeeklyPlan, saveDayPlan, getRecipes, getDayPlan } from '../services/storageService';
import { planWeekWithExistingRecipes } from '../services/geminiService';
import { Recipe, DayPlan } from '../types';
import { DAILY_CALORIE_LIMIT } from '../constants';
import { getCategoryColor } from '../utils';
import { Portal } from './Portal';
import { RecipeDetailModal } from './RecipeDetailModal';

export const Planner: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [weekDates, setWeekDates] = useState<string[]>([]);
    const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
    const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [swapIndex, setSwapIndex] = useState<number | null>(null);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    // Modal UI State
    const [modalTab, setModalTab] = useState<'library' | 'custom'>('library');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'breakfast' | 'main meal' | 'snack' | 'light meal'>('all');

    // Custom Meal Form State
    const [customName, setCustomName] = useState('');
    const [customCalories, setCustomCalories] = useState('');
    const [customType, setCustomType] = useState<any>('main meal');

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
        getRecipes().then(setAvailableRecipes);
    }, []);

    useEffect(() => {
        getDayPlan(selectedDate).then(setDayPlan);
    }, [selectedDate]);

    const handleRecipeSelect = async (recipe: Recipe) => {
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

    const handleCustomAdd = () => {
        if (!customName.trim() || !customCalories) return;

        const newMeal: Recipe = {
            id: crypto.randomUUID(),
            name: customName,
            calories: parseInt(customCalories) || 0,
            ingredients: [],
            instructions: [],
            type: customType,
            servings: 1,
            description: 'Eat Out / Custom Meal'
        };

        handleRecipeSelect(newMeal);
    };

    const removeMeal = async (index: number) => {
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
        resetModalState();
        setShowAddModal(true);
    };

    const openSwapModal = (index: number) => {
        setSwapIndex(index);
        resetModalState();
        setShowAddModal(true);
    };

    const resetModalState = () => {
        setModalTab('library');
        setSearchTerm('');
        setActiveFilter('all');
        setCustomName('');
        setCustomCalories('');
        setCustomType('main meal');
    };

    const closeModal = () => {
        setShowAddModal(false);
        setSwapIndex(null);
    };

    const handleAutoPlan = async () => {
        const recipes = await getRecipes();
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
            await Promise.all(weeklyPlan.map(async day => {
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

                await saveDayPlan(planForDay);
            }));

            // Refresh current view
            setDayPlan(await getDayPlan(selectedDate));

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
                    <h2 className="text-3xl font-normal text-main tracking-tight font-serif">Weekly Planner</h2>
                    <p className="text-muted font-medium mt-1">Design your week.</p>
                </div>
                <button
                    onClick={handleAutoPlan}
                    disabled={isGenerating}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${isGenerating ? 'bg-border text-muted cursor-wait' : 'bg-main text-surface hover:bg-main/90'}`}
                >
                    {isGenerating ? 'Planning...' : 'Auto-Plan'}
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
                                    className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-xl transition-all snap-center border ${isSelected
                                        ? 'bg-main text-surface border-main shadow-lg'
                                        : 'bg-surface text-muted border-border hover:border-primary/50'
                                        }`}
                                >
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'opacity-80' : 'opacity-60'}`}>{dayName}</span>
                                    <span className="text-xl font-serif font-medium mt-0.5">{dayNum}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Day View - Light Card */}
                <div className="lg:col-span-8">
                    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-surface sticky top-0 z-10">
                            <div>
                                <h3 className="font-normal text-2xl text-main font-serif">
                                    {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}
                                </h3>
                                <p className="text-muted text-sm font-medium">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</p>
                            </div>

                            <div className={`text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-2 ${isOverLimit ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                {totalCalories} / {DAILY_CALORIE_LIMIT} kcal
                            </div>
                        </div>

                        <div className="p-6 space-y-4 flex-1 bg-background/50">
                            {dayPlan?.meals.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-muted py-20 border border-dashed border-border rounded-xl bg-surface">
                                    <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mb-4 text-muted/50">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    </div>
                                    <p className="font-medium text-main/80">No meals planned.</p>
                                    <p className="text-sm">Add a meal or use Auto-Plan.</p>
                                </div>
                            ) : (
                                dayPlan?.meals.map((meal, idx) => (
                                    <div
                                        key={`${meal.id}-${idx}`}
                                        onClick={() => setSelectedRecipe(meal)}
                                        className="flex items-center justify-between p-4 bg-surface border border-border rounded-2xl hover:border-primary/50 hover:shadow-sm transition-all group overflow-hidden cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center ${getCategoryColor(meal.type).bg}`}>
                                                <div className={`text-3xl font-bold uppercase opacity-50 ${getCategoryColor(meal.type).text}`}>
                                                    {meal.type.charAt(0)}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="font-medium text-main text-lg font-serif">{meal.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-muted bg-background px-2 py-0.5 rounded uppercase tracking-wide">{meal.type}</span>
                                                    <span className="text-xs font-bold text-emerald-600">{meal.calories} kcal</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openSwapModal(idx); }}
                                                className="p-2.5 rounded-xl bg-background text-muted hover:text-primary hover:bg-primary/10 transition-all"
                                                title="Swap Recipe"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4" /><path d="M20 7H4" /><path d="m8 21-4-4 4-4" /><path d="M4 17h16" /></svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeMeal(idx); }}
                                                className="p-2.5 rounded-xl bg-background text-muted hover:text-red-500 hover:bg-red-50 transition-all"
                                                title="Remove Meal"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}

                            <button
                                onClick={openAddModal}
                                className="w-full py-4 mt-4 border border-dashed border-border rounded-xl text-muted font-semibold hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 bg-surface"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Add Meal
                            </button>
                        </div>
                    </div>
                </div>

                {/* Daily Info Column */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Nutrition Summary */}
                    <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
                        <h4 className="font-medium text-main mb-4 font-serif text-xl">Daily Targets</h4>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <span className="font-medium text-muted">Calories</span>
                                    <span className="font-bold text-main">{totalCalories} / {DAILY_CALORIE_LIMIT}</span>
                                </div>
                                <div className="h-1 bg-background rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${isOverLimit ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (totalCalories / DAILY_CALORIE_LIMIT) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tip Card */}
                    <div className="bg-main p-6 rounded-2xl border border-border/10 shadow-lg text-surface">
                        <div className="flex items-center gap-2 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M2 12h20"></path><path d="M20 12v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"></path><path d="m4 8 16-4"></path><path d="m8.86 6.78-.45-1.81a2 2 0 0 1 1.45-2.43l1.94-.55a2 2 0 0 1 2.43 1.45l.45 1.81"></path></svg>
                            <span className="font-bold uppercase tracking-wide text-xs text-emerald-400">Daily Insight</span>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-surface/80">
                            {dayPlan?.tips || "Consistency is key. Focus on nutrient-dense foods to stay full longer."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Improved Add/Swap Meal Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <Portal>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm px-4 py-4"
                            onClick={closeModal}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-border"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="p-6 border-b border-border flex justify-between items-center bg-surface rounded-t-2xl">
                                    <div>
                                        <h3 className="font-normal text-3xl text-main font-serif">{swapIndex !== null ? 'Swap Meal' : 'Add Meal'}</h3>
                                        <p className="text-sm text-muted font-medium mt-1">Select from library or add a quick entry</p>
                                    </div>
                                    <button onClick={closeModal} className="p-2 bg-background hover:bg-background/80 rounded-full transition-colors text-muted hover:text-main">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 pt-4 flex gap-4 border-b border-border">
                                    <button
                                        onClick={() => setModalTab('library')}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${modalTab === 'library' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-main'}`}
                                    >
                                        From Library
                                    </button>
                                    <button
                                        onClick={() => setModalTab('custom')}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${modalTab === 'custom' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-main'}`}
                                    >
                                        Eat Out / Quick Add
                                    </button>
                                </div>

                                {modalTab === 'library' ? (
                                    <>
                                        {/* Search & Filter */}
                                        <div className="p-6 space-y-4 border-b border-border bg-background/50">
                                            <div className="relative">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-3.5 h-5 w-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <input
                                                    type="text"
                                                    placeholder="Search recipes..."
                                                    className="w-full pl-10 pr-4 py-3 bg-surface border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-muted text-main"
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                {['all', 'breakfast', 'main meal', 'snack', 'light meal'].map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setActiveFilter(type as any)}
                                                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-all border ${activeFilter === type
                                                            ? 'bg-main text-surface border-main'
                                                            : 'bg-surface text-muted border-border hover:border-border'
                                                            }`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* List */}
                                        <div className="overflow-y-auto p-4 flex-1 bg-background/50">
                                            <div className="grid gap-3">
                                                {filteredRecipes.length === 0 ? (
                                                    <div className="text-center py-16 text-muted">
                                                        <p className="font-medium">No matching recipes found.</p>
                                                        <p className="text-xs mt-2">Try the "Eat Out / Quick Add" tab for manual entries.</p>
                                                    </div>
                                                ) : (
                                                    filteredRecipes.map(recipe => (
                                                        <button
                                                            key={recipe.id}
                                                            onClick={() => handleRecipeSelect(recipe)}
                                                            className="flex items-center gap-5 p-3 rounded-xl bg-surface border border-border hover:border-primary hover:shadow-md transition-all text-left group w-full overflow-hidden"
                                                        >
                                                            <div className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center ${getCategoryColor(recipe.type).bg}`}>
                                                                <div className={`text-3xl font-bold uppercase opacity-50 ${getCategoryColor(recipe.type).text}`}>
                                                                    {recipe.type.charAt(0)}
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0 py-1">
                                                                <h4 className="font-bold text-lg text-main truncate font-serif">{recipe.name}</h4>
                                                                <p className="text-xs text-muted line-clamp-1 mb-2 font-sans">{recipe.description || 'Delicious home cooked meal'}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-muted bg-background px-2 py-0.5 rounded uppercase tracking-wide">{recipe.type}</span>
                                                                    <span className="text-xs font-bold text-primary">{recipe.calories} kcal</span>
                                                                </div>
                                                            </div>
                                                            <div className="pr-2">
                                                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${swapIndex !== null ? 'bg-main text-surface border-main' : 'border-border text-muted group-hover:border-primary group-hover:text-primary'}`}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-8 flex flex-col gap-6 bg-background/50 flex-1 overflow-y-auto">
                                        <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
                                            <label className="block text-sm font-bold text-main/80 mb-2">Meal Name / Restaurant</label>
                                            <input
                                                type="text"
                                                className="w-full p-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-main placeholder-muted"
                                                placeholder="e.g. Pizza Express, Caesar Salad..."
                                                value={customName}
                                                onChange={e => setCustomName(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
                                                <label className="block text-sm font-bold text-main/80 mb-2">Estimated Calories</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-main"
                                                    placeholder="0"
                                                    value={customCalories}
                                                    onChange={e => setCustomCalories(e.target.value)}
                                                />
                                            </div>
                                            <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm">
                                                <label className="block text-sm font-bold text-main/80 mb-2">Meal Type</label>
                                                <select
                                                    className="w-full p-4 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-main"
                                                    value={customType}
                                                    onChange={e => setCustomType(e.target.value)}
                                                >
                                                    <option value="breakfast">Breakfast</option>
                                                    <option value="main meal">Main Meal</option>
                                                    <option value="snack">Snack</option>
                                                    <option value="light meal">Light Meal</option>
                                                </select>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleCustomAdd}
                                            disabled={!customName.trim() || !customCalories}
                                            className="w-full py-4 bg-main text-surface font-bold rounded-xl hover:bg-main/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
                                        >
                                            Add to Plan
                                        </button>
                                        <p className="text-center text-xs text-muted">Custom meals are added to this day's plan but not saved to your library.</p>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    </Portal>
                )}
            </AnimatePresence>
            {/* Recipe Details Modal */}
            {selectedRecipe && (
                <RecipeDetailModal
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                />
            )}
        </div >
    );
};