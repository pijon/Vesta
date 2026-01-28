import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DayPlan, UserStats, DailyLog, Recipe, FoodLogItem, WorkoutItem, FastingState, FastingConfig, AppView, DailySummary } from '../types';
import { saveDayPlan, saveDailyLog, getAllDailySummaries } from '../services/storageService';
import { FoodEntryModal } from './FoodEntryModal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { WorkoutEntryModal } from './WorkoutEntryModal';
import { DualTrackSection } from './DualTrackSection';
import { HearthWidget } from './HearthWidget';
import { ActivityCard, FastingCard, HydrationCard, WeightCard, CaloriesRemainingCard } from './BentoGrid';
// import { MobileActionCards } from './MobileActionCards';
// Lazy load RecipeLibrary
const RecipeLibrary = React.lazy(() => import('./RecipeLibrary').then(module => ({ default: module.RecipeLibrary })));
import { Portal } from './Portal';
import { useAchievements } from '../hooks/useAchievements';
import { analyzeWeightTrends } from '../utils/analytics';

import { saveUserStats } from '../services/storageService';

interface TrackTodayProps {
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
  fastingState: FastingState;
  onUpdateStats: (stats: UserStats) => void;
  onLogMeal: (meal: Recipe, isAdding: boolean) => void;
  onAddFoodLogItems: (items: FoodLogItem[]) => void;
  onUpdateFoodItem: (item: FoodLogItem) => void;
  onDeleteFoodItem: (itemId: string) => void;
  onAddWorkout: (workout: WorkoutItem) => void;
  onUpdateWorkout: (workout: WorkoutItem) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onUpdateFastingConfig: (config: FastingConfig) => void;
  refreshData: () => void;
  onNavigate: (view: AppView) => void;
  // New props for global modals
  onOpenFoodModal: () => void;
  onOpenWorkoutModal: (workout?: WorkoutItem) => void;
  onOpenWeightModal: () => void;
  onAddWater: (amount: number) => void;
}

export const TrackToday: React.FC<TrackTodayProps> = ({
  todayPlan,
  tomorrowPlan,
  stats,
  dailyLog,
  fastingState,
  onUpdateStats,
  onLogMeal,
  onAddFoodLogItems,
  onUpdateFoodItem,
  onDeleteFoodItem,
  onAddWorkout,
  onUpdateWorkout,
  onDeleteWorkout,
  onUpdateFastingConfig,
  refreshData,
  onNavigate,
  onOpenFoodModal,
  onOpenWorkoutModal,
  onOpenWeightModal,
  onAddWater
}) => {
  // Removed local modal state
  // const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  // const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  // const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  // const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);

  const [quickWeightInput, setQuickWeightInput] = useState(stats.currentWeight.toString());
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  // const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]); // Moved to App.tsx

  // Meal Swap State
  const [isMealSelectorOpen, setIsMealSelectorOpen] = useState(false);
  const [activeMealIndexToSwap, setActiveMealIndexToSwap] = useState<number | null>(null);

  // useEffect for recent workouts moved to App.tsx

  // Hydration state
  const [hydration, setHydration] = useState(dailyLog.waterIntake || 0);
  const [activityHistory, setActivityHistory] = useState<DailySummary[]>([]);

  // Fasting Live Timer State
  const [elapsedFastingHours, setElapsedFastingHours] = useState(0);

  useEffect(() => {
    // Initial calculation
    const calculateFasting = () => {
      if (fastingState.lastAteTime) {
        const lastAte = new Date(fastingState.lastAteTime).getTime();
        const now = Date.now();
        const diffMs = now - lastAte;
        const hours = diffMs / (1000 * 60 * 60);
        setElapsedFastingHours(hours);
      } else {
        setElapsedFastingHours(0);
      }
    };

    calculateFasting();

    // Update every minute
    const interval = setInterval(calculateFasting, 60000);
    return () => clearInterval(interval);
  }, [fastingState.lastAteTime]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await getAllDailySummaries(7);
        setActivityHistory(data);
      } catch (e) {
        console.error("Failed to load activity history", e);
      }
    };
    loadHistory();
  }, [dailyLog.workouts]); // Reload when workouts change

  useEffect(() => {
    setQuickWeightInput(stats.currentWeight.toString());
  }, [stats.currentWeight]);

  useEffect(() => {
    setHydration(dailyLog.waterIntake || 0);
  }, [dailyLog.waterIntake]);

  // Achievements Hook - kept for streak calculation logic mainly, though DailyGoalsWidget is gone
  // We can use the progress object if needed for advanced badges in future
  const { progress } = useAchievements(dailyLog, fastingState, stats, onUpdateStats);

  // Calculate calories
  const consumed = (dailyLog.items || []).reduce((sum, item) => sum + item.calories, 0);
  const caloriesBurned = (dailyLog.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);

  // Calculate weekly weight change
  const calculateWeightChange = () => {
    if (!stats.weightHistory || stats.weightHistory.length < 2) return 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoMs = oneWeekAgo.getTime();

    // Find entry closest to 7 days ago
    const relevantPastEntry = stats.weightHistory.reduce((prev, curr) => {
      const prevDiff = Math.abs(new Date(prev.date).getTime() - oneWeekAgoMs);
      const currDiff = Math.abs(new Date(curr.date).getTime() - oneWeekAgoMs);
      return currDiff < prevDiff ? curr : prev;
    });

    // If the closest entry is too far (e.g. > 14 days), maybe just return 0 or calculate from that point
    // For now, simple diff
    const diff = stats.currentWeight - relevantPastEntry.weight;
    return parseFloat(diff.toFixed(1));
  };

  const weightChange = calculateWeightChange();
  const weightAnalysis = analyzeWeightTrends(stats);

  // Determine Daily Target based on Day Type
  const isNonFastDay = todayPlan.type === 'non-fast';
  const dailyTarget = isNonFastDay ? (stats.nonFastDayCalories || 2000) : stats.dailyCalorieGoal;

  const handleAddWaterClick = (amount: number) => {
    // Local optimisitic update if needed, but App.tsx handles persist
    setHydration(hydration + amount);
    onAddWater(amount);
  };

  // handleAddWater and handleSetWater removed/replaced by prop



  const handleEditWorkout = (workout: WorkoutItem) => {
    onOpenWorkoutModal(workout);
  };

  const toggleMeal = async (mealIndex: number) => {
    const meal = todayPlan.meals[mealIndex];
    if (!meal) return;

    let newCompleted = [...todayPlan.completedMealIds];
    const uniqueId = meal.id;
    let isAdding = false;

    if (newCompleted.includes(uniqueId)) {
      newCompleted = newCompleted.filter(id => id !== uniqueId);
      isAdding = false;
    } else {
      newCompleted.push(uniqueId);
      isAdding = true;
    }

    const updatedPlan = { ...todayPlan, completedMealIds: newCompleted };
    await saveDayPlan(updatedPlan);
    onLogMeal(meal, isAdding);
    refreshData();
  };

  const handleSwapMeal = (index: number) => {
    setActiveMealIndexToSwap(index);
    setIsMealSelectorOpen(true);
  };

  const handleMealSelected = async (recipe: Recipe) => {
    if (activeMealIndexToSwap === null) return;
    const newMeals = [...todayPlan.meals];
    const oldMeal = newMeals[activeMealIndexToSwap];
    const updatedCompletedIds = todayPlan.completedMealIds.filter(id => id !== oldMeal.id);

    newMeals[activeMealIndexToSwap] = {
      ...recipe,
      id: recipe.id
    };

    const updatedPlan: DayPlan = {
      ...todayPlan,
      meals: newMeals,
      completedMealIds: updatedCompletedIds
    };

    await saveDayPlan(updatedPlan);
    setIsMealSelectorOpen(false);
    setActiveMealIndexToSwap(null);
    refreshData();
  };

  // Check if weight was logged today
  const today = new Date().toISOString().split('T')[0];
  const weightLoggedToday = stats.weightHistory.some(entry => entry.date === today);

  // Helper to format hours into string
  const formatFastingTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-8">
      {/* Mobile: 2x2 Grid of Rich Widgets */}
      <div className="md:hidden grid grid-cols-2 gap-3 mb-6">
        <CaloriesRemainingCard
          caloriesRemaining={dailyTarget - consumed + caloriesBurned}
          caloriesGoal={dailyTarget}
          size="sm"
          onLogFood={onOpenFoodModal}
        />
        <ActivityCard
          caloriesBurned={caloriesBurned}
          workoutsCompleted={(dailyLog.workouts || []).length}
          workoutsGoal={stats.dailyWorkoutCountGoal || 1}
          history={activityHistory}
          onAddWorkout={() => onOpenWorkoutModal()}
          size="sm"
        />
        <HydrationCard
          liters={hydration / 1000}
          goal={stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5}
          onAddWater={(amount) => handleAddWaterClick(amount)}
          size="sm"
        />
        <WeightCard
          weight={stats.currentWeight}
          change={weightChange}
          history={stats.weightHistory || []}
          daysToGoal={weightAnalysis.daysToGoal}
          onAddWeight={onOpenWeightModal}
          size="sm"
        />
        <FastingCard
          elapsedString={formatFastingTime(elapsedFastingHours)}
          startTime={fastingState.lastAteTime ? new Date(fastingState.lastAteTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
          isFasting={!!fastingState.lastAteTime}
          progressPercent={Math.min((elapsedFastingHours / fastingState.config.targetFastHours) * 100, 100)}
          size="sm"
        />
        <HearthWidget
          caloriesRemaining={dailyTarget - consumed + caloriesBurned}
          caloriesTotal={consumed}
          caloriesGoal={dailyTarget}
          waterLiters={hydration / 1000}
          waterGoal={stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5}
          fastingHours={elapsedFastingHours}
          fastingGoal={fastingState.config.targetFastHours}
          size="sm"
        />
      </div>

      {/* Desktop: Hero Stats - Unified Bento Grid */}
      <div className="hidden md:block space-y-6">
        {/* Header Section Removed - Global Header */}

        <div className="flex gap-8 items-start">
          {/* Left: Hearth Widget (Main Focus) */}
          <div className="flex-none">
            <HearthWidget
              caloriesRemaining={dailyTarget - consumed + caloriesBurned}
              caloriesTotal={consumed}
              caloriesGoal={dailyTarget}
              waterLiters={hydration / 1000}
              waterGoal={stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5}
              fastingHours={elapsedFastingHours}
              fastingGoal={fastingState.config.targetFastHours}
            />
          </div>

          {/* Right: Bento Grid */}
          <div className="flex-1 grid grid-cols-2 gap-6">
            <ActivityCard
              caloriesBurned={caloriesBurned}
              workoutsCompleted={(dailyLog.workouts || []).length}
              workoutsGoal={stats.dailyWorkoutCountGoal || 1}
              history={activityHistory}
              onAddWorkout={() => onOpenWorkoutModal()}
            />
            <div className="grid grid-cols-2 gap-4">
              <CaloriesRemainingCard
                caloriesRemaining={dailyTarget - consumed + caloriesBurned}
                caloriesGoal={dailyTarget}
                size="sm"
                onLogFood={onOpenFoodModal}
              />
              <FastingCard
                elapsedString={formatFastingTime(elapsedFastingHours)}
                startTime={fastingState.lastAteTime ? new Date(fastingState.lastAteTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                isFasting={!!fastingState.lastAteTime}
                progressPercent={Math.min((elapsedFastingHours / fastingState.config.targetFastHours) * 100, 100)}
                size="sm"
              />
            </div>
            <HydrationCard
              liters={hydration / 1000}
              goal={stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5}
              onAddWater={(amount) => handleAddWaterClick(amount)}
            />
            <WeightCard
              weight={stats.currentWeight}
              change={weightChange}
              history={stats.weightHistory || []}
              daysToGoal={weightAnalysis.daysToGoal}
              onAddWeight={onOpenWeightModal}
            />

          </div>
        </div>
      </div>

      {/* Dual-Track Section */}
      <DualTrackSection
        todayPlan={todayPlan}
        dailyLog={dailyLog}
        lastAteTime={fastingState.lastAteTime}
        onToggleMeal={toggleMeal}
        onViewRecipe={setSelectedRecipe}
        onEditWorkout={handleEditWorkout}
        onDeleteWorkout={onDeleteWorkout}
        onUpdateFoodItem={onUpdateFoodItem}
        onDeleteFoodItem={onDeleteFoodItem}
        onNavigate={onNavigate}
        onSwapMeal={handleSwapMeal}
      />

      {/* Tomorrow's Preview */}
      <div className="hidden md:block glass-card rounded-organic-md overflow-hidden">
        <div className="px-6 py-5 border-b border-white/50 dark:border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-calories-bg flex items-center justify-center text-hearth">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <h3 className="font-serif text-lg text-charcoal dark:text-stone-200">Tomorrow's Plan</h3>
            <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 dark:text-stone-400 bg-white/50 dark:bg-white/10 px-2 py-1 rounded-md border border-white/20 dark:border-white/10 ml-2">
              {tomorrowPlan.meals.reduce((acc, m) => acc + m.calories, 0)} kcal
            </span>
          </div>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tomorrowPlan.meals.length === 0 ? (
            <div className="col-span-full p-8 text-center text-charcoal/60 dark:text-stone-400 dark:text-stone-500 border border-dashed border-charcoal/10 dark:border-white/10 rounded-xl bg-white/20 dark:bg-white/5">
              <p className="font-medium">No meals planned for tomorrow</p>
            </div>
          ) : (
            tomorrowPlan.meals.map((meal, index) => (
              <div
                key={index}
                className="p-4 rounded-xl border border-white/40 dark:border-white/5 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-white/10 hover:shadow-md transition-all group"
              >
                <p className="font-medium text-charcoal dark:text-stone-200 dark:text-stone-200 truncate">{meal.name}</p>
                <div className="flex gap-2 items-center mt-2">
                  <span className="text-[10px] font-bold text-hearth bg-calories-bg px-1.5 py-0.5 rounded uppercase tracking-wide">
                    {meal.type}
                  </span>
                  <span className="text-xs text-charcoal/60 dark:text-stone-400 dark:text-stone-400">{meal.calories} kcal</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals - Removed inline, managed by App.tsx */}
      {/* FoodEntryModal, WorkoutEntryModal, WeightEntryModal removed */}

      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {isMealSelectorOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--stone-900)]/60 backdrop-blur-sm px-4 py-4 animate-fade-in" onClick={() => setIsMealSelectorOpen(false)}>
            <div className="bg-white dark:bg-white/5 w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden h-[90vh] flex flex-col scale-100 animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-6 border-b border-border bg-white dark:bg-white/5 shrink-0">
                <h2 className="text-2xl font-bold text-charcoal dark:text-stone-200 font-serif">Swap Meal</h2>
                <button
                  onClick={() => setIsMealSelectorOpen(false)}
                  className="p-2 bg-white dark:bg-white/5 border border-border rounded-full text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:text-stone-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <React.Suspense fallback={<div className="p-8 text-center">Loading recipes...</div>}>
                  <RecipeLibrary onSelect={handleMealSelected} />
                </React.Suspense>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Portal for Meal Selector Only */}
      {/* Weight Portal moved to App.tsx */}
    </div>
  );
};
