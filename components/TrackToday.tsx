import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DayPlan, UserStats, DailyLog, Recipe, FoodLogItem, WorkoutItem, FastingState, FastingConfig, AppView } from '../types';
import { saveDayPlan, saveDailyLog } from '../services/storageService';
import { FoodEntryModal } from './FoodEntryModal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { WorkoutEntryModal } from './WorkoutEntryModal';
import { DualTrackSection } from './DualTrackSection';
import { HydrationWidget } from './HydrationWidget';
import { FastingWidget } from './FastingWidget';
import { RecipeLibrary } from './RecipeLibrary';
import { Portal } from './Portal';

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
  onStartFast: () => void;
  onEndFast: () => void;
  onUpdateFastingConfig: (config: FastingConfig) => void;
  refreshData: () => void;
  onNavigate: (view: AppView) => void;
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
  onStartFast,
  onEndFast,
  onUpdateFastingConfig,
  refreshData,
  onNavigate
}) => {
  // const [weightInput, setWeightInput] = useState(stats.currentWeight.toString()); // Removed inline editing
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);
  const [healthTrackersExpanded, setHealthTrackersExpanded] = useState(false);
  const [tomorrowExpanded, setTomorrowExpanded] = useState(false);
  const [quickWeightInput, setQuickWeightInput] = useState(stats.currentWeight.toString());
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]);

  // Meal Swap State
  const [isMealSelectorOpen, setIsMealSelectorOpen] = useState(false);
  const [activeMealIndexToSwap, setActiveMealIndexToSwap] = useState<number | null>(null);

  useEffect(() => {
    // Load recent workouts for suggestion
    const loadRecents = async () => {
      // Dynamic import to avoid cycles? or just standard import
      const { getRecentWorkouts } = await import('../services/storageService');
      const recents = await getRecentWorkouts(5);
      setRecentWorkouts(recents);
    };
    loadRecents();
  }, [dailyLog.workouts]); // Reload when workouts change

  // Hydration state
  const [hydration, setHydration] = useState(dailyLog.waterIntake || 0);

  useEffect(() => {
    // setWeightInput(stats.currentWeight.toString()); // Removed inline editing
    setQuickWeightInput(stats.currentWeight.toString());
  }, [stats.currentWeight]);

  useEffect(() => {
    setHydration(dailyLog.waterIntake || 0);
  }, [dailyLog.waterIntake]);

  // Calculate calories
  const consumed = (dailyLog.items || []).reduce((sum, item) => sum + item.calories, 0);
  const caloriesBurned = (dailyLog.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);
  const netCalories = consumed - caloriesBurned;

  // Determine Daily Target based on Day Type
  const isNonFastDay = todayPlan.type === 'non-fast';
  const dailyTarget = isNonFastDay ? (stats.nonFastDayCalories || 2000) : stats.dailyCalorieGoal;

  const percentage = Math.min(100, (consumed / dailyTarget) * 100);

  // const handleSaveWeight = () => { ... } // Removed inline editing


  const handleQuickWeightSave = () => {
    const w = parseFloat(quickWeightInput);
    if (w > 0) {
      onUpdateStats({ ...stats, currentWeight: w });
      setIsWeightModalOpen(false);
    }
  };

  const handleAddWater = async (amount: number) => {
    const newIntake = hydration + amount;
    setHydration(newIntake);
    const updatedLog = { ...dailyLog, waterIntake: newIntake };
    await saveDailyLog(updatedLog);
    refreshData();
  };

  const handleSetWater = async (amount: number) => {
    setHydration(amount);
    const updatedLog = { ...dailyLog, waterIntake: amount };
    await saveDailyLog(updatedLog);
    refreshData();
  };

  const handleWorkoutSave = (workout: WorkoutItem) => {
    if (editingWorkout) {
      onUpdateWorkout(workout);
    } else {
      onAddWorkout(workout);
    }
    setEditingWorkout(null);
  };

  const handleEditWorkout = (workout: WorkoutItem) => {
    setEditingWorkout(workout);
    setIsWorkoutModalOpen(true);
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

    // Create a new meal object derived from the recipe but with a unique instance ID if needed
    // For simplicity, we just use the recipe structure as the meal.
    // However, if the day plan expects specific structure, we should adhere to it.
    // The `Meal` type usually extends `Recipe`.

    const newMeals = [...todayPlan.meals];
    // We treat the selected recipe as the new meal.
    // Ensure we keep the 'type' (Breakfast/Lunch/etc) if we want to preserve the slot "type",
    // OR we just use the recipe's type? 
    // Usually swapping implies changing the specific dish for that slot.
    // Let's assume we replace the entry.

    // Check if the slot had a specific type (like "Breakfast") and try to preserve it if the recipe has tags?
    // Actually, simply replacing the object at index `activeMealIndexToSwap` is the robust way.

    // IMPORTANT: logic to handle completed status.
    // If we swap a meal, it's a new meal, so it should be uncompleted.
    // So we remove the OLD meal ID from completedMealIds if it was there.

    const oldMeal = newMeals[activeMealIndexToSwap];
    const updatedCompletedIds = todayPlan.completedMealIds.filter(id => id !== oldMeal.id);

    newMeals[activeMealIndexToSwap] = {
      ...recipe,
      // Ensure it has a unique ID if it doesn't (though recipe.id is usually UUID)
      // If we put the same recipe in twice, we might have ID collisions. 
      // Safe to generate a new ID or composite ID?
      // For now, using recipe.id is standard in this app.
      id: recipe.id // keep original ID or generated new one? standard is recipe.id
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

  const startWeight = stats.startWeight;
  const currentWeight = stats.currentWeight;
  const goalWeight = stats.goalWeight;
  const totalToLose = startWeight - goalWeight;
  const lostSoFar = startWeight - currentWeight;
  let progressPercent = 0;
  if (totalToLose > 0) {
    progressPercent = Math.max(0, Math.min(100, (lostSoFar / totalToLose) * 100));
  }

  return (
    <div className="space-y-8">
      {/* Mobile Quick Actions Bar */}
      <div className="md:hidden -mt-4 -mx-4 mb-2 sticky top-16 z-30 bg-surface/95 backdrop-blur-sm border-b border-border p-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleAddWater(250)}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm flex items-center justify-center gap-1.5"
            style={{ backgroundColor: 'var(--water)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
            +250ml
          </button>
          <button
            onClick={() => handleAddWater(500)}
            className="flex-1 py-2.5 text-white rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm flex items-center justify-center gap-1.5"
            style={{ backgroundColor: 'var(--water-hover)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
            +500ml
          </button>
        </div>
      </div>

      {/* Hero Stats - Unified 4-Column Grid */}
      <div className="pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">

          {/* 1. Calories Consumed Card */}
          {/* 1. Calories Consumed Card */}
          {/* 1. Calories Consumed Card */}
          <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex flex-col h-64 relative overflow-hidden group hover:shadow-md transition-all duration-500">
            {/* Decorative gradient orb - Standardized Top-Right */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-emerald-400/5 to-calories/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

            {/* Header */}
            <div className="flex justify-between items-center mb-4 relative z-10">
              <p className="text-muted text-xs font-bold uppercase tracking-widest">Calories</p>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-calories flex items-center justify-center text-white shadow-none dark:shadow-lg dark:shadow-calories/30">
                <svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 1125.628 1125.628" fill="currentColor">
                  <g>
                    <path d="M562.812,0.002C252.476,0.002,0,252.479,0,562.814s252.476,562.812,562.812,562.812 c310.34,0,562.817-252.476,562.817-562.812S873.152,0.002,562.812,0.002z M309.189,739.263l-68.974-101h-17.735v101h-70v-357h70 v203h15.889l57.901-93h77.963l-79.808,111.736l92.036,135.264H309.189z M468.184,672.88c7.299,13.589,20.325,20.382,38.317,20.382 c11.995,0,21.792-3.329,29.023-10.286c7.226-6.952,11.026-14.712,11.026-27.712h61.131l0.69,1.237 c0.612,25.224-8.88,46.258-28.489,63.246c-19.605,16.997-43.942,25.452-73.007,25.452c-37.218,0-65.962-11.781-86.11-35.309 c-20.144-23.529-30.283-53.763-30.283-90.671v-6.925c0-36.753,10.102-66.968,30.169-90.652 c20.071-23.68,48.745-35.524,85.958-35.524c30.76,0,55.57,8.766,74.412,26.297c18.833,17.531,27.954,41.73,27.342,70.334 l-0.453,2.516H546.55c0-14-3.54-24.775-10.611-33.312c-7.075-8.533-16.837-13.365-29.298-13.365 c-17.837,0-31.158,6.628-38.457,20.446c-7.308,13.818-11.703,31.349-11.703,53.151v6.911 C456.481,641.362,460.876,659.29,468.184,672.88z M793.142,739.263c-2.462-4-4.582-11.157-6.345-17.465 c-1.772-6.304-3.038-12.499-3.805-19.113c-6.925,12.15-16.033,22.354-27.338,30.348c-11.301,7.998-24.798,12.061-40.484,12.061 c-26.141,0-46.285-6.691-60.432-20.148c-14.151-13.457-21.222-31.78-21.222-54.998c0-24.456,9.414-43.221,28.256-56.683 c18.833-13.452,46.327-20.003,82.467-20.003h39.242v-20.18c0-11.995-3.974-21.3-10.282-27.914 c-6.303-6.609-16.019-9.917-28.32-9.917c-10.922,0-19.545,2.65-25.465,7.957c-5.92,5.303-8.982,12.648-8.982,22.026l-65.101-0.228 l-0.259-1.384c-1.073-21.066,8.063-39.251,27.44-54.553c19.377-15.302,44.822-22.953,76.349-22.953 c29.832,0,54.075,7.578,72.684,22.72c18.605,15.151,27.938,36.716,27.938,64.703v103.113c0,11.689,0.854,22.156,2.622,32.461 c1.768,10.3,4.55,21.149,8.396,30.149H793.142z M902.481,739.263v-357h70v357H902.481z" />
                    <path d="M711.712,640.846c-7.382,7.153-11.072,16.229-11.072,26.379c0,8.304,2.768,15.211,8.304,20.285 c5.536,5.075,13.069,7.717,22.606,7.717c11.84,0,23.195-2.865,32.422-8.707c9.227-5.847,14.509-12.558,19.509-20.246v-37.012 h-39.242C729.933,629.263,719.093,633.698,711.712,640.846z" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Content Area */}
            <div className="h-28 flex flex-col relative z-10 text-left">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl lg:text-5xl font-bold bg-gradient-to-br from-neutral-800 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent font-serif tracking-tight leading-none">{consumed}</span>
                <span className="text-muted font-semibold text-lg">/ {dailyTarget}</span>
              </div>

              {/* Action Row - Fixed h-8 alignment */}
              {/* Action Row - Fixed h-8 alignment */}
              <div className="flex items-center gap-2 mt-auto h-8">
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border border-transparent shadow-sm transition-colors ${isNonFastDay ? 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100 dark:border-orange-600' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-600'}`}>
                  {isNonFastDay ? 'Non-Fast' : 'Fast Day'}
                </span>
                {caloriesBurned > 0 && (
                  <div className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2.5 py-1 rounded-lg border border-transparent dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-600">
                    <span className="text-[10px] font-bold">-{caloriesBurned} kcal</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar - Always at Bottom */}
            <div className="relative z-10 h-10 mt-auto">
              <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden shadow-inner mt-4">
                <motion.div
                  className={`h-full rounded-full ${consumed > dailyTarget ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-none dark:shadow-lg dark:shadow-emerald-500/30'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-muted font-semibold mt-1.5">
                <span>{dailyTarget - consumed > 0 ? `${dailyTarget - consumed} left` : 'Over limit'}</span>
                <span className="text-muted/80">Net: {netCalories}</span>
              </div>
            </div>
          </div>

          {/* 2. Weight Card */}
          <div className="bg-surface p-6 rounded-3xl shadow-sm border border-border flex flex-col h-64 relative overflow-hidden group hover:shadow-md transition-all duration-500">
            {/* Decorative gradient orb - Standardized Top-Right */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-blue-400/5 to-weight/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

            {/* Header */}
            <div className="flex justify-between items-center mb-4 relative z-10">
              <p className="text-muted text-xs font-bold uppercase tracking-widest">Weight</p>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-weight flex items-center justify-center text-white shadow-none dark:shadow-lg dark:shadow-weight/30">
                <svg fill="currentColor" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19,4H17.55A3.08,3.08,0,0,0,17,3a3,3,0,0,0-2.25-1H9.27A3,3,0,0,0,7,3a3.08,3.08,0,0,0-.57,1H5A3,3,0,0,0,2,7V19a3,3,0,0,0,3,3H19a3,3,0,0,0,3-3V7A3,3,0,0,0,19,4ZM8.52,4.34A1,1,0,0,1,9.27,4h5.46a1,1,0,0,1,.75.34,1,1,0,0,1,.25.78l-.5,4a1,1,0,0,1-1,.88H12.59l1.14-2.4a1,1,0,0,0-1.8-.86L10.37,10h-.6a1,1,0,0,1-1-.88l-.5-4A1,1,0,0,1,8.52,4.34ZM20,19a1,1,0,0,1-1,1H5a1,1,0,0,1-1-1V7A1,1,0,0,1,5,6H6.37l.42,3.37a3,3,0,0,0,3,2.63h4.46a3,3,0,0,0,3-2.63L17.63,6H19a1,1,0,0,1,1,1Zm-6-3H10a1,1,0,0,0,0,2h4a1,1,0,0,0,0-2Z" /></svg>
              </div>
            </div>

            {/* Content Area */}
            <div className="h-28 flex flex-col relative z-10">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl lg:text-5xl font-bold bg-gradient-to-br from-neutral-800 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent font-serif tracking-tight leading-none">
                  {stats.currentWeight}
                </span>
                <span className="text-muted font-semibold text-lg">kg</span>
              </div>

              {/* Action Row - Fixed h-8 alignment */}
              <div className="mt-auto h-8 flex items-center">
                <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg border border-transparent dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-600 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6"></path>
                  </svg>
                  <span className="text-[10px] font-bold">{Math.abs(startWeight - currentWeight).toFixed(1)}kg {startWeight >= currentWeight ? 'lost' : 'gained'}</span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative z-10 h-10 mt-auto">
              <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden shadow-inner mt-4">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full shadow-none dark:shadow-lg dark:shadow-blue-500/30 text-[10px] font-medium"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-xs font-medium text-muted mt-1.5">
                <span>Start: {startWeight}</span>
                <span>Goal: {goalWeight}</span>
              </div>
            </div>
          </div>

          {/* 3. Hydration Widget */}
          <HydrationWidget
            intake={hydration}
            goal={stats.dailyWaterGoal || 2000}
            onAdd={handleAddWater}
            onSet={handleSetWater}
            className="h-full"
          />

          {/* 4. Fasting Widget */}
          <FastingWidget
            fastingState={fastingState}
            onStartFast={onStartFast}
            onEndFast={onEndFast}
            onUpdateConfig={onUpdateFastingConfig}
          />
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="pb-8">
        <div className="flex gap-4 flex-wrap">
          <button
            onClick={() => setIsFoodModalOpen(true)}
            className="flex-1 min-w-[140px] py-3 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--calories)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--calories-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--calories)'}
          >
            <svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 60 60" fill="currentColor">
              <g>
                <path d="M18.35,20.805c0.195,0.195,0.451,0.293,0.707,0.293c0.256,0,0.512-0.098,0.707-0.293c0.391-0.391,0.391-1.023,0-1.414 c-1.015-1.016-1.015-2.668,0-3.684c0.87-0.87,1.35-2.026,1.35-3.256s-0.479-2.386-1.35-3.256c-0.391-0.391-1.023-0.391-1.414,0 s-0.391,1.023,0,1.414c0.492,0.492,0.764,1.146,0.764,1.842s-0.271,1.35-0.764,1.842C16.555,16.088,16.555,19.01,18.35,20.805z" />
                <path d="M40.35,20.805c0.195,0.195,0.451,0.293,0.707,0.293c0.256,0,0.512-0.098,0.707-0.293c0.391-0.391,0.391-1.023,0-1.414 c-1.015-1.016-1.015-2.668,0-3.684c0.87-0.87,1.35-2.026,1.35-3.256s-0.479-2.386-1.35-3.256c-0.391-0.391-1.023-0.391-1.414,0 s-0.391,1.023,0,1.414c0.492,0.492,0.764,1.146,0.764,1.842s-0.271,1.35-0.764,1.842C38.555,16.088,38.555,19.01,40.35,20.805z" />
                <path d="M29.35,14.805c0.195,0.195,0.451,0.293,0.707,0.293c0.256,0,0.512-0.098,0.707-0.293c0.391-0.391,0.391-1.023,0-1.414 c-1.015-1.016-1.015-2.668,0-3.684c0.87-0.87,1.35-2.026,1.35-3.256s-0.479-2.386-1.35-3.256c-0.391-0.391-1.023-0.391-1.414,0 s-0.391,1.023,0,1.414c0.492,0.492,0.764,1.146,0.764,1.842s-0.271,1.35-0.764,1.842C27.555,10.088,27.555,13.01,29.35,14.805z" />
                <path d="M25.345,28.61c0.073,0,0.147-0.008,0.221-0.024c1.438-0.324,2.925-0.488,4.421-0.488c0.004,0,0.008,0,0.013,0h0 c0.552,0,1-0.447,1-0.999c0-0.553-0.447-1.001-1-1.001c-0.004,0-0.009,0-0.014,0c-1.643,0-3.278,0.181-4.86,0.537 c-0.539,0.121-0.877,0.656-0.756,1.195C24.476,28.295,24.888,28.61,25.345,28.61z" />
                <path d="M9.821,45.081c0.061,0.012,0.121,0.017,0.18,0.017c0.474,0,0.895-0.338,0.983-0.82c1.039-5.698,4.473-10.768,9.186-13.56 c0.475-0.281,0.632-0.895,0.351-1.37c-0.282-0.475-0.895-0.632-1.37-0.351c-5.204,3.083-8.992,8.661-10.134,14.921 C8.917,44.462,9.277,44.982,9.821,45.081z" />
                <path d="M55.624,43.721C53.812,33.08,45.517,24.625,34.957,22.577c0.017-0.16,0.043-0.321,0.043-0.48c0-2.757-2.243-5-5-5 s-5,2.243-5,5c0,0.159,0.025,0.32,0.043,0.48C14.483,24.625,6.188,33.08,4.376,43.721C2.286,44.904,0,46.645,0,48.598 c0,5.085,15.512,8.5,30,8.5s30-3.415,30-8.5C60,46.645,57.714,44.904,55.624,43.721z M27.006,22.27 C27.002,22.212,27,22.154,27,22.098c0-1.654,1.346-3,3-3s3,1.346,3,3c0,0.057-0.002,0.114-0.006,0.172 c-0.047-0.005-0.094-0.007-0.14-0.012c-0.344-0.038-0.69-0.065-1.038-0.089c-0.128-0.009-0.255-0.022-0.383-0.029 c-0.474-0.026-0.951-0.041-1.432-0.041s-0.958,0.015-1.432,0.041c-0.128,0.007-0.255,0.02-0.383,0.029 c-0.348,0.024-0.694,0.052-1.038,0.089C27.1,22.263,27.053,22.264,27.006,22.27z M26.399,24.368 c0.537-0.08,1.077-0.138,1.619-0.182c0.111-0.009,0.222-0.017,0.333-0.025c1.098-0.074,2.201-0.074,3.299,0 c0.111,0.008,0.222,0.016,0.333,0.025c0.542,0.044,1.082,0.102,1.619,0.182c10.418,1.575,18.657,9.872,20.152,20.316 c0.046,0.321,0.083,0.643,0.116,0.965c0.011,0.111,0.026,0.221,0.036,0.332c0.039,0.443,0.068,0.886,0.082,1.329 c-15.71,3.641-32.264,3.641-47.974,0c0.015-0.443,0.043-0.886,0.082-1.329c0.01-0.111,0.024-0.221,0.036-0.332 c0.033-0.323,0.07-0.645,0.116-0.965C7.742,34.24,15.981,25.942,26.399,24.368z M30,55.098c-17.096,0-28-4.269-28-6.5 c0-0.383,0.474-1.227,2.064-2.328c-0.004,0.057-0.002,0.113-0.006,0.17C4.024,46.988,4,47.54,4,48.098v0.788l0.767,0.185 c8.254,1.98,16.744,2.972,25.233,2.972s16.979-0.991,25.233-2.972L56,48.886v-0.788c0-0.558-0.024-1.109-0.058-1.658 c-0.004-0.057-0.002-0.113-0.006-0.17C57.526,47.371,58,48.215,58,48.598C58,50.829,47.096,55.098,30,55.098z" />
              </g>
            </svg>
            Log Food
          </button>
          <button
            onClick={() => handleAddWater(250)}
            className="flex-1 min-w-[140px] py-3 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--water)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--water-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--water)'}
          >
            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 297.001 297.001" fill="currentColor">
              <g>
                <g>
                  <g>
                    <path d="M194.551,169.941c-1.739-1.089-3.776-1.642-6.054-1.642c-1.615,0-3.122,0.305-4.479,0.907 c-1.344,0.596-2.516,1.477-3.487,2.618c-0.988,1.16-1.787,2.686-2.372,4.536c-0.599,1.894-0.903,4.066-0.903,6.455 c0,2.413,0.305,4.613,0.905,6.539c0.585,1.875,1.411,3.438,2.455,4.644c1.034,1.197,2.23,2.1,3.556,2.688 c1.337,0.592,2.834,0.892,4.45,0.892c2.093,0,3.962-0.508,5.711-1.551c1.7-1.015,3.085-2.629,4.116-4.799 c1.063-2.238,1.601-5.069,1.601-8.414c0-3.091-0.498-5.789-1.481-8.02C197.611,172.624,196.296,171.036,194.551,169.941z" />
                    <path d="M155.518,2.926c-1.864-1.88-4.367-2.953-7.051-2.925c-2.647,0.009-5.18,1.079-7.031,2.971 C137.326,7.173,40.77,106.791,40.77,189.271c0,59.402,48.328,107.73,107.73,107.73c59.402,0,107.73-48.328,107.73-107.73 C256.23,105.449,159.631,7.072,155.518,2.926z M120.982,205.972c-1.152,1.234-2.64,1.861-4.42,1.861 c-1.817,0-3.304-0.642-4.418-1.909c-1.065-1.208-1.605-2.947-1.605-5.164v-13.744H93.707v13.744c0,2.253-0.57,4.006-1.696,5.212 c-1.152,1.234-2.64,1.861-4.42,1.861c-1.817,0-3.304-0.642-4.418-1.909c-1.065-1.208-1.605-2.947-1.605-5.164v-35.673 c0-2.215,0.535-3.948,1.589-5.148c1.102-1.256,2.594-1.894,4.434-1.894c1.799,0,3.291,0.621,4.435,1.845 c1.116,1.197,1.68,2.946,1.68,5.197v11.49h16.833v-11.49c0-2.222,0.549-3.958,1.631-5.162c1.123-1.247,2.601-1.88,4.392-1.88 c1.799,0,3.291,0.621,4.435,1.845c1.116,1.197,1.68,2.946,1.68,5.197v35.673h0.001 C122.678,203.013,122.108,204.766,120.982,205.972z M157.786,231.529c-0.762,0.798-1.85,1.204-3.232,1.204h-16.152 c-1.497,0-2.711-0.451-3.61-1.34c-0.891-0.879-1.362-1.983-1.362-3.193c0-0.747,0.237-1.633,0.725-2.708 c0.468-1.031,0.981-1.834,1.566-2.456c1.965-2.04,3.758-3.808,5.342-5.264c1.631-1.503,2.786-2.478,3.532-2.98 c1.083-0.765,2.014-1.559,2.741-2.338c0.685-0.737,1.21-1.493,1.56-2.247c0.324-0.699,0.488-1.378,0.488-2.021 c0-0.667-0.149-1.238-0.456-1.747c-0.309-0.509-0.718-0.896-1.251-1.18c-0.554-0.295-1.148-0.439-1.815-0.439 c-1.414,0-2.455,0.588-3.28,1.85c-0.009,0.017-0.16,0.291-0.576,1.481c-0.407,1.156-0.87,2.042-1.416,2.709 c-0.5,0.609-1.432,1.333-3.045,1.333c-1.12,0-2.112-0.401-2.869-1.158c-0.769-0.767-1.159-1.785-1.159-3.023 c0-1.201,0.266-2.454,0.793-3.728c0.527-1.275,1.319-2.442,2.355-3.47c1.04-1.031,2.359-1.868,3.922-2.487 c1.55-0.616,3.369-0.928,5.407-0.928c2.436,0,4.566,0.398,6.33,1.18c1.21,0.554,2.273,1.315,3.174,2.268 c0.901,0.951,1.611,2.065,2.11,3.309c0.5,1.247,0.754,2.559,0.754,3.898c0,2.081-0.526,4.005-1.564,5.717 c-0.973,1.604-1.993,2.891-3.033,3.824c-0.958,0.862-2.515,2.173-4.759,4.006c-1.444,1.181-2.581,2.181-3.397,2.988h8.308 c1.474,0,2.659,0.342,3.523,1.016c0.961,0.75,1.47,1.815,1.47,3.078C158.911,229.775,158.522,230.76,157.786,231.529z M210.814,192.886c-1.008,3.045-2.545,5.726-4.568,7.971c-2.038,2.259-4.57,4.008-7.527,5.2c-2.924,1.178-6.3,1.775-10.036,1.775 c-3.719,0-7.108-0.614-10.073-1.824c-2.997-1.222-5.537-2.977-7.553-5.214c-2.004-2.223-3.536-4.926-4.555-8.036 c-1.002-3.059-1.51-6.404-1.51-9.943c0-3.629,0.531-7.013,1.579-10.057c1.061-3.086,2.626-5.757,4.655-7.94 c2.036-2.191,4.544-3.889,7.456-5.047c2.881-1.146,6.182-1.727,9.814-1.727c4.931,0,9.245,1.026,12.822,3.049 c3.616,2.046,6.39,4.993,8.245,8.758c1.822,3.701,2.747,8.083,2.747,13.025C212.31,186.519,211.808,189.887,210.814,192.886z" />
                  </g>
                </g>
              </g>
            </svg>
            Log Water (+250ml)
          </button>
          <button
            onClick={() => {
              setEditingWorkout(null);
              setIsWorkoutModalOpen(true);
            }}
            className="flex-1 min-w-[140px] py-3 text-white font-bold rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--workout)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--workout-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--workout)'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.1 3A1.9 1.9 0 1 1 14 4.9 1.898 1.898 0 0 1 12.1 3zm2.568 4.893c.26-1.262-1.399-1.861-2.894-2.385L7.09 6.71l.577 4.154c0 .708 1.611.489 1.587-.049l-.39-2.71 2.628-.48-.998 4.92 3.602 4.179-1.469 4.463a.95.95 0 0 0 .39 1.294c.523.196 1.124-.207 1.486-.923.052-.104 1.904-5.127 1.904-5.127l-2.818-3.236 1.08-5.303zm-5.974 8.848l-3.234.528a1.033 1.033 0 0 0-.752 1.158c.035.539.737.88 1.315.802l3.36-.662 2.54-2.831-1.174-1.361zm8.605-7.74l-1.954.578-.374 1.837 2.865-.781a.881.881 0 0 0-.537-1.633z" />
              <path fill="none" d="M0 0h24v24H0z" />
            </svg>
            Log Workout
          </button>
          <button
            onClick={() => setIsWeightModalOpen(true)}
            className="flex-1 min-w-[140px] py-3 bg-slate-600 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Update Weight
          </button>
        </div>
      </div>

      {/* Dual-Track Section */}
      <DualTrackSection
        todayPlan={todayPlan}
        dailyLog={dailyLog}
        onToggleMeal={toggleMeal}
        onViewRecipe={setSelectedRecipe}
        onEditWorkout={handleEditWorkout}
        onDeleteWorkout={onDeleteWorkout}
        onUpdateFoodItem={onUpdateFoodItem}
        onDeleteFoodItem={onDeleteFoodItem}
        onNavigate={onNavigate}
        onSwapMeal={handleSwapMeal}
      />



      {/* Tomorrow's Preview - Collapsible */}
      <div className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden">
        <button
          onClick={() => setTomorrowExpanded(!tomorrowExpanded)}
          className="w-full p-8 flex justify-between items-center hover:bg-background/50 transition-colors"
        >
          <div className="flex items-center gap-4">
            <h3 className="font-medium text-main text-lg font-serif">Tomorrow's Plan</h3>
            <span className="text-xs font-bold bg-calories-bg px-2 py-1 rounded-full" style={{ color: 'var(--calories)' }}>
              {tomorrowPlan.meals.reduce((acc, m) => acc + m.calories, 0)} kcal
            </span>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform ${tomorrowExpanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {tomorrowExpanded && (
          <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tomorrowPlan.meals.length === 0 ? (
              <div className="col-span-full p-8 text-center text-muted border border-dashed border-border rounded-xl bg-background/50">
                <p className="font-medium">No meals planned for tomorrow</p>
              </div>
            ) : (
              tomorrowPlan.meals.map((meal, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-border bg-background/30 hover:border-primary/30 transition-colors"
                >
                  <p className="font-medium text-main truncate">{meal.name}</p>
                  <div className="flex gap-2 items-center mt-2">
                    <span className="text-[10px] font-bold text-muted bg-surface px-1.5 py-0.5 rounded uppercase">
                      {meal.type}
                    </span>
                    <span className="text-xs text-muted">{meal.calories} kcal</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <FoodEntryModal
        isOpen={isFoodModalOpen}
        onClose={() => setIsFoodModalOpen(false)}
        onAddItems={onAddFoodLogItems}
      />
      <WorkoutEntryModal
        isOpen={isWorkoutModalOpen}
        onClose={() => {
          setIsWorkoutModalOpen(false);
          setEditingWorkout(null);
        }}
        onSave={handleWorkoutSave}
        editingWorkout={editingWorkout}
        recentWorkouts={recentWorkouts}
      />

      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {/* Meal Swap Selector Modal */}
      {isMealSelectorOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-4 animate-fade-in" onClick={() => setIsMealSelectorOpen(false)}>
            <div className="bg-surface w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden h-[90vh] flex flex-col scale-100 animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center p-6 border-b border-border bg-surface shrink-0">
                <h2 className="text-2xl font-bold text-main font-serif">Swap Meal</h2>
                <button
                  onClick={() => setIsMealSelectorOpen(false)}
                  className="p-2 bg-surface border border-border rounded-full text-muted hover:text-main transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <RecipeLibrary onSelect={handleMealSelected} />
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Weight Update Modal */}
      {isWeightModalOpen && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 py-4 animate-fade-in"
            onClick={() => setIsWeightModalOpen(false)}
          >
            <div
              className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-border flex justify-between items-center bg-surface">
                <h3 className="font-normal text-2xl text-main font-serif">Update Weight</h3>
                <button
                  onClick={() => setIsWeightModalOpen(false)}
                  className="p-2 bg-surface border border-border rounded-full text-muted hover:text-main transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-main mb-2">Current Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={quickWeightInput}
                    onChange={(e) => setQuickWeightInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickWeightSave()}
                    className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-medium text-lg text-main"
                    placeholder="e.g. 75.5"
                    autoFocus
                  />
                  <p className="text-xs text-muted mt-2 ml-1">Enter your current weight to update your progress</p>
                </div>
              </div>
              <div className="p-8 pt-0 flex gap-4">
                <button
                  onClick={() => setIsWeightModalOpen(false)}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-main font-bold rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickWeightSave}
                  disabled={!quickWeightInput || parseFloat(quickWeightInput) <= 0}
                  className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${!quickWeightInput || parseFloat(quickWeightInput) <= 0
                    ? 'bg-neutral-300 dark:bg-neutral-800 text-muted cursor-not-allowed'
                    : 'bg-slate-600 text-white hover:bg-slate-700'
                    }`}
                >
                  Update Weight
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
