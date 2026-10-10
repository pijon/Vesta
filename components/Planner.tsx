import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getWeeklyPlan, saveDayPlan, getRecipes, getDayPlan, getUpcomingPlan, getDayPlansInRange, getFamilyPlansInRange } from '../services/storageService';
import { suggestSideDishes } from '../services/geminiService';

import { Recipe, DayPlan } from '../types';

import { getRecipeTheme } from '../utils';
import { Portal } from './Portal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { GlassCard } from './GlassCard';
import { CookingMode } from './CookingMode';
import BatchPlannerModal from './BatchPlannerModal';

import { UserStats } from '../types';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { mealVisualFor } from '../utils/mealVisual';
import { Flame, Sparkles, Plus, ChefHat, Package, Trash2, X, UtensilsCrossed } from 'lucide-react';

export const Planner: React.FC<{ stats: UserStats; onPlanChanged?: () => void }> = ({ stats, onPlanChanged }) => {
    const [selectedDate, setSelectedDate] = useState<string>(localDateString());
    const [weekDates, setWeekDates] = useState<string[]>([]);
    const [weekPlans, setWeekPlans] = useState<Record<string, DayPlan>>({});
    // const [dayPlan, setDayPlan] = useState<DayPlan | null>(null); // Removed - Derived from weekPlans
    const [availableRecipes, setAvailableRecipes] = useState<Recipe[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);


    // Modal UI State
    // Modal UI State
    const [modalTab, setModalTab] = useState<'library' | 'custom' | 'leftovers' | 'suggestions'>('library');
    const [leftoverCandidates, setLeftoverCandidates] = useState<{ date: string; recipe: Recipe }[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'breakfast' | 'main meal' | 'snack' | 'light meal'>('all');
    const [maxCalories, setMaxCalories] = useState<string>('');

    // AI Suggestions State
    const [suggestedSides, setSuggestedSides] = useState<Recipe[]>([]);
    const [isSuggesting, setIsSuggesting] = useState(false);

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
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    const [swapIndex, setSwapIndex] = useState<number | null>(null);
    const [targetMealIndex, setTargetMealIndex] = useState<number | null>(null); // For adding sides
    const [showBatchPlanner, setShowBatchPlanner] = useState(false);

    // Data Loading
    const loadData = async () => {
        const today = localDateString();
        const end = new Date();
        end.setDate(end.getDate() + 14); // Fetch 2 weeks out
        const endDate = localDateString(end);

        // SWR: Load from cache first
        // Need to import dynamically or use the ones from storageService if available
        // We imported them at top level but need to ensure we use the new exports
        // Re-importing locally to ensure we get the latest
        const { getCachedPlansInRange, getRecipes: getRecipesCached } = await import('../services/storageService');

        // Manual cache check (since we haven't updated the import at top of file yet)
        const cachedPlans = getCachedPlansInRange(today, endDate);
        if (cachedPlans) {
            setWeekPlans(cachedPlans);
        }

        // Recipes cache check
        // We can do a direct localStorage check or use a helper. 
        // Let's rely on the Promise.all below for the network part, but try to hydrate recipes from cache if possible
        // Actually, getRecipes now saves to cache. We need a way to READ.
        // Let's add getCachedRecipes export to storageService in the previous step, assuming I did.
        // Wait, I only added the const, I didn't export `getCachedRecipes`. 
        // I should fix storageService export first.

        // Proceeding with Parallel fetch (Background Revalidation)
        const [recipes, plans] = await Promise.all([
            getRecipes(),
            getFamilyPlansInRange(today, endDate)
        ]);

        setAvailableRecipes(recipes);
        setWeekPlans(plans); // This will overwrite cache with fresh data
    };

    useEffect(() => {
        // Generate next 7 days for UI
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            dates.push(localDateString(d));
        }
        setWeekDates(dates);

        // Initial Fetch
        loadData();
    }, []);

    // Derived State (Immediate - No Loading State on Switch)
    const dayPlan = weekPlans[selectedDate] || {
        date: selectedDate,
        meals: [],
        completedMealIds: [],
        type: 'fast' // Default match storageService default
    };

    // Calories planned for a day (stored total, else meals plus their sides)
    const dayCalories = (plan?: DayPlan) => {
        if (!plan) return 0;
        if (plan.totalCalories) return plan.totalCalories;
        return plan.meals.reduce((sum, m) => sum + (m.calories || 0) + (m.sides || []).reduce((s, side) => s + (side.calories || 0), 0), 0);
    };
    // Same rule as Today: fast days use the daily goal, other days the non-fast allowance
    const targetFor = (plan?: DayPlan) =>
        (plan?.type ?? 'fast') === 'non-fast' ? (stats.nonFastDayCalories || 2000) : stats.dailyCalorieGoal;

    const selectedCalories = dayCalories(dayPlan);
    const selectedTarget = targetFor(dayPlan);
    const plannedDayCount = weekDates.filter(date => (weekPlans[date]?.meals.length ?? 0) > 0).length;
    const weekRangeLabel = (() => {
        if (weekDates.length === 0) return 'This week';
        const start = parseLocalDate(weekDates[0]);
        const end = parseLocalDate(weekDates[weekDates.length - 1]);
        const startLabel = start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        const endLabel = end.toLocaleDateString(undefined, { day: 'numeric', month: start.getMonth() === end.getMonth() ? undefined : 'short' });
        return `${startLabel} – ${endLabel}`;
    })();

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

    const updatePlanOptimistically = (updatedPlan: DayPlan) => {
        setWeekPlans(prev => ({
            ...prev,
            [updatedPlan.date]: updatedPlan
        }));
        onPlanChanged?.();
    };

    const executeAddMeal = async (recipe: Recipe, servingsOverride?: number) => {
        let newMeals = [...dayPlan.meals];

        // Create the meal object with the scaling override if provided
        const mealToAdd: Recipe = {
            ...recipe,
            originalRecipeId: recipe.originalRecipeId || recipe.id,
            cookingServings: servingsOverride !== undefined ? servingsOverride : recipe.cookingServings
        };

        if (targetMealIndex !== null && targetMealIndex >= 0 && targetMealIndex < newMeals.length) {
            // Adding a Side Dish
            const parentMeal = { ...newMeals[targetMealIndex] };
            const currentSides = parentMeal.sides ? [...parentMeal.sides] : [];

            // Tag as side dish if not already
            if (!mealToAdd.tags.includes('side dish')) {
                mealToAdd.tags = [...mealToAdd.tags, 'side dish'];
            }

            currentSides.push(mealToAdd);
            parentMeal.sides = currentSides;
            newMeals[targetMealIndex] = parentMeal;
        } else if (swapIndex !== null && swapIndex >= 0 && swapIndex < newMeals.length) {
            // Swap existing meal
            newMeals[swapIndex] = mealToAdd;
        } else {
            // Add new meal
            newMeals.push(mealToAdd);
        }

        // Recalculate total calories (recursive)
        const calculateTotalCalories = (meals: Recipe[]) => {
            return meals.reduce((acc, meal) => {
                const sidesCalories = meal.sides?.reduce((sAcc, s) => sAcc + s.calories, 0) || 0;
                return acc + meal.calories + sidesCalories;
            }, 0);
        };

        const totalCals = calculateTotalCalories(newMeals);

        const updatedPlan = { ...dayPlan, meals: newMeals, totalCalories: totalCals };

        // Optimistic Update
        updatePlanOptimistically(updatedPlan);

        // Persist
        await saveDayPlan(updatedPlan);
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
        const newMeals = [...dayPlan.meals];
        newMeals.splice(index, 1);

        const calculateTotalCalories = (meals: Recipe[]) => {
            return meals.reduce((acc, meal) => {
                const sidesCalories = meal.sides?.reduce((sAcc, s) => sAcc + s.calories, 0) || 0;
                return acc + meal.calories + sidesCalories;
            }, 0);
        };

        const totalCals = calculateTotalCalories(newMeals);

        const updatedPlan = { ...dayPlan, meals: newMeals, totalCalories: totalCals };

        updatePlanOptimistically(updatedPlan);
        await saveDayPlan(updatedPlan);
    };

    const removeSide = async (parentIndex: number, sideIndex: number) => {
        const newMeals = [...dayPlan.meals];
        const parentMeal = { ...newMeals[parentIndex] };

        if (parentMeal.sides) {
            const newSides = [...parentMeal.sides];
            newSides.splice(sideIndex, 1);
            parentMeal.sides = newSides;
            newMeals[parentIndex] = parentMeal;

            const calculateTotalCalories = (meals: Recipe[]) => {
                return meals.reduce((acc, meal) => {
                    const sidesCalories = meal.sides?.reduce((sAcc, s) => sAcc + s.calories, 0) || 0;
                    return acc + meal.calories + sidesCalories;
                }, 0);
            };

            const totalCals = calculateTotalCalories(newMeals);
            const updatedPlan = { ...dayPlan, meals: newMeals, totalCalories: totalCals };

            updatePlanOptimistically(updatedPlan);
            await saveDayPlan(updatedPlan);
        }
    };

    const togglePacked = async (index: number) => {
        const newMeals = [...dayPlan.meals];
        const meal = newMeals[index];
        newMeals[index] = { ...meal, isPacked: !meal.isPacked };

        const updatedPlan = { ...dayPlan, meals: newMeals };

        updatePlanOptimistically(updatedPlan);
        await saveDayPlan(updatedPlan);
    }

    const openAddModal = () => {
        setSwapIndex(null);
        setTargetMealIndex(null);
        resetModalState();
        setShowAddModal(true);

        // Fetch last 3 days for Leftovers tab
        const endD = parseLocalDate(selectedDate);
        endD.setDate(endD.getDate() - 1);
        const endDate = localDateString(endD);

        const startD = parseLocalDate(selectedDate);
        startD.setDate(startD.getDate() - 3);
        const startDate = localDateString(startD);

        getDayPlansInRange(startDate, endDate).then(plans => {
            const candidates: { date: string; recipe: Recipe }[] = [];

            // Iterate from yesterday backwards
            for (let i = 1; i <= 3; i++) {
                const d = parseLocalDate(selectedDate);
                d.setDate(d.getDate() - i);
                const dateStr = localDateString(d);
                const plan = plans[dateStr];

                if (plan && plan.meals) {
                    plan.meals.forEach(m => {
                        candidates.push({ date: dateStr, recipe: m });
                    });
                }
            }
            setLeftoverCandidates(candidates);
        });
    };

    const openSwapModal = (index: number) => {
        setSwapIndex(index);
        setTargetMealIndex(null);
        resetModalState();
        setShowAddModal(true);
    };

    const openAddSideModal = (index: number) => {
        setTargetMealIndex(index);
        setSwapIndex(null);
        resetModalState();
        setModalTab('library'); // Default to library for sides
        setActiveFilter('all'); // Or maybe 'snack'/'light meal'?
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
        setSuggestedSides([]);
        setIsSuggesting(false);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setSwapIndex(null);
        setTargetMealIndex(null);
    };

    const handleSuggestSides = async () => {
        if (targetMealIndex === null || !dayPlan) return;

        setIsSuggesting(true);
        try {
            const mainMeal = dayPlan.meals[targetMealIndex];
            const sides = await suggestSideDishes(mainMeal.name, mainMeal.calories);
            setSuggestedSides(sides);
        } catch (error) {
            console.error("Failed to suggest sides", error);
        } finally {
            setIsSuggesting(false);
        }
    };



    const filteredRecipes = availableRecipes.filter(recipe => {
        const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = activeFilter === 'all' || recipe.tags?.includes(activeFilter);
        const matchesCalories = maxCalories === '' || recipe.calories <= parseInt(maxCalories);
        return matchesSearch && matchesFilter && matchesCalories;
    });

    const toggleMealCompletion = async (mealId: string) => {
        let newCompleted = [...dayPlan.completedMealIds];
        if (newCompleted.includes(mealId)) {
            newCompleted = newCompleted.filter(id => id !== mealId);
        } else {
            newCompleted.push(mealId);
        }

        const updatedPlan = { ...dayPlan, completedMealIds: newCompleted };

        updatePlanOptimistically(updatedPlan);
        await saveDayPlan(updatedPlan);
    };

    const toggleFastDay = async () => {
        const newType = dayPlan?.type === 'fast' ? 'non-fast' : 'fast';
        const updatedPlan: DayPlan = { ...dayPlan, type: newType };

        updatePlanOptimistically(updatedPlan);
        await saveDayPlan(updatedPlan);
    };

    const isFastDay = dayPlan?.type === 'fast';
    const isSelectedToday = selectedDate === localDateString();
    const selectedDayDate = parseLocalDate(selectedDate);

    return (
        <div className="space-y-6">
            {/* Week strip: each day shows planned calories against its target */}
            <section aria-label="Choose a day">
                <div className="flex items-baseline justify-between mb-3 px-1">
                    <h2 className="heading-2">{weekRangeLabel}</h2>
                    <span className="text-sm text-muted">{plannedDayCount} of {weekDates.length} days planned</span>
                </div>
                <div className="grid grid-cols-7 gap-1.5 md:gap-3">
                    {weekDates.map(date => {
                        const d = parseLocalDate(date);
                        const plan = weekPlans[date];
                        const kcal = dayCalories(plan);
                        const target = targetFor(plan);
                        const fill = target > 0 ? Math.min(kcal / target, 1) : 0;
                        const isSelected = date === selectedDate;
                        const isToday = localDateString() === date;
                        const isFast = (plan?.type ?? 'fast') === 'fast';
                        return (
                            <button
                                key={date}
                                onClick={() => setSelectedDate(date)}
                                aria-pressed={isSelected}
                                aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${kcal} of ${target} kcal planned${isFast ? ', fast day' : ''}`}
                                className={`relative flex flex-col items-center gap-1 rounded-[14px] pt-2 pb-2.5 px-1 border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${isSelected
                                    ? 'bg-ink text-on-ink border-transparent'
                                    : 'bg-surface border-border hover:bg-surface-sunken'}`}
                            >
                                <span className={`text-xs font-semibold ${isSelected ? '' : 'text-muted'}`}>
                                    {isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}
                                </span>
                                <span className="font-display font-extrabold text-xl md:text-2xl leading-none">{d.getDate()}</span>
                                <span className={`w-full max-w-10 h-1 rounded-full overflow-hidden ${isSelected ? 'bg-on-ink/25' : 'bg-surface-sunken'}`}>
                                    <span
                                        className={`block h-full rounded-full ${isSelected ? 'bg-on-ink' : kcal > target ? 'bg-warning' : 'bg-primary'}`}
                                        style={{ width: `${fill * 100}%` }}
                                    />
                                </span>
                                {isFast && (
                                    <span className={`absolute top-1 right-1 size-1.5 rounded-full ${isSelected ? 'bg-on-ink' : 'bg-fasting'}`} aria-hidden="true" />
                                )}
                            </button>
                        );
                    })}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted mt-2 px-1">
                    <span className="size-1.5 rounded-full bg-fasting" aria-hidden="true" /> Fast day
                </p>
            </section>

            {/* Selected day */}
            <section className="card">
                <div className="p-5 md:p-6 pb-4 md:pb-5 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-sm text-muted">
                                {isSelectedToday ? 'Today' : selectedDayDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
                            </p>
                            <h2 className="heading-1">{selectedDayDate.toLocaleDateString(undefined, { weekday: 'long' })}</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Day type: segmented control */}
                            <div role="radiogroup" aria-label="Day type" className="inline-flex p-1 rounded-full bg-surface-sunken">
                                {([['non-fast', 'Nourish'], ['fast', 'Fast day']] as const).map(([type, label]) => {
                                    const active = (type === 'fast') === isFastDay;
                                    return (
                                        <button
                                            key={type}
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => { if (!active) toggleFastDay(); }}
                                            className={`min-h-9 px-4 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${active
                                                ? (type === 'fast' ? 'bg-fasting-bg text-fasting-text shadow-sm' : 'bg-surface text-main shadow-sm')
                                                : 'text-muted hover:text-main'}`}
                                        >
                                            {type === 'fast' && <Flame size={14} className="inline -mt-0.5 mr-1" aria-hidden="true" />}
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            <button onClick={() => setShowBatchPlanner(true)} className="btn-secondary btn-sm">
                                <Sparkles size={16} aria-hidden="true" /> Plan ahead
                            </button>
                            <button onClick={openAddModal} className="btn-primary btn-sm">
                                <Plus size={16} aria-hidden="true" /> Add meal
                            </button>
                        </div>
                    </div>

                    {/* Calories planned against the day's target */}
                    <div>
                        <div className="flex items-baseline justify-between gap-3 mb-1.5">
                            <p className="text-sm">
                                <span className="font-display font-extrabold text-2xl">{selectedCalories}</span>
                                <span className="text-muted"> of {selectedTarget} kcal planned</span>
                            </p>
                            <p className={`text-sm font-semibold ${selectedCalories > selectedTarget ? 'text-warning' : 'text-muted'}`}>
                                {selectedCalories > selectedTarget
                                    ? `${selectedCalories - selectedTarget} over`
                                    : `${selectedTarget - selectedCalories} left`}
                            </p>
                        </div>
                        <div className="h-2 rounded-full bg-surface-sunken overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-[width] duration-500 ${selectedCalories > selectedTarget ? 'bg-warning' : 'bg-primary'}`}
                                style={{ width: `${selectedTarget > 0 ? Math.min(selectedCalories / selectedTarget, 1) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Meals */}
                <div className="px-3 md:px-4 pb-4">
                    {(!dayPlan || dayPlan.meals.length === 0) ? (
                        <div className="tile tile-neutral items-center text-center py-12 mx-2">
                            <UtensilsCrossed size={28} className="text-muted mb-3" aria-hidden="true" />
                            <p className="font-semibold">The table is empty</p>
                            <p className="text-sm text-muted mt-1 mb-4">Add a meal, or let Vesta plan the week ahead for you.</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                <button onClick={openAddModal} className="btn-primary btn-sm"><Plus size={16} aria-hidden="true" /> Add meal</button>
                                <button onClick={() => setShowBatchPlanner(true)} className="btn-secondary btn-sm"><Sparkles size={16} aria-hidden="true" /> Plan ahead</button>
                            </div>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {dayPlan.meals.map((meal, index) => {
                                const visual = mealVisualFor(meal);
                                const sidesKcal = (meal.sides || []).reduce((sum, side) => sum + (side.calories || 0), 0);
                                return (
                                    <li key={index} className="rounded-[18px] border border-border bg-surface hover:bg-surface-sunken/60 transition-colors">
                                        <div className="flex gap-3 md:gap-4 p-3 md:p-4">
                                            <button
                                                onClick={() => setSelectedRecipe(meal)}
                                                className="shrink-0 rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                                                aria-label={`View recipe: ${meal.name}`}
                                            >
                                                {meal.image ? (
                                                    <img src={meal.image} alt="" className="size-20 md:size-24 rounded-[14px] object-cover" />
                                                ) : (
                                                    <span className={`size-20 md:size-24 rounded-[14px] flex items-center justify-center ${visual.tint}`}>
                                                        <visual.Icon size={32} strokeWidth={1.75} aria-hidden="true" />
                                                    </span>
                                                )}
                                            </button>

                                            <div className="flex-1 min-w-0 flex flex-col">
                                                <button onClick={() => setSelectedRecipe(meal)} className="text-left rounded focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
                                                    <h3 className="heading-3 line-clamp-2">{meal.name}</h3>
                                                </button>
                                                <p className="text-xs text-muted mt-0.5">
                                                    {visual.label} · <span className="font-semibold text-main">{meal.calories + sidesKcal} kcal</span>
                                                    {!!meal.prepTime && ` · ${meal.prepTime} min`}
                                                    {!!meal.protein && ` · ${meal.protein} g protein`}
                                                </p>
                                                {(meal.isShared || meal.isLeftover || meal.isPacked) && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {meal.isShared && <span className="badge badge-workout !py-0">From {meal.ownerName?.split(' ')[0] || 'family'}</span>}
                                                        {meal.isLeftover && <span className="badge badge-neutral !py-0">Leftover</span>}
                                                        {meal.isPacked && <span className="badge badge-water !py-0">Packed</span>}
                                                    </div>
                                                )}

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 mt-auto pt-2">
                                                    <button onClick={() => setCookingModeRecipe(meal)} className="btn-secondary btn-sm !px-3">
                                                        <ChefHat size={16} aria-hidden="true" /> Cook
                                                    </button>
                                                    <button onClick={() => openAddSideModal(index)} className="btn-ghost btn-sm !px-3">
                                                        <Plus size={16} aria-hidden="true" /> Side
                                                    </button>
                                                    {!meal.isShared && (
                                                        <>
                                                            <button
                                                                onClick={() => togglePacked(index)}
                                                                aria-pressed={!!meal.isPacked}
                                                                aria-label={meal.isPacked ? 'Unmark as packed lunch' : 'Mark as packed lunch'}
                                                                className={`size-9 ml-auto flex items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${meal.isPacked ? 'bg-water-bg text-water-text' : 'text-muted hover:bg-surface-sunken hover:text-main'}`}
                                                            >
                                                                <Package size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => removeMeal(index)}
                                                                aria-label={`Remove ${meal.name}`}
                                                                className="size-9 flex items-center justify-center rounded-full text-muted hover:bg-error-bg hover:text-error transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sides */}
                                        {meal.sides && meal.sides.length > 0 && (
                                            <ul className="border-t border-border mx-3 md:mx-4 py-2">
                                                {meal.sides.map((side, sideIdx) => {
                                                    const sideVisual = mealVisualFor(side);
                                                    return (
                                                        <li key={side.id || sideIdx} className="group/side flex items-center gap-3 py-1.5 pl-2">
                                                            {side.image ? (
                                                                <img src={side.image} alt="" className="size-9 rounded-[10px] object-cover shrink-0" />
                                                            ) : (
                                                                <span className={`size-9 rounded-[10px] flex items-center justify-center shrink-0 ${sideVisual.tint}`}>
                                                                    <sideVisual.Icon size={16} aria-hidden="true" />
                                                                </span>
                                                            )}
                                                            <span className="flex-1 min-w-0">
                                                                <span className="block text-sm font-semibold truncate">{side.name}</span>
                                                                <span className="block text-xs text-muted">Side · {side.calories} kcal</span>
                                                            </span>
                                                            <button
                                                                onClick={() => removeSide(index, sideIdx)}
                                                                aria-label={`Remove side ${side.name}`}
                                                                className="size-8 flex items-center justify-center rounded-full text-muted hover:bg-error-bg hover:text-error md:opacity-0 md:group-hover/side:opacity-100 md:focus-visible:opacity-100 transition-[opacity,colors]"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </section>

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
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 px-4 py-4"
                            onClick={closeModal}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                className="bg-[var(--background)] w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] border border-border backdrop-blur-md"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="p-6 border-b border-border flex justify-between items-center bg-transparent rounded-t-3xl">
                                    <div>
                                        <h3 className="font-normal text-3xl text-[var(--text-main)] font-serif">
                                            {swapIndex !== null ? 'Swap Meal' : targetMealIndex !== null ? 'Add Side Dish' : 'Add Meal'}
                                        </h3>
                                        <p className="text-sm text-[var(--text-secondary)] font-medium mt-1">
                                            {targetMealIndex !== null ? 'Select a side dish to accompany your meal' : 'Select from library or add a quick entry'}
                                        </p>
                                    </div>
                                    <button onClick={closeModal} className="p-2 bg-[var(--input-bg)] hover:bg-[var(--border)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-main)]">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 pt-4 flex gap-4 border-b border-border">
                                    <button
                                        onClick={() => setModalTab('library')}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${modalTab === 'library' ? 'border-primary text-primary' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
                                    >
                                        From Library
                                    </button>
                                    <button
                                        onClick={() => setModalTab('custom')}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${modalTab === 'custom' ? 'border-primary text-primary' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
                                    >
                                        Eat Out / Quick Add
                                    </button>
                                    <button
                                        onClick={() => setModalTab('leftovers')}
                                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${modalTab === 'leftovers' ? 'border-primary text-primary' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
                                    >
                                        Leftovers
                                    </button>
                                    {targetMealIndex !== null && (
                                        <button
                                            onClick={() => {
                                                setModalTab('suggestions');
                                                if (suggestedSides.length === 0 && !isSuggesting) {
                                                    handleSuggestSides();
                                                }
                                            }}
                                            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${modalTab === 'suggestions' ? 'border-primary text-primary' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-main)]'}`}
                                        >
                                            <span className="text-xs">✨</span> AI Suggestions
                                        </button>
                                    )}
                                </div>

                                {modalTab === 'suggestions' ? (
                                    <div className="overflow-y-auto p-4 flex-1 bg-transparent">
                                        {isSuggesting ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)] animate-pulse">
                                                <div className="w-12 h-12 rounded-full bg-hearth/10 flex items-center justify-center mb-4">
                                                    <span className="text-2xl animate-spin">✨</span>
                                                </div>
                                                <p className="font-medium">Consulting the chef...</p>
                                                <p className="text-xs mt-2">Finding the perfect pair for your meal</p>
                                            </div>
                                        ) : suggestedSides.length === 0 ? (
                                            <div className="text-center py-16 text-[var(--text-secondary)]">
                                                <p className="font-medium">No suggestions available.</p>
                                                <button
                                                    onClick={handleSuggestSides}
                                                    className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90"
                                                >
                                                    Try Again
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                <div className="px-2 pb-2 text-xs text-[var(--text-secondary)]">
                                                    Found {suggestedSides.length} matches for your meal
                                                </div>
                                                {suggestedSides.map((recipe, idx) => (
                                                    <button
                                                        key={recipe.id || idx}
                                                        onClick={() => executeAddMeal(recipe)}
                                                        className="flex items-center gap-4 p-2 rounded-xl bg-[var(--card-bg)] border border-border hover:border-primary hover:shadow-md transition-all text-left group"
                                                    >
                                                        <div className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 relative flex items-center justify-center ${getRecipeTheme(recipe.tags).bg}`}>
                                                            {recipe.image ? (
                                                                <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className={`text-3xl font-bold opacity-50 ${getRecipeTheme(recipe.tags).text}`}>
                                                                    {(recipe.name || 'S').charAt(0)}
                                                                </div>
                                                            )}
                                                            <div className="absolute top-1 right-1 bg-surface dark:bg-black/50 rounded-full p-1">
                                                                <span className="text-xs">✨</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0 py-1">
                                                            <h4 className="font-bold text-lg text-[var(--text-main)] truncate font-serif">{recipe.name}</h4>
                                                            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-sans mt-0.5">
                                                                <span className="bg-charcoal/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-bold">Suggested Side</span>
                                                                <span className="font-medium">{recipe.calories} kcal</span>
                                                            </div>
                                                        </div>
                                                        <div className="pr-2">
                                                            <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center transition-all text-muted dark:text-muted group-hover:border-primary group-hover:text-primary">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : modalTab === 'library' ? (
                                    <>
                                        {/* Search & Filter */}
                                        <div className="p-6 space-y-4 border-b border-border bg-transparent">
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <div className="relative flex-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-3.5 h-5 w-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                    <input
                                                        type="text"
                                                        placeholder="Search recipes..."
                                                        className="w-full pl-10 pr-4 py-3 bg-[var(--input-bg)] border border-transparent focus:border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder-[var(--text-muted)] text-[var(--text-main)] transition-all"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                    />
                                                </div>
                                                <div className="relative w-full md:w-36">
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none z-10">
                                                        <span className="text-[10px] font-bold opacity-70">Max Cal</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        placeholder="Any"
                                                        min="0"
                                                        className="w-full pl-20 pr-3 py-3 bg-[var(--input-bg)] border border-transparent focus:border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder-[var(--text-muted)] text-[var(--text-main)] transition-all"
                                                        value={maxCalories}
                                                        onChange={(e) => setMaxCalories(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                                {['all', 'breakfast', 'main meal', 'snack', 'light meal'].map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setActiveFilter(type)}
                                                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${activeFilter === type
                                                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                                            : 'bg-charcoal/5 dark:bg-white/5 text-[var(--text-secondary)] hover:bg-charcoal/10 dark:hover:bg-white/10'
                                                            } `}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* List */}
                                        <div className="overflow-y-auto p-4 flex-1 bg-transparent">
                                            <div className="grid gap-3">
                                                {filteredRecipes.length === 0 ? (
                                                    <div className="text-center py-16 text-[var(--text-secondary)]">
                                                        <p className="font-medium">No matching recipes found.</p>
                                                        <p className="text-xs mt-2">Try the "Eat Out / Quick Add" tab for manual entries.</p>
                                                    </div>
                                                ) : (
                                                    filteredRecipes.map(recipe => (
                                                        <button
                                                            key={recipe.id}
                                                            onClick={() => executeAddMeal(recipe)}
                                                            className="flex items-center gap-4 p-2 rounded-xl bg-[var(--card-bg)] border border-border hover:border-primary hover:shadow-md transition-all text-left group"
                                                        >
                                                            <div className={`w - 20 h - 20 rounded - lg overflow - hidden flex - shrink - 0 relative flex items - center justify - center ${getRecipeTheme(recipe.tags).bg} `}>
                                                                {recipe.image ? (
                                                                    <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className={`text - 3xl font - bold opacity - 50 ${getRecipeTheme(recipe.tags).text} `}>
                                                                        {(recipe.name || 'R').charAt(0)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0 py-1">
                                                                <h4 className="font-bold text-lg text-[var(--text-main)] truncate font-serif">{recipe.name}</h4>
                                                                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-sans mt-0.5">
                                                                    <span className="bg-charcoal/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-bold">{recipe.tags[0] || 'Meal'}</span>
                                                                    <span className="font-medium">{recipe.calories} kcal</span>
                                                                </div>
                                                            </div>
                                                            <div className="pr-2">
                                                                <div className={`w - 8 h - 8 rounded - full border flex items - center justify - center transition - all ${swapIndex !== null ? 'bg-main text-surface border-main' : 'border-border text-charcoal/60 dark:text-stone-400 group-hover:border-primary group-hover:text-primary'} `}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                                </div>
                                                            </div>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : modalTab === 'custom' ? (
                                    <div className="p-8 flex flex-col gap-6 bg-transparent flex-1 overflow-y-auto">
                                        <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-border shadow-sm">
                                            <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Meal Name / Restaurant</label>
                                            <input
                                                type="text"
                                                className="w-full p-4 bg-[var(--input-bg)] border border-transparent focus:border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-[var(--text-main)] placeholder-muted"
                                                placeholder="e.g. Pizza Express, Caesar Salad..."
                                                value={customName}
                                                onChange={e => setCustomName(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-border shadow-sm">
                                                <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Estimated Calories</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-4 bg-[var(--input-bg)] border border-transparent focus:border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-[var(--text-main)]"
                                                    placeholder="0"
                                                    value={customCalories}
                                                    onChange={e => setCustomCalories(e.target.value)}
                                                />
                                            </div>
                                            <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-border shadow-sm">
                                                <label className="block text-sm font-bold text-[var(--text-main)] mb-2">Meal Type</label>
                                                <select
                                                    className="w-full p-4 bg-[var(--input-bg)] border border-transparent focus:border-border rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-[var(--text-main)]"
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
                                        <p className="text-center text-xs text-[var(--text-secondary)]">Custom meals are added to this day's plan but not saved to your library.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-y-auto p-4 flex-1 bg-transparent">
                                        <div className="grid gap-3">
                                            {leftoverCandidates.length === 0 ? (
                                                <div className="text-center py-16 text-[var(--text-secondary)]">
                                                    <p className="font-medium">No meals found from the last 3 days.</p>
                                                    <p className="text-xs mt-2">Plan meals for previous days to see them here.</p>
                                                </div>
                                            ) : (
                                                leftoverCandidates.map(({ date, recipe }, idx) => (
                                                    <button
                                                        key={`${date} -${recipe.id} -${idx} `}
                                                        onClick={() => executeAddMeal({
                                                            ...recipe,
                                                            isLeftover: true,
                                                            originalRecipeId: recipe.originalRecipeId || recipe.id,
                                                            id: crypto.randomUUID()
                                                        })}
                                                        className="flex items-center gap-5 p-3 rounded-xl bg-[var(--card-bg)] border border-border hover:border-primary hover:shadow-md transition-all text-left group w-full overflow-hidden"
                                                    >
                                                        <div className={`w - 20 h - 20 rounded - lg overflow - hidden flex - shrink - 0 relative flex items - center justify - center ${getRecipeTheme(recipe.tags).bg} `}>
                                                            {recipe.image ? (
                                                                <img src={recipe.image} alt={recipe.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className={`text - 3xl font - bold opacity - 50 ${getRecipeTheme(recipe.tags).text} `}>
                                                                    {(recipe.name || 'R').charAt(0)}
                                                                </div>
                                                            )}
                                                            <div className="absolute top-1 right-1 bg-surface dark:bg-black/50 rounded-full p-1">
                                                                <span className="text-xs">♻️</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0 py-1">
                                                            <h4 className="text-lg text-[var(--text-main)] truncate font-display font-extrabold">{recipe.name}</h4>
                                                            <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mb-2 font-sans">
                                                                Leftover from {new Date(date).toLocaleDateString(undefined, { weekday: 'long' })}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-primary">{recipe.calories} kcal</span>
                                                            </div>
                                                        </div>
                                                        <div className="pr-2">
                                                            <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center transition-all text-muted dark:text-muted group-hover:border-primary group-hover:text-primary">
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
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
                            className="fixed inset-0 z-[110] flex items-center justify-center bg-stone-900/40 px-4"
                            onClick={() => setShowConfigModal(false)}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-[var(--card-bg)] p-6 rounded-3xl shadow-xl w-full max-w-sm relative border border-border"
                            >
                                <div className={`w - 16 h - 16 mx - auto rounded - 2xl mb - 4 flex items - center justify - center text - 3xl font - bold shadow - sm ${getRecipeTheme(pendingRecipe.tags).bg} ${getRecipeTheme(pendingRecipe.tags).text} `}>
                                    {pendingRecipe.image ? (
                                        <img src={pendingRecipe.image} alt="" className="w-full h-full object-cover rounded-2xl" />
                                    ) : (
                                        (pendingRecipe.name || 'M').charAt(0)
                                    )}
                                </div>
                                <h3 className="text-xl text-[var(--text-main)] font-display font-extrabold leading-tight">{pendingRecipe.name}</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">Configure serving size</p>
                                <div className="bg-[var(--surface)] rounded-2xl p-6 border border-border mb-6">
                                    <label className="block text-center text-xs font-bold text-[var(--text-secondary)] mb-4">Cooking For</label>
                                    <div className="flex items-center justify-center gap-6">
                                        <button
                                            onClick={() => setCookingServings(Math.max(1, cookingServings - 1))}
                                            className="w-12 h-12 rounded-full bg-[var(--input-bg)] border border-border hover:border-primary hover:text-primary flex items-center justify-center transition-all active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>

                                        <div className="text-center w-16">
                                            <span className="text-4xl font-bold text-[var(--text-main)] block leading-none">{cookingServings}</span>
                                            <span className="text-[10px] text-[var(--text-secondary)] font-bold">People</span>
                                        </div>

                                        <button
                                            onClick={() => setCookingServings(cookingServings + 1)}
                                            className="w-12 h-12 rounded-full bg-[var(--input-bg)] border border-border hover:border-primary hover:text-primary flex items-center justify-center transition-all active:scale-95"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                    </div>
                                    <div className="mt-4 text-center">
                                        <span className="text-xs text-[var(--text-secondary)] bg-[var(--input-bg)] px-2 py-1 rounded border border-border">
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


            <BatchPlannerModal
                isOpen={showBatchPlanner}
                onClose={() => setShowBatchPlanner(false)}
                mode="manual"
            />
        </div >
    );
};