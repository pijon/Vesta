import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getWeeklyPlan, saveDayPlan, getRecipes, getDayPlan, getUpcomingPlan } from '../services/storageService';
import { planWeekWithExistingRecipes, planDayWithExistingRecipes } from '../services/geminiService';
import { Recipe, DayPlan } from '../types';

import { getRecipeTheme } from '../utils';
import { Portal } from './Portal';
import { RecipeDetailModal } from './RecipeDetailModal';

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
            <header className="flex justify-between items-center section-header mb-8">
                <div>
                    <h2 className="section-title">Meal Planner</h2>
                    <p className="section-description">Design your week.</p>
                </div>
                <button
                    onClick={handleAutoPlanClick}
                    disabled={isGenerating}
                    className={isGenerating ? 'btn-base btn-disabled btn-sm flex items-center gap-2' : 'btn-primary btn-sm flex items-center gap-2'}
                >
                    {isGenerating ? 'Planning...' : 'Auto-Plan Week'}
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Date Scroller Column */}
                <div className="lg:col-span-12">
                    <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar snap-x">
                        {weekDates.map(date => {
                            const d = new Date(date);
                            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                            const dayNum = d.getDate();
                            const isSelected = date === selectedDate;

                            const plan = weekPlans[date];
                            const isFastDay = plan?.type === 'fast';
                            const isNonFastDay = plan?.type === 'non-fast';
                            const hasMeals = plan?.meals && plan.meals.length > 0;

                            let indicatorColor = 'bg-transparent';
                            if (hasMeals) {
                                if (isFastDay) indicatorColor = 'bg-primary';
                                else if (isNonFastDay) indicatorColor = 'bg-secondary';
                                else indicatorColor = 'bg-neutral-300 dark:bg-neutral-700';
                            }

                            return (
                                <button
                                    key={date}
                                    onClick={() => setSelectedDate(date)}
                                    className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-20 rounded-2xl transition-all snap-center border-2 
                                        ${isSelected
                                            ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-primary'
                                            : 'bg-surface hover:bg-surface/80 text-muted border-transparent shadow-sm'
                                        } relative overflow-hidden`}
                                >
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'opacity-90' : 'opacity-60'}`}>{dayName}</span>
                                    <span className="text-xl font-serif font-medium mt-0.5">{dayNum}</span>

                                    {/* Type Indicator Dot */}
                                    {hasMeals && (
                                        <div className={`absolute bottom-2 w-1.5 h-1.5 rounded-full ${indicatorColor} ${isSelected ? 'ring-2 ring-white/20' : ''}`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Day View */}
                    <div className="lg:col-span-3 space-y-8">
                        <div className="bg-surface rounded-2xl premium-shadow border border-border p-8 min-h-[500px]">
                            <div className="flex justify-between items-start mb-6 gap-4">
                                <div>
                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                        <h2 className="text-2xl font-medium text-main font-serif">
                                            {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}
                                        </h2>

                                        {/* Status Badges */}
                                        {dayPlan && (
                                            <div className="flex items-center gap-2">
                                                {/* Day Type Badge */}
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        const newType = dayPlan.type === 'fast' ? 'non-fast' : 'fast';
                                                        const updated = { ...dayPlan, type: newType };
                                                        setDayPlan(updated);
                                                        await saveDayPlan(updated);
                                                    }}
                                                    className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md border transition-all hover:opacity-80 active:scale-95 ${dayPlan.type === 'fast'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                                                        }`}
                                                >
                                                    {dayPlan.type === 'fast' ? 'Fast Day' : 'Non-Fast'}
                                                </button>

                                                {/* Calories Badge */}
                                                {(() => {
                                                    const target = dayPlan.type === 'fast' ? 800 : (stats.nonFastDayCalories || 2000);
                                                    const current = dayPlan.mealIds ? availableRecipes.filter(r => dayPlan.mealIds.includes(r.id)).reduce((acc, m) => acc + m.calories, 0)
                                                        : (dayPlan.meals || []).reduce((acc, m) => acc + m.calories, 0); // Handle both formats if needed, though Planner uses .meals typically
                                                    // Planner.tsx uses dayPlan.meals directly usually. Let's stick to what was there: 
                                                    // "const current = dayPlan.totalCalories || 0;" - wait, earlier code calculated it from meals.
                                                    // Let's use the same logic as the original code or valid logic.
                                                    // Original used: const current = dayPlan.totalCalories || 0;
                                                    const currentCals = dayPlan.totalCalories || 0;
                                                    const remaining = target - currentCals;
                                                    const isOver = remaining < 0;

                                                    return (
                                                        <div className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md border flex items-center gap-1.5 ${isOver
                                                            ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                            }`}>
                                                            <span>{remaining} Left</span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-muted font-medium">
                                        {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleAutoPlanDay}
                                        disabled={isGenerating}
                                        className="text-white px-3 py-2 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 text-xs"
                                        title="Auto-Plan this day (800 kcal)"
                                        style={{ backgroundColor: 'var(--primary)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                                    >
                                        {isGenerating ? (
                                            <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                        )}
                                        Auto-Plan Day
                                    </button>
                                    <button
                                        onClick={openAddModal}
                                        className="text-white px-3 py-2 rounded-xl font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 text-xs"
                                        style={{ backgroundColor: 'var(--primary)' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--primary-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--primary)'}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Add Meal
                                    </button>
                                </div>
                            </div>

                            {/* Meals List */}
                            <div className="space-y-4">
                                {dayPlan?.meals.length === 0 ? (
                                    <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
                                        <div className="mx-auto w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mb-4 text-muted">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1l-3 1-3-1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1" /><path d="M6 12v-2" /><path d="M6 8h12a2 2 0 1 1 0 4h-2v2h-4v-2H6z" /><path d="M6 12a6 6 0 1 0 12 0v5" /><path d="M9 21h6" /><path d="M12 17v4" /></svg>
                                        </div>
                                        <h3 className="text-lg font-medium text-main mb-1 font-serif">No meals planned</h3>
                                        <p className="text-muted text-sm max-w-xs mx-auto mb-6">Plan ahead to stay on track with your Vesta goals.</p>
                                        <button
                                            onClick={openAddModal}
                                            className="text-primary font-bold hover:underline"
                                        >
                                            Browse Recipes
                                        </button>
                                    </div>
                                ) : (
                                    dayPlan?.meals.map((meal, index) => {
                                        const isCompleted = (dayPlan.completedMealIds || []).includes(meal.id);
                                        return (
                                            <div
                                                key={index}
                                                onClick={() => setSelectedRecipe(meal)}
                                                className={`p-6 flex items-center justify-between rounded-xl border transition-all cursor-pointer group ${isCompleted
                                                    ? 'bg-background border-border opacity-60'
                                                    : 'bg-surface border-border hover:border-primary/50 hover:shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); toggleMealCompletion(meal.id); }}
                                                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${isCompleted
                                                            ? 'bg-primary border-primary text-primary-foreground'
                                                            : 'border-border hover:border-primary text-transparent'
                                                            }`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </div>
                                                    {meal.image ? (
                                                        <img src={meal.image} alt={meal.name} className="w-16 h-16 rounded-lg object-cover shadow-sm bg-muted/10" />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-lg bg-muted/10 flex items-center justify-center text-muted">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></svg>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className={`font-medium text-lg ${isCompleted ? 'text-muted line-through' : 'text-main'}`}>{meal.name}</p>
                                                        <div className="flex gap-3 text-sm text-muted mt-1">
                                                            <span className="flex items-center gap-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                                {meal.prepTime || 'N/A'}m
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 2.3 3 5 0 2.238-1.789 3.966-4.008 3.998" /><path d="M12 2v2" /><path d="M12 17v4" /><path d="M8 21h8" /></svg>
                                                                {meal.calories} kcal
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openSwapModal(index);
                                                        }}
                                                        className="p-2 text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                        title="Swap Meal"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4" /><path d="M7 20V4" /><path d="m21 8-4-4-4 4" /><path d="M17 4v16" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            removeMeal(index);
                                                        }}
                                                        className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Remove Meal"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                        </div>
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
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <div className="relative flex-1">
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
                                                <div className="relative w-full md:w-36">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10">
                                                        <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">Max Cal</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        placeholder="Any"
                                                        min="0"
                                                        className="w-full pl-20 pr-3 py-3 bg-surface border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary placeholder-muted text-main"
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
                                                                <h4 className="font-bold text-lg text-main truncate font-serif">{recipe.name}</h4>
                                                                <p className="text-xs text-muted line-clamp-1 mb-2 font-sans">{recipe.description || 'Delicious home cooked meal'}</p>
                                                                <div className="flex items-center gap-2">
                                                                    {recipe.tags?.map(tag => (
                                                                        <span key={tag} className="text-[10px] font-bold text-muted bg-background px-2 py-0.5 rounded uppercase tracking-wide">{tag}</span>
                                                                    ))}
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

            {showAutoPlanModal && (
                <Portal>
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowAutoPlanModal(false)}>
                        <div className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden premium-shadow border border-border" onClick={e => e.stopPropagation()}>
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-main font-serif mb-2">Auto-Plan Week</h3>
                                <p className="text-muted text-sm mb-6">Choose how you want the AI to plan your week.</p>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => handleAutoPlanConfirm('daily')}
                                        className="w-full text-left p-4 rounded-xl border-2 border-transparent bg-background hover:border-primary/20 hover:bg-primary/5 transition-all group"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-main group-hover:text-primary transition-colors">Strict Fasting</span>
                                            <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">800 kcal</span>
                                        </div>
                                        <p className="text-xs text-muted">Plan 800 calories for every day of the week.</p>
                                    </button>

                                    <button
                                        onClick={() => handleAutoPlanConfirm('5:2')}
                                        className="w-full text-left p-4 rounded-xl border-2 border-transparent bg-background hover:border-amber-500/20 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all group"
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-main group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">5:2 Diet</span>
                                            <span className="text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded">Varied</span>
                                        </div>
                                        <p className="text-xs text-muted">2 Fasting Days (800 kcal) + 5 Non-Fasting Days.</p>
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-background/50 border-t border-border flex justify-end">
                                <button
                                    onClick={() => setShowAutoPlanModal(false)}
                                    className="px-4 py-2 text-sm font-bold text-muted hover:text-main"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </Portal>
            )}
        </div >
    );
};