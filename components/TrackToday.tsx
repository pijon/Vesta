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
  const [weightInput, setWeightInput] = useState(stats.currentWeight.toString());
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);
  const [healthTrackersExpanded, setHealthTrackersExpanded] = useState(false);
  const [tomorrowExpanded, setTomorrowExpanded] = useState(false);
  const [quickWeightInput, setQuickWeightInput] = useState(stats.currentWeight.toString());
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutItem[]>([]);

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
    setWeightInput(stats.currentWeight.toString());
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

  const percentage = Math.min(100, (netCalories / dailyTarget) * 100);

  const handleSaveWeight = () => {
    const w = parseFloat(weightInput);
    if (w > 0) {
      onUpdateStats({ ...stats, currentWeight: w });
    }
  };

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

      {/* Hero Stats */}
      <div className="pb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Net Calories Card */}
          <div className="md:col-span-5 bg-gradient-to-br from-surface via-calories-bg/30 to-surface p-8 rounded-3xl shadow-xl shadow-calories-bg/50 border border-calories-border/50 flex flex-col h-64 relative overflow-hidden group hover:shadow-2xl hover:shadow-calories-border transition-all duration-500">
            {/* Decorative gradient orb */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-calories/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

            {/* Header: Label + Icon */}
            <div className="flex justify-between items-center mb-4 relative z-10">
              <p className="text-muted text-xs font-bold uppercase tracking-widest">Net Calories</p>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-calories flex items-center justify-center text-white shadow-lg shadow-calories/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 12h2a2 2 0 1 0 0-4h-2v4Z" />
                  <path d="m16.7 13.4-.9-1.8c.8-1.1 1.2-2.5 1.2-4a7 7 0 0 0-7-7 7 7 0 0 0-7 7c0 1.5.4 2.9 1.2 4l-.9 1.8a2 2 0 0 0 2.6 2.6l1.8-.9c1.1.8 2.5 1.2 4 1.2s2.9-.4 4-1.2l1.8.9a2 2 0 0 0 2.6-2.6Z" />
                </svg>
              </div>
            </div>

            {/* Content Area - Fixed Height */}
            <div className="h-28 flex flex-col relative z-10">
              {/* Hero Number */}
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-neutral-800 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent font-serif tracking-tight leading-none">{netCalories}</span>
                <span className="text-muted font-semibold text-lg">/ {dailyTarget}</span>
              </div>

              {/* Badges Row - Fixed Height Container */}
              <div className="h-20 flex items-start gap-2 flex-wrap content-start">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg shadow-sm ${isNonFastDay ? 'bg-gradient-to-r from-warning-bg to-warning-bg/50 text-amber-800 border border-warning-border' : 'bg-gradient-to-r from-calories-bg to-calories-bg/50 text-emerald-800 border border-calories-border'}`}>
                  {isNonFastDay ? 'Non-Fasting Day' : 'Fasting Day'}
                </span>
                {caloriesBurned > 0 && (
                  <p className="text-xs font-semibold flex items-center gap-1.5 bg-workout-bg px-2 py-1 rounded-lg border border-workout-border" style={{ color: 'var(--workout)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z" />
                    </svg>
                    {caloriesBurned} kcal burned
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar - Always at Bottom */}
            <div className="relative z-10 h-12">
              <div className="w-full bg-border h-2 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className={`h-full rounded-full ${netCalories > dailyTarget ? 'bg-gradient-to-r from-red-500 to-error' : 'bg-gradient-to-r from-emerald-500 to-calories shadow-lg shadow-calories/50'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <div className="flex text-xs text-muted font-semibold mt-2">
                <span>{dailyTarget - netCalories > 0 ? `${dailyTarget - netCalories} net kcal remaining` : 'Limit reached'}</span>
              </div>
            </div>
          </div>

          {/* Weight Card */}
          <div className="md:col-span-7 bg-gradient-to-br from-surface via-weight-bg/30 to-surface p-8 rounded-3xl shadow-xl shadow-weight-bg/50 border border-weight-border/50 flex flex-col h-64 relative overflow-hidden group hover:shadow-2xl hover:shadow-weight-border transition-all duration-500">
            {/* Decorative gradient orb */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-weight/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>

            {/* Header: Label + Icon */}
            <div className="flex justify-between items-center mb-4 relative z-10">
              <p className="text-muted text-xs font-bold uppercase tracking-widest">Current Weight</p>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-weight flex items-center justify-center text-white shadow-lg shadow-weight/30">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 13V2l8 4-8 4"></path>
                  <path d="M20.55 10.23A9 9 0 1 1 8 4.94"></path>
                  <path d="M8 10a5 5 0 1 0 8.9 2.02"></path>
                </svg>
              </div>
            </div>

            {/* Content Area - Fixed Height */}
            <div className="h-28 flex flex-col relative z-10">
              {/* Hero Number */}
              <div className="flex items-baseline gap-3 mb-2">
                <input
                  type="number"
                  className="w-32 text-5xl md:text-6xl font-bold bg-gradient-to-br from-neutral-800 to-neutral-600 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent outline-none border-b-2 border-transparent hover:border-neutral-200 transition-all font-serif tracking-tight leading-none"
                  style={{ focusBorderColor: 'var(--weight)' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--weight)'}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'transparent';
                    handleSaveWeight();
                  }}
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveWeight()}
                />
                <span className="text-muted font-semibold text-lg">/ {goalWeight} kg</span>
              </div>

              {/* Badges Row - Fixed Height Container */}
              <div className="h-20 flex items-start gap-2 flex-wrap content-start">
                <p className="text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-calories-bg to-calories-bg/50 px-2 py-1 rounded-lg border border-calories-border" style={{ color: 'var(--calories)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6"></path>
                  </svg>
                  {Math.abs(startWeight - currentWeight).toFixed(1)} kg {startWeight >= currentWeight ? 'lost' : 'gained'}
                </p>
              </div>
            </div>

            {/* Progress Bar - Always at Bottom */}
            <div className="relative z-10 h-12">
              <div className="w-full bg-border h-2 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className="bg-gradient-to-r from-blue-500 to-weight h-full rounded-full shadow-lg shadow-weight/50"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-xs font-medium text-muted mt-2">
                <span><span className="text-[9px] uppercase">Start</span> {startWeight} kg</span>
                <span><span className="text-[9px] uppercase">Goal</span> {goalWeight} kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="pb-8">
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setIsFoodModalOpen(true)}
            className="flex-1 min-w-[140px] py-3 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--calories)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--calories-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--calories)'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Log Food
          </button>
          <button
            onClick={() => handleAddWater(250)}
            className="flex-1 min-w-[140px] py-3 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--water)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--water-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--water)'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            </svg>
            Log Water (+250ml)
          </button>
          <button
            onClick={() => {
              setEditingWorkout(null);
              setIsWorkoutModalOpen(true);
            }}
            className="flex-1 min-w-[140px] py-3 text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
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
            className="flex-1 min-w-[140px] py-3 bg-slate-600 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors shadow-lg flex items-center justify-center gap-2"
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
      />

      {/* Trackers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hydration Widget */}
        <HydrationWidget
          intake={hydration}
          goal={stats.dailyWaterGoal || 2000}
          onAdd={handleAddWater}
          onSet={handleSetWater}
        />

        {/* Fasting Widget */}
        <FastingWidget
          fastingState={fastingState}
          onStartFast={onStartFast}
          onEndFast={onEndFast}
          onUpdateConfig={onUpdateFastingConfig}
        />
      </div>

      {/* Tomorrow's Preview - Collapsible */}
      <div className="bg-surface rounded-3xl shadow-lg border border-border overflow-hidden">
        <button
          onClick={() => setTomorrowExpanded(!tomorrowExpanded)}
          className="w-full p-8 flex justify-between items-center hover:bg-background/50 transition-colors"
        >
          <div className="flex items-center gap-3">
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
          <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
              <div className="p-8 pt-0 flex gap-3">
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
