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
  const percentage = Math.min(100, (netCalories / stats.dailyCalorieGoal) * 100);

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
    <div className="space-y-6">
      {/* Hero Stats - Sticky on scroll */}
      <div className="sticky top-16 z-10 bg-gradient-to-br from-slate-50 to-slate-100 pb-4 -mx-4 px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Net Calories Card */}
          <div className="md:col-span-5 bg-surface p-5 rounded-2xl shadow-lg border border-border flex flex-col justify-between h-44">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <p className="text-muted text-xs font-bold uppercase tracking-widest">Net Calories</p>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 12h2a2 2 0 1 0 0-4h-2v4Z" />
                    <path d="m16.7 13.4-.9-1.8c.8-1.1 1.2-2.5 1.2-4a7 7 0 0 0-7-7 7 7 0 0 0-7 7c0 1.5.4 2.9 1.2 4l-.9 1.8a2 2 0 0 0 2.6 2.6l1.8-.9c1.1.8 2.5 1.2 4 1.2s2.9-.4 4-1.2l1.8.9a2 2 0 0 0 2.6-2.6Z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-medium text-main font-serif">{netCalories}</span>
                <span className="text-muted font-medium text-sm">/ {stats.dailyCalorieGoal}</span>
              </div>
              {caloriesBurned > 0 ? (
                <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z" />
                  </svg>
                  {caloriesBurned} kcal burned
                </p>
              ) : (
                <p className="text-xs text-muted font-medium">No activity yet</p>
              )}
            </div>
            <div>
              <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${netCalories > stats.dailyCalorieGoal ? 'bg-red-400' : 'bg-primary'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <p className="text-xs text-muted font-medium mt-2">
                {stats.dailyCalorieGoal - netCalories > 0 ? `${stats.dailyCalorieGoal - netCalories} net kcal remaining` : 'Limit reached'}
              </p>
            </div>
          </div>

          {/* Weight Card */}
          <div className="md:col-span-7 bg-surface p-5 rounded-2xl shadow-lg border border-border flex flex-col justify-between h-44">
            <div className="flex flex-col gap-1">
              <p className="text-muted text-xs font-bold uppercase tracking-widest">Current Weight</p>
              <div className="flex items-baseline gap-2 mt-1">
                <input
                  type="number"
                  className="w-20 text-3xl font-medium text-main bg-transparent outline-none border-b border-transparent hover:border-border focus:border-primary transition-colors font-serif"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onBlur={handleSaveWeight}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveWeight()}
                />
                <span className="text-muted font-medium text-sm">/ {goalWeight} kg goal</span>
              </div>
              <p className="text-xs text-muted font-medium">
                {Math.abs(startWeight - currentWeight).toFixed(1)} kg {startWeight >= currentWeight ? 'lost' : 'gained'}
              </p>
            </div>
            <div>
              <div className="w-full bg-background h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-primary h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
              <div className="flex justify-between text-xs font-medium text-slate-400 mt-2">
                <span><span className="text-[9px] uppercase">Start</span> {startWeight} kg</span>
                <span><span className="text-[9px] uppercase">Goal</span> {goalWeight} kg</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar - Sticky below hero stats */}
      <div className="sticky top-60 z-10 bg-gradient-to-br from-slate-50 to-slate-100 pb-4 -mx-4 px-4">
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setIsFoodModalOpen(true)}
            className="flex-1 min-w-[140px] py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Log Food
          </button>
          <button
            onClick={() => {
              setEditingWorkout(null);
              setIsWorkoutModalOpen(true);
            }}
            className="flex-1 min-w-[140px] py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z" />
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

      {/* Health Trackers - Collapsible */}
      <div className="bg-surface rounded-2xl shadow-lg border border-border overflow-hidden">
        <button
          onClick={() => setHealthTrackersExpanded(!healthTrackersExpanded)}
          className="w-full p-5 flex justify-between items-center hover:bg-background/50 transition-colors"
        >
          <h3 className="font-medium text-main text-lg font-serif">Health Tracking</h3>
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
            className={`transition-transform ${healthTrackersExpanded ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {healthTrackersExpanded && (
          <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            <HydrationWidget
              intake={hydration}
              goal={stats.dailyWaterGoal || 2000}
              onAdd={handleAddWater}
            />
            <FastingWidget
              fastingState={fastingState}
              onStartFast={onStartFast}
              onEndFast={onEndFast}
              onUpdateConfig={onUpdateFastingConfig}
            />
          </div>
        )}
      </div>

      {/* Tomorrow's Preview - Collapsible */}
      <div className="bg-surface rounded-2xl shadow-lg border border-border overflow-hidden">
        <button
          onClick={() => setTomorrowExpanded(!tomorrowExpanded)}
          className="w-full p-5 flex justify-between items-center hover:bg-background/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-main text-lg font-serif">Tomorrow's Plan</h3>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
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
          <div className="p-5 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tomorrowPlan.meals.length === 0 ? (
              <div className="col-span-full p-8 text-center text-muted border border-dashed border-border rounded-xl bg-background/50">
                No meals planned for tomorrow
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
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-normal text-2xl text-slate-900 font-serif">Update Weight</h3>
                <button
                  onClick={() => setIsWeightModalOpen(false)}
                  className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Current Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={quickWeightInput}
                    onChange={(e) => setQuickWeightInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleQuickWeightSave()}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-500 outline-none font-medium text-lg"
                    placeholder="e.g. 75.5"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 mt-2 ml-1">Enter your current weight to update your progress</p>
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button
                  onClick={() => setIsWeightModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickWeightSave}
                  disabled={!quickWeightInput || parseFloat(quickWeightInput) <= 0}
                  className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${!quickWeightInput || parseFloat(quickWeightInput) <= 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
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
