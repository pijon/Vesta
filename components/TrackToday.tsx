import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DayPlan, UserStats, DailyLog, Recipe, FoodLogItem, WorkoutItem, FastingState, FastingConfig, AppView, DailySummary } from '../types';
import { saveDayPlan, saveDailyLog, getDailySummaries } from '../services/storageService';
import { FoodEntryModal } from './FoodEntryModal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { WorkoutEntryModal } from './WorkoutEntryModal';
import { dayTarget, isFastDay, mealKey, planMeal, slotFor } from '../utils/planUtils';
import { DualTrackSection } from './DualTrackSection';
import { HearthWidget } from './HearthWidget';
import { TomorrowCard } from './TomorrowCard';
import { useNavigate } from 'react-router-dom';
import { frequentFoodsData, FrequentFood } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { weightSummary } from '../utils/analyticsModel';
import { ActivityCard, FastingCard, HydrationCard, WeightCard } from './BentoGrid';
import { WorkoutOverviewModal } from './WorkoutOverviewModal';
// import { MobileActionCards } from './MobileActionCards';
// Lazy load RecipeLibrary
const RecipeLibrary = React.lazy(() => import('./RecipeLibrary').then(module => ({ default: module.RecipeLibrary })));
import { Portal } from './Portal';
import { useAchievements } from '../hooks/useAchievements';
import { analyzeWeightTrends, analyzeActivityStreaks } from '../utils/analytics';

import { saveUserStats } from '../services/storageService';
import { localDateString } from '../utils/dateUtils';

interface TrackTodayProps {
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
  fastingState: FastingState;
  onUpdateStats: (stats: UserStats) => void;
  onLogMeal: (meal: Recipe, isAdding: boolean) => Promise<void>;
  onAddFoodLogItems: (items: FoodLogItem[]) => Promise<void>;
  onUpdateFoodItem: (item: FoodLogItem) => Promise<void>;
  onDeleteFoodItem: (itemId: string) => Promise<void>;
  onAddWorkout: (workout: WorkoutItem) => Promise<void>;
  onUpdateWorkout: (workout: WorkoutItem) => Promise<void>;
  onDeleteWorkout: (workoutId: string) => Promise<void>;
  onUpdateFastingConfig: (config: FastingConfig) => Promise<void>;
  refreshData: () => void;
  onNavigate: (view: AppView) => void;
  onOpenFoodModal: () => void;
  onOpenWorkoutModal: (workout?: WorkoutItem) => void;
  onOpenWeightModal: () => void;
  onAddWater: (amount: number) => Promise<void>;
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

  const navigate = useNavigate();
  const [quickWeightInput, setQuickWeightInput] = useState(stats.currentWeight.toString());
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isWorkoutOverviewOpen, setIsWorkoutOverviewOpen] = useState(false);
  // const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]); // Moved to App.tsx

  // Meal Swap State
  const [isMealSelectorOpen, setIsMealSelectorOpen] = useState(false);
  const [activeMealIndexToSwap, setActiveMealIndexToSwap] = useState<number | null>(null);

  // useEffect for recent workouts moved to App.tsx

  // Hydration state removed - using dailyLog.waterIntake directly
  // const [hydration, setHydration] = useState(dailyLog.waterIntake || 0);
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
        const data = await getDailySummaries(90);
        setActivityHistory(data);
      } catch (e) {
        console.error("Failed to load activity history", e);
      }
    };
    loadHistory();
  }, [dailyLog.workouts]); // Reload when workouts change

  // Merge current dailyLog into activityHistory for accurate real-time streak
  const effectiveHistory = React.useMemo(() => {
    // Create a map from history for easy lookup/override
    const historyMap = new Map<string, DailySummary>(activityHistory.map(s => [s.date, s]));

    // Create summary from current dailyLog to ensure "Today" is up to date
    const todaySummary: DailySummary = {
      date: dailyLog.date,
      caloriesConsumed: (dailyLog.items || []).reduce((sum, item) => sum + item.calories, 0),
      caloriesBurned: (dailyLog.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0),
      netCalories: 0, // Calculated below
      workoutCount: (dailyLog.workouts || []).length,
      waterIntake: dailyLog.waterIntake,
      maxFastingHours: dailyLog.maxFastingHours
    };
    todaySummary.netCalories = todaySummary.caloriesConsumed - todaySummary.caloriesBurned;

    // Override/Add today's summary
    historyMap.set(dailyLog.date, todaySummary);

    // Return sorted array (descending by date)
    return Array.from(historyMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activityHistory, dailyLog]);

  useEffect(() => {
    setQuickWeightInput(stats.currentWeight.toString());
  }, [stats.currentWeight]);

  // useEffect syncing hydration removed - relying on dailyLog prop


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
  const isNonFastDay = !isFastDay(todayPlan);
  const dailyTarget = dayTarget(todayPlan, stats);

  const handleAddWaterClick = (amount: number) => {
    // Direct prop call - Parent updates dailyLog which re-renders this component
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
    const uniqueId = mealKey(meal);
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
    await onLogMeal(meal, isAdding);
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
    const updatedCompletedIds = todayPlan.completedMealIds.filter(id => id !== mealKey(oldMeal));

    newMeals[activeMealIndexToSwap] = planMeal(recipe, slotFor(oldMeal), {
      familyDinner: oldMeal.familyDinner,
      cookingServings: oldMeal.cookingServings,
    });

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
  const today = localDateString();
  const weightLoggedToday = stats.weightHistory.some(entry => entry.date === today);

  // Weight tile: same trend as Analytics (last month), and the change since the previous weigh-in
  const weightInfo = React.useMemo(() => {
    const history = [...(stats.weightHistory || [])].filter(e => e.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
    const last = history[history.length - 1];
    const previous = history[history.length - 2];
    return {
      current: last ? last.weight : null,
      lastDate: last ? last.date : null,
      sinceLast: last && previous ? last.weight - previous.weight : null,
      ratePerWeek: weightSummary(history, 30, stats.goalWeight).ratePerWeek,
    };
  }, [stats.weightHistory, stats.goalWeight]);

  // One-tap re-logging of frequent foods, with undo
  const frequentFoods = usePrewarmed(frequentFoodsData) ?? [];
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const handleQuickLog = async (food: FrequentFood) => {
    const item: FoodLogItem = { id: crypto.randomUUID(), name: food.name, calories: food.calories, timestamp: Date.now() };
    await onAddFoodLogItems([item]);
    setToast({ message: `Logged ${food.name} · ${food.calories} kcal`, undo: () => { onDeleteFoodItem(item.id); } });
  };

  // Helper to format hours into string
  const formatFastingTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours % 1) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-8">
      {/* Today: one hero block, then metric tiles */}
      <div className="space-y-3">
        <HearthWidget
          caloriesGoal={dailyTarget}
          caloriesEaten={consumed}
          caloriesBurned={caloriesBurned}
          isFastDay={!isNonFastDay}
          onLogFood={onOpenFoodModal}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <HydrationCard
            liters={(dailyLog.waterIntake || 0) / 1000}
            goal={stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5}
            onAddWater={(amount) => handleAddWaterClick(amount)}
          />
          <WeightCard
            weight={weightInfo.current}
            ratePerWeek={weightInfo.ratePerWeek}
            sinceLast={weightInfo.sinceLast}
            lastDate={weightInfo.lastDate}
            history={stats.weightHistory || []}
            onAddWeight={onOpenWeightModal}
            onClick={() => onNavigate(AppView.ANALYTICS)}
          />
          <ActivityCard
            caloriesBurned={caloriesBurned}
            workoutsCompleted={(dailyLog.workouts || []).length}
            workoutsGoal={stats.dailyWorkoutCountGoal || 1}
            history={effectiveHistory}
            onAddWorkout={() => onOpenWorkoutModal()}
            onClick={() => setIsWorkoutOverviewOpen(true)}
            streak={analyzeActivityStreaks(effectiveHistory).currentStreak}
          />
          <FastingCard
            elapsedHours={elapsedFastingHours}
            targetHours={fastingState.config.targetFastHours}
            lastAteTime={fastingState.lastAteTime}
          />
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
        caloriesLeft={dailyTarget - consumed + caloriesBurned}
        frequentFoods={frequentFoods}
        onQuickLog={handleQuickLog}
        onLogFood={onOpenFoodModal}
      />

      {/* Tomorrow */}
      <TomorrowCard plan={tomorrowPlan} stats={stats} onPlan={() => navigate('/mealplanner', { state: { date: tomorrowPlan.date } })} />

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] flex items-center gap-3 badge-ink !rounded-full pl-4 pr-1.5 py-1.5 text-sm font-semibold shadow-[var(--elev-md)] animate-fade-in max-w-[calc(100vw-32px)]">
          <span className="truncate">{toast.message}</span>
          {toast.undo && (
            <button onClick={() => { toast.undo!(); setToast(null); }} className="shrink-0 min-h-8 px-3 rounded-full bg-on-ink/15 hover:bg-on-ink/25 font-semibold">Undo</button>
          )}
        </div>
      )}

      {/* Modals - Removed inline, managed by App.tsx */}
      {/* FoodEntryModal, WorkoutEntryModal, WeightEntryModal removed */}

      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      <WorkoutOverviewModal
        isOpen={isWorkoutOverviewOpen}
        onClose={() => setIsWorkoutOverviewOpen(false)}
        history={effectiveHistory}
        todayWorkouts={dailyLog.workouts || []}
        streak={analyzeActivityStreaks(effectiveHistory).currentStreak}
      />

      {isMealSelectorOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 px-4 py-4 animate-fade-in" onClick={() => setIsMealSelectorOpen(false)}>
            <div className="bg-stone-50 dark:bg-background w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden h-[90vh] flex flex-col scale-100 animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-6 border-b border-border bg-surface dark:bg-white/5 shrink-0">
                <h2 className="text-2xl text-charcoal dark:text-stone-200 font-display font-extrabold">Swap Meal</h2>
                <button
                  onClick={() => setIsMealSelectorOpen(false)}
                  className="p-2 bg-surface dark:bg-white/5 border border-border rounded-full text-muted dark:text-muted hover:text-charcoal dark:text-stone-200 transition-colors"
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
