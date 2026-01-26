import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getWeeklyPlan, saveDayPlan, getRecipes, getDayPlan, getUpcomingPlan } from '../services/storageService';
import { planWeekWithExistingRecipes, planDayWithExistingRecipes } from '../services/geminiService';
import { Recipe, DayPlan } from '../types';

import { getRecipeTheme } from '../utils';
import { Portal } from './Portal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { GlassCard } from './GlassCard';
import { CookingMode } from './CookingMode';

import { UserStats } from '../types';

export const Planner: React.FC<{ stats: UserStats }> = ({ stats }) => {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [weekDates, setWeekDates] = useState<string[]>([]);
    const [weekPlans, setWeekPlans] = useState<Record<string, DayPlan>>({});
    const [dayPlan, setDayPlan] = useState<DayPlan | null>(null);
    const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [swapIndex, setSwapIndex] = useState<number | null>(null);

    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [showAutoPlanModal, setShowAutoPlanModal] = useState(false);

    // Modal UI State
    const [modalTab, setModalTab] = useState<'library' | 'custom'>('library');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'breakfast' | 'main meal' | 'snack' | 'light meal'>('all');
    const [maxCalories, setMaxCalories] = useState<string>('');

    // Custom Meal Form State
    const [customName, setCustomName] = useState('');
    const [customCalories, setCustomCalories] = useState('');
    const [customType, setCustomType] = useState<any>('main meal');

    // Meal Configuration Modal State (Scaling)
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [pendingRecipe, setPendingRecipe] = useState<Recipe | null>(null);
    const [cookingServings, setCookingServings] = useState<number>(2);

    // Cooking Mode State
    const [cookingModeRecipe, setCookingModeRecipe] = useState<Recipe | null>(null);

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
        getUpcomingPlan(7).then(setWeekPlans);
    }, []);

    useEffect(() => {
        getDayPlan(selectedDate).then(plan => {
            console.log("Planner loaded plan for", selectedDate, plan);
            setDayPlan(plan);
        });
        // Refresh weekly plans too, as saving a day affects the view
        getUpcomingPlan(7).then(setWeekPlans);
    }, [selectedDate]);

    const handleRecipeSelect = (recipe: Recipe) => {
        // Skip config for custom manual entries (assumed "Eat Out" or simple logging)
        if (recipe.description === 'Eat Out / Custom Meal') {
            executeAddMeal(recipe);
            closeModal(); // Close the main add modal
            return;
        }

        setPendingRecipe(recipe);
        setCookingServings(recipe.servings || 2);
        setShowConfigModal(true);
    };

    const executeAddMeal = async (recipe: Recipe, servingsOverride?: number) => {
        if (!dayPlan) return;

        let newMeals = [...dayPlan.meals];

        // Create the meal object with the scaling override if provided
        const mealToAdd: Recipe = {
            ...recipe,
            cookingServings: servingsOverride !== undefined ? servingsOverride : recipe.cookingServings
        };

        if (swapIndex !== null && swapIndex >= 0 && swapIndex < newMeals.length) {
            // Swap existing meal
            newMeals[swapIndex] = mealToAdd;
        } else {
            // Add new meal
            newMeals.push(mealToAdd);
        }

        // Recalculate total calories
        const totalCals = newMeals.reduce((acc, m) => acc + m.calories, 0);

        const updatedPlan = { ...dayPlan, meals: newMeals, totalCalories: totalCals };
        saveDayPlan(updatedPlan);
        setDayPlan(updatedPlan);
    };

    const confirmConfigAndAdd = () => {
        if (pendingRecipe) {
            executeAddMeal(pendingRecipe, cookingServings);
            setShowConfigModal(false);
            setPendingRecipe(null);
            closeModal(); // Close the main add modal
        }
    };

    const handleCustomAdd = () => {
        if (!customName.trim() || !customCalories) return;

        const newMeal: Recipe = {
            id: crypto.randomUUID(),
            name: customName,
            calories: parseInt(customCalories) || 0,
            ingredients: [],
            instructions: [],
            tags: [customType],
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
        setMaxCalories('');
        setCustomName('');
        setCustomCalories('');
        setCustomType('main meal');
    };

    const closeModal = () => {
        setShowAddModal(false);
        setSwapIndex(null);
    };

    const handleAutoPlanClick = () => {
        const recipes = availableRecipes; // Use state variable
        if (recipes.length < 3) {
            alert("You need at least a few recipes in your library for the AI to create a plan. Go to the Recipes tab to add some!");
            return;
        }
        setShowAutoPlanModal(true);
    };

    const handleAutoPlanConfirm = async (mode: 'daily' | '5:2') => {
        setShowAutoPlanModal(false);
        setIsGenerating(true);
        try {
            const weeklyPlan = await planWeekWithExistingRecipes(
                availableRecipes,
                selectedDate,
                mode,
                stats.nonFastDayCalories || 2000
            );

            // Process and save
            await Promise.all(weeklyPlan.map(async day => {
                const meals = availableRecipes.filter(r => day.mealIds.includes(r.id));
                const totalCals = meals.reduce((acc, m) => acc + m.calories, 0);

                const planForDay: DayPlan = {
                    date: day.date,
                    meals: meals,
                    completedMealIds: [], // Reset completed status for new plan
                    tips: day.dailyTip || "Stay on track!",
                    totalCalories: totalCals,
                    type: day.type || (totalCals > 1000 ? 'non-fast' : 'fast') // Fallback logic
                };

                await saveDayPlan(planForDay);
            }));

            // Refresh current day view
            getDayPlan(selectedDate).then(setDayPlan);

        } catch (error) {
            console.error("Auto plan failed:", error);
            alert("Failed to generate plan. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };



    const handleAutoPlanDay = async () => {
        const recipes = availableRecipes;
        if (recipes.length < 3) {
            alert("You need at least a few recipes in your library for the AI to create a plan.");
            return;
        }

        if (dayPlan && dayPlan.meals.length > 0) {
            if (!confirm("This will replace your existing meals for this day. Continue?")) {
                return;
            }
        }

        setIsGenerating(true);
        try {
            // Defaulting to 800 (Fast Day) for the "Plan My Day" feature
            const result = await planDayWithExistingRecipes(recipes, selectedDate, 800);

            const meals = recipes.filter(r => result.mealIds.includes(r.id));
            const totalCals = meals.reduce((acc, m) => acc + m.calories, 0);

            const newPlan: DayPlan = {
                date: selectedDate,
                meals: meals,
                completedMealIds: [],
                tips: result.dailyTip || "Stay on track!",
                totalCalories: totalCals,
                type: 'fast' // Assuming fast day for this specific action
            };

            await saveDayPlan(newPlan);
            setDayPlan(newPlan);
        } catch (error) {
            console.error("Auto plan day failed:", error);
            alert("Failed to generate plan. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const filteredRecipes = availableRecipes.filter(recipe => {
        const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'all' || recipe.tags?.includes(activeFilter);
        const matchesCalories = maxCalories === '' || recipe.calories <= parseInt(maxCalories);
        return matchesSearch && matchesFilter && matchesCalories;
    });

    const toggleMealCompletion = async (mealId: string) => {
        if (!dayPlan) return;

        let newCompleted = [...dayPlan.completedMealIds];
        if (newCompleted.includes(mealId)) {
            newCompleted = newCompleted.filter(id => id !== mealId);
        } else {
            newCompleted.push(mealId);
        }

        const updatedPlan = { ...dayPlan, completedMealIds: newCompleted };
        setDayPlan(updatedPlan);
        await saveDayPlan(updatedPlan);
    };

    return (
        <div className="space-y-8 animate-fade-in">


            {/* Main Content Grid - The Family Table Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Date Scroller - Top Bar */}
                <div className="lg:col-span-12">
                    <div className="flex overflow-x-auto pb-4 gap-3 no-scrollbar snap-x">
                        {weekDates.map(date => {
                            const d = new Date(date);
                            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = d.getDate();
                            const isSelected = date === selectedDate;
                            const plan = weekPlans[date];
                            const hasMeals = plan?.meals && plan.meals.length > 0;

                            return (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    className={`flex-shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all snap-center 
                                        ${isSelected
                                            ? 'bg-hearth text-white shadow-lg shadow-hearth/30 scale-105'
                                            : 'bg-white/80 dark:bg-white/5 text-charcoal/60 dark:text-stone-400 hover:bg-white dark:hover:bg-white/10'}
                                    `}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wide opacity-70">{dayName}</span>
                                    <span className="text-xl font-serif font-bold">{dayNum}</span>
                                    {hasMeals && (
                                        <div className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-hearth'}`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Left Column: The Daily Menu (Card View) */}
                <div className="lg:col-span-12">
                    <GlassCard className="min-h-[600px] relative">
                        {/* Header Actions */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                            <div>
                                <h2 className="text-3xl font-serif text-charcoal dark:text-stone-200">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}'s Menu</h2>
                                <p className="text-charcoal/60 dark:text-stone-400">
                                    {dayPlan?.meals.length || 0} meals planned • {dayPlan?.totalCalories || 0} kcal total
                                </p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={openAddModal}
                                    className="px-4 py-2 bg-charcoal dark:bg-stone-700 text-white rounded-xl font-bold hover:bg-charcoal/90 dark:hover:bg-stone-600 transition-colors shadow-lg"
                                >
                                    + Add Meal
                                </button>
                                <button
                                    onClick={handleAutoPlanDay}
                                    className="px-4 py-2 bg-hearth/10 dark:bg-hearth/20 text-hearth dark:text-hearth-light rounded-xl font-bold hover:bg-hearth/20 dark:hover:bg-hearth/30 transition-colors"
                                >
                                    Auto-Plan Day
                                </button>
                                <button
                                    onClick={handleAutoPlanClick}
                                    disabled={isGenerating}
                                    className={isGenerating ? 'px-4 py-2 bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-600 rounded-xl font-bold cursor-not-allowed' : 'btn-primary px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg'}
                                >
                                    {isGenerating ? 'Planning...' : 'Auto-Plan Week'}
                                </button>
                            </div>
                        </div>

                        {/* Meals List */}
                        <div className="space-y-4">
                            {(!dayPlan || dayPlan.meals.length === 0) ? (
                                <div className="text-center py-24 text-charcoal/40 dark:text-stone-500 border-2 border-dashed border-charcoal/5 dark:border-white/5 rounded-3xl flex flex-col items-center justify-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-stone-100 dark:bg-white/5 flex items-center justify-center text-3xl">
                                        🍽️
                                    </div>
                                    <div>
                                        <p className="font-serif text-xl mb-1 text-charcoal dark:text-stone-300">The table is empty</p>
                                        <p className="text-sm">Add a meal to start planning your day</p>
                                    </div>
                                </div>
                            ) : (
                                dayPlan.meals.map((meal, index) => (
                                    <div key={index} className="group relative bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-[2rem] p-6 transition-all duration-300 hover:shadow-soft border border-white dark:border-white/5 flex gap-6 items-center">
                                        {/* Time / Type Indicator */}
                                        <div className="flex flex-col items-center gap-1 min-w-[60px]">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-charcoal/40 dark:text-stone-500 rotate-180 writing-vertical-rl h-10">
                                                {meal.tags?.[0] || 'Meal'}
                                            </span>
                                            <div className="w-px h-8 bg-charcoal/10 dark:bg-white/10"></div>
                                        </div>

                                        {/* Image */}
                                        <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 bg-stone dark:bg-stone-800">
                                            {meal.image ? (
                                                <img src={meal.image} alt={meal.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-3xl font-serif text-charcoal/20 dark:text-white/20">
                                                    {(meal.name || 'M').charAt(0)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xl font-serif text-charcoal dark:text-stone-200 truncate">{meal.name}</h3>
                                            <div className="flex gap-4 mt-2">
                                                <span className="text-xs font-bold text-hearth dark:text-flame px-2 py-1 bg-hearth/10 dark:bg-flame/10 rounded-lg">
                                                    {meal.calories} kcal
                                                </span>
                                                <span className="text-xs font-bold text-charcoal/40 dark:text-stone-500 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                    {meal.prepTime || 15}m
                                                </span>
                                                <span className="text-xs font-bold text-charcoal/40 dark:text-stone-500 flex items-center gap-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                                    {meal.cookingServings || meal.servings || 2} ppl
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setCookingModeRecipe(meal)}
                                                className="w-10 h-10 rounded-full bg-hearth/10 dark:bg-white/5 text-hearth dark:text-stone-300 flex items-center justify-center hover:bg-hearth hover:text-white dark:hover:bg-hearth dark:hover:text-white transition-all shadow-sm"
                                                title="Start Cooking Mode"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            </button>
                                            <button
                                                onClick={() => removeMeal(index)}
                                                className="w-10 h-10 rounded-full bg-charcoal/5 dark:bg-white/5 text-charcoal/40 dark:text-stone-500 flex items-center justify-center hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </GlassCard>
                </div>
            </div>

            {/* Cooking Mode Overlay */}
            <AnimatePresence>
                {cookingModeRecipe && (
                    <CookingMode
                        recipe={cookingModeRecipe}
                        onClose={() => setCookingModeRecipe(null)}
                    />
                )}
            </AnimatePresence>

            {/* Improved Add/Swap Meal Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <Portal>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-50 dark:bg-[#1A1714]/80 backdrop-blur-sm px-4 py-4"
                            onClick={closeModal}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                className="bg-white dark:bg-white/5 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-border"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="p-6 border-b border-border flex justify-between items-center bg-white dark:bg-white/5 rounded-t-2xl">
                                    <div>
                                        <h3 className="font-normal text-3xl text-charcoal dark:text-stone-200 font-serif">{swapIndex !== null ? 'Swap Meal' : 'Add Meal'}</h3>
                                        <p className="text-sm text-charcoal/60 dark:text-stone-400 font-medium mt-1">Select from library or add a quick entry</p>
                                    </div>
                                    <button onClick={closeModal} className="p-2 bg-stone-50 dark:bg-[#1A1714] hover:bg-stone-50 dark:bg-[#1A1714]/80 rounded-full transition-colors text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 pt-4 flex gap-4 border-b border-border">
                                    <button
                                        onClick={() => setModalTab('library')}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${modalTab === 'library' ? 'border-primary text-primary' : 'border-transparent text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200'}`}
                                    >
                                        From Library
                                    </button>
                                    <button
                                        onClick={() => setModalTab('custom')}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${modalTab === 'custom' ? 'border-primary text-primary' : 'border-transparent text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200'}`}
                                    >
                                        Eat Out / Quick Add
                                    </button>
                                </div>

                                {modalTab === 'library' ? (
                                    <>
                                        {/* Search & Filter */}
                                        <div className="p-6 space-y-4 border-b border-border bg-stone-50 dark:bg-[#1A1714]/50">
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <div className="relative flex-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-3.5 h-5 w-5 text-charcoal/60 dark:text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                    <input
                                                        type="text"
                                                        placeholder="Search recipes..."
                                                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-white/5 border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-muted text-charcoal dark:text-stone-200"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                                <div className="relative w-full md:w-36">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal/60 dark:text-stone-400 pointer-events-none z-10">
                                                        <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Max Cal</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        placeholder="Any"
                                                        min="0"
                                                        className="w-full pl-20 pr-3 py-3 bg-white dark:bg-white/5 border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-muted text-charcoal dark:text-stone-200"
                                                        value={maxCalories}
                                                        onChange={(e) => setMaxCalories(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                {['all', 'breakfast', 'main meal', 'snack', 'light meal'].map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setActiveFilter(type as any)}
                                                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase whitespace-nowrap transition-all border ${activeFilter === type
                                                            ? 'bg-main text-surface border-main'
                                                            : 'bg-white dark:bg-white/5 text-charcoal/60 dark:text-stone-400 border-border hover:border-border'
                                                            }`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* List */}
                                        <div className="overflow-y-auto p-4 flex-1 bg-stone-50 dark:bg-[#1A1714]/50">
                                            <div className="grid gap-3">
                                                {filteredRecipes.length === 0 ? (
                                                    <div className="text-center py-16 text-charcoal/60 dark:text-stone-400">
                                                        <p className="font-medium">No matching recipes found.</p>
                                                        <p className="text-xs mt-2">Try the "Eat Out / Quick Add" tab for manual entries.</p>
                                                    </div>
                                                ) : (
                                                    filteredRecipes.map(recipe => (
                                                        <button
                                                            key={recipe.id}
                                                            onClick={() => handleRecipeSelect(recipe)}
                                                            className="flex items-center gap-5 p-3 rounded-xl bg-white dark:bg-white/5 border border-border hover:border-primary hover:shadow-md transition-all text-left group w-full overflow-hidden"
                                                        >
                                                            <div className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center ${getRecipeTheme(recipe.tags).bg}`}>
                                                                {recipe.image ? (
                                                                    <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className={`text-3xl font-bold uppercase opacity-50 ${getRecipeTheme(recipe.tags).text}`}>
                                                                        {(recipe.name || 'R').charAt(0)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0 py-1">
                                                                <h4 className="font-bold text-lg text-charcoal dark:text-stone-200 truncate font-serif">{recipe.name}</h4>
                                                                <p className="text-xs text-charcoal/60 dark:text-stone-400 line-clamp-1 mb-2 font-sans">{recipe.description || 'Delicious home cooked meal'}</p>
                                                                <div className="flex items-center gap-2">
                                                                    {recipe.tags?.map(tag => (
                                                                        <span key={tag} className="text-[10px] font-bold text-charcoal/60 dark:text-stone-400 bg-stone-50 dark:bg-[#1A1714] px-2 py-0.5 rounded uppercase tracking-wide">{tag}</span>
                                                                    ))}
                                                                    <span className="text-xs font-bold text-primary">{recipe.calories} kcal</span>
                                                                </div>
                                                            </div>
                                                            <div className="pr-2">
                                                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${swapIndex !== null ? 'bg-main text-surface border-main' : 'border-border text-charcoal/60 dark:text-stone-400 group-hover:border-primary group-hover:text-primary'}`}>
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
                                    <div className="p-8 flex flex-col gap-6 bg-stone-50 dark:bg-[#1A1714]/50 flex-1 overflow-y-auto">
                                        <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-border shadow-sm">
                                            <label className="block text-sm font-bold text-charcoal dark:text-stone-200/80 mb-2">Meal Name / Restaurant</label>
                                            <input
                                                type="text"
                                                className="w-full p-4 bg-stone-50 dark:bg-[#1A1714] border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-charcoal dark:text-stone-200 placeholder-muted"
                                                placeholder="e.g. Pizza Express, Caesar Salad..."
                                                value={customName}
                                                onChange={e => setCustomName(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-border shadow-sm">
                                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200/80 mb-2">Estimated Calories</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-4 bg-stone-50 dark:bg-[#1A1714] border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-charcoal dark:text-stone-200"
                                                    placeholder="0"
                                                    value={customCalories}
                                                    onChange={e => setCustomCalories(e.target.value)}
                                                />
                                            </div>
                                            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-border shadow-sm">
                                                <label className="block text-sm font-bold text-charcoal dark:text-stone-200/80 mb-2">Meal Type</label>
                                                <select
                                                    className="w-full p-4 bg-stone-50 dark:bg-[#1A1714] border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-charcoal dark:text-stone-200"
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
                                        <p className="text-center text-xs text-charcoal/60 dark:text-stone-400">Custom meals are added to this day's plan but not saved to your library.</p>
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    </Portal>
                )}
            </AnimatePresence>

            {/* Meal Configuration (Scaling) Modal */}
            <AnimatePresence>
                {showConfigModal && pendingRecipe && (
                    <Portal>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[110] flex items-center justify-center bg-stone-50 dark:bg-[#1A1714]/80 backdrop-blur-sm px-4"
                            onClick={() => setShowConfigModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                                className="bg-white dark:bg-white/5 w-full max-w-sm rounded-3xl shadow-2xl p-6 border border-border"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="text-center mb-6">
                                    <div className={`w-16 h-16 mx-auto rounded-2xl mb-4 flex items-center justify-center text-3xl font-bold shadow-sm ${getRecipeTheme(pendingRecipe.tags).bg} ${getRecipeTheme(pendingRecipe.tags).text}`}>
                                        {pendingRecipe.image ? (
                                            <img src={pendingRecipe.image} alt="" className="w-full h-full object-cover rounded-2xl" />
                                        ) : (
                                            (pendingRecipe.name || 'M').charAt(0)
                                        )}
                                    </div>
                                    <h3 className="text-xl font-bold text-charcoal dark:text-stone-200 font-serif leading-tight">{pendingRecipe.name}</h3>
                                    <p className="text-sm text-charcoal/60 dark:text-stone-400 mt-1">Configure serving size</p>
                                </div>

                                <div className="bg-stone-50 dark:bg-[#1A1714] rounded-2xl p-6 border border-border mb-6">
                                    <label className="block text-center text-xs font-bold uppercase tracking-wider text-charcoal/60 dark:text-stone-400 mb-4">Cooking For</label>
                                    <div className="flex items-center justify-center gap-6">
                                        <button
                                            onClick={() => setCookingServings(Math.max(1, cookingServings - 1))}
                                            className="w-12 h-12 rounded-full bg-white dark:bg-white/5 border border-border hover:border-primary hover:text-primary flex items-center justify-center transition-all active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>

                                        <div className="text-center w-16">
                                            <span className="text-4xl font-bold text-charcoal dark:text-stone-200 block leading-none">{cookingServings}</span>
                                            <span className="text-[10px] text-charcoal/60 dark:text-stone-400 font-bold uppercase tracking-wide">People</span>
                                        </div>

                                        <button
                                            onClick={() => setCookingServings(cookingServings + 1)}
                                            className="w-12 h-12 rounded-full bg-white dark:bg-white/5 border border-border hover:border-primary hover:text-primary flex items-center justify-center transition-all active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <span className="text-xs text-charcoal/60 dark:text-stone-400 bg-white dark:bg-white/5 px-2 py-1 rounded border border-border">
                                            Original Recipe: serves {pendingRecipe.servings || 1}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    <button
                                        onClick={confirmConfigAndAdd}
                                        className="btn-primary w-full py-3.5 text-base shadow-lg"
                                    >
                                        Add to Plan ({cookingServings === (pendingRecipe.servings || 1) ? 'Standard' : `${(cookingServings / (pendingRecipe.servings || 1)).toFixed(1).replace(/\.0$/, '')}x Shopping List`})
                                    </button>
                                    <button
                                        onClick={() => setShowConfigModal(false)}
                                        className="btn-ghost w-full py-3 text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </Portal>
                )}
            </AnimatePresence>

            {/* Recipe Details Modal */}
            {
                selectedRecipe && (
                    <RecipeDetailModal
                        recipe={selectedRecipe}
                        onClose={() => setSelectedRecipe(null)}
                    />
                )
            }

            {
                showAutoPlanModal && (
                    <Portal>
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowAutoPlanModal(false)}>
                            <div className="bg-white dark:bg-white/5 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden premium-shadow border border-border" onClick={e => e.stopPropagation()}>
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-charcoal dark:text-stone-200 font-serif mb-2">Auto-Plan Week</h3>
                                    <p className="text-charcoal/60 dark:text-stone-400 text-sm mb-6">Choose how you want the AI to plan your week.</p>

                                    <div className="space-y-3">
                                        <button
                                            onClick={() => handleAutoPlanConfirm('daily')}
                                            className="w-full text-left p-4 rounded-xl border-2 border-transparent bg-stone-50 dark:bg-[#1A1714] hover:border-primary/20 hover:bg-primary/5 transition-all group"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-charcoal dark:text-stone-200 group-hover:text-primary transition-colors">Strict Fasting</span>
                                                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">800 kcal</span>
                                            </div>
                                            <p className="text-xs text-charcoal/60 dark:text-stone-400">Plan 800 calories for every day of the week.</p>
                                        </button>

                                        <button
                                            onClick={() => handleAutoPlanConfirm('5:2')}
                                            className="w-full text-left p-4 rounded-xl border-2 border-transparent bg-stone-50 dark:bg-[#1A1714] hover:border-amber-500/20 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group"
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-charcoal dark:text-stone-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">5:2 Diet</span>
                                                <span className="text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded">Varied</span>
                                            </div>
                                            <p className="text-xs text-charcoal/60 dark:text-stone-400">2 Fasting Days (800 kcal) + 5 Non-Fasting Days.</p>
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 bg-stone-50 dark:bg-[#1A1714]/50 border-t border-border flex justify-end">
                                    <button
                                        onClick={() => setShowAutoPlanModal(false)}
                                        className="px-4 py-2 text-sm font-bold text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Portal>
                )
            }
        </div >
    );
};