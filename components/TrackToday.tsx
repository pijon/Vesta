import type { PlannedMealIntakeEntry, PlannedMealIntakeResult } from '../types';
import React, { useState, useEffect } from 'react';
import { DayPlan, UserStats, DailyLog, Recipe, FoodLogItem, WorkoutItem, FastingState, FastingConfig, AppView, DailySummary, CoachReadState, MealSlot, DayLogStatus } from '../types';
import { ENERGY_COMPLETE_DAY_SHARE, isCompleteDay, looksLight, usualIntake } from '../utils/logCompleteness';
import { localDateString } from '../utils/dateUtils';
import { saveDayPlan, saveFamilyMealOut } from '../services/storageService';
import { currentUid } from '../services/firebase';
import { RecipeDetailModal } from './RecipeDetailModal';
import { addDays, creditedBurn, dayTarget, decideEatingOut, isBudgetMeal, withLiveBudgets, proteinTarget, isFastDay, isMealEaten, nextMealIndex, mealKey, planMeal, setFamilyMealOut, slotFor, slotTime } from '../utils/planUtils';
import { AtePlannedCard } from './AtePlannedCard';
import { EatingOutCard } from './EatingOutCard';
import { EatingOutDecideSheet } from './EatingOutDecideSheet';
import { DualTrackSection } from './DualTrackSection';
import { TomorrowCard } from './TomorrowCard';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { analyticsDayTypesData, analyticsSummariesData, frequentFoodsData, FrequentFood } from '../services/pageData';
import { CoachCard } from './CoachPanel';
import { usePrewarmed } from '../utils/prewarm';
import { buildDays, weekendGap, weightSummary } from '../utils/analyticsModel';
import { WeekendPlanCard } from './WeekendPlanCard';
import { weightTrend } from '../utils/energyModel';
import { WorkoutOverviewModal } from './WorkoutOverviewModal';
import { DEFAULT_FAST_BREAK_CALORIES } from '../constants';
import { CaloriesHero } from './CaloriesHero';
import { TodayStrip } from './TodayStrip';
// Lazy load RecipeLibrary
const RecipeLibrary = React.lazy(() => import('./RecipeLibrary').then(module => ({ default: module.RecipeLibrary })));
import { Sheet } from './Sheet';
import { useAchievements } from '../hooks/useAchievements';
import { analyzeActivityStreaks } from '../utils/analytics';


const EMPTY_DAY_TYPES: Record<string, string> = {};

/** When a meal logged after the fact is assumed to have been eaten (never later than now) */
const plannedTime = (slot: MealSlot, now: number) => Math.min(slotTime(slot, now), now);

interface TrackTodayProps {
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
  fastingState: FastingState;
  onUpdateStats: (stats: UserStats) => void;
  /** Logs planned meals as eaten: App asks for any unknown calories, then saves the diary and ticks together */
  onRequestPlannedIntake: (entries: PlannedMealIntakeEntry[]) => Promise<PlannedMealIntakeResult>;
  /** Unticks a planned meal and removes its diary entry */
  onRemovePlannedIntake: (meal: Recipe) => Promise<void>;
  onSetDayStatus: (status: DayLogStatus | undefined) => Promise<DailyLog>;
  onAddFoodLogItems: (items: FoodLogItem[]) => Promise<void>;
  onUpdateFoodItem: (item: FoodLogItem) => Promise<void>;
  onDeleteFoodItem: (itemId: string) => Promise<void>;
  onRestoreFoodItem: (item: FoodLogItem) => Promise<void>;
  onAddWorkout: (workout: WorkoutItem) => Promise<void>;
  onUpdateWorkout: (workout: WorkoutItem) => Promise<void>;
  onDeleteWorkout: (workoutId: string) => Promise<void>;
  onUpdateFastingConfig: (config: FastingConfig) => Promise<void>;
  refreshData: () => void;
  onNavigate: (view: AppView) => void;
  onOpenFoodModal: () => void;
  /** `onDelete` gives the edit sheet a Delete button (with Today's Undo) */
  onOpenWorkoutModal: (workout?: WorkoutItem, onDelete?: () => void) => void;
  onOpenWeightModal: () => void;
  onAddWater: (amount: number) => Promise<void>;
  coachRead: CoachReadState;
  onSetCoachRead: (id: string, read: boolean) => void;
}

export const TrackToday: React.FC<TrackTodayProps> = ({
  todayPlan: storedPlan,
  tomorrowPlan,
  stats,
  dailyLog,
  fastingState,
  onUpdateStats,
  onRequestPlannedIntake,
  onRemovePlannedIntake,
  onSetDayStatus,
  onAddFoodLogItems,
  onUpdateFoodItem,
  onDeleteFoodItem,
  onRestoreFoodItem,
  onAddWorkout,
  onUpdateWorkout,
  onDeleteWorkout,
  onUpdateFastingConfig,
  refreshData,
  onNavigate,
  onOpenFoodModal,
  onOpenWorkoutModal,
  onOpenWeightModal,
  onAddWater,
  coachRead,
  onSetCoachRead
}) => {
  const navigate = useNavigate();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isWorkoutOverviewOpen, setIsWorkoutOverviewOpen] = useState(false);

  // Meal Swap State
  const [isMealSelectorOpen, setIsMealSelectorOpen] = useState(false);
  const [activeMealIndexToSwap, setActiveMealIndexToSwap] = useState<number | null>(null);


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

  // The last 90 days, from the summaries Analytics also reads (today comes from dailyLog below)
  const summaries = usePrewarmed(analyticsSummariesData);
  const activityHistory = React.useMemo(() => {
    const since = addDays(localDateString(), -90);
    return (summaries ?? []).filter(summary => summary.date >= since);
  }, [summaries]);

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

  // Called for its side effect: keeps streaks in stats up to date
  useAchievements(dailyLog, fastingState, stats, onUpdateStats);

  // Calculate calories
  const consumed = (dailyLog.items || []).reduce((sum, item) => sum + item.calories, 0);
  const caloriesBurned = (dailyLog.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);
  // Today's first meal that broke the fast (a coffee doesn't), which opens the eating window
  const fastBreakCalories = fastingState.config.fastBreakCalories ?? DEFAULT_FAST_BREAK_CALORIES;
  const firstMealTimes = (dailyLog.items || []).filter(item => item.calories > fastBreakCalories).map(item => item.timestamp);
  const firstMealTime = firstMealTimes.length ? Math.min(...firstMealTimes) : null;


  // Eating-out budgets give up their share of anything eaten beyond the plan
  const todayPlan = React.useMemo(() => withLiveBudgets(storedPlan, { loggedKcal: consumed }), [storedPlan, consumed]);

  // Determine Daily Target based on Day Type
  const isNonFastDay = !isFastDay(todayPlan);
  const dailyTarget = dayTarget(todayPlan, stats);

  const handleAddWaterClick = (amount: number) => {
    // Direct prop call - Parent updates dailyLog which re-renders this component
    onAddWater(amount);
  };

  // handleAddWater and handleSetWater removed/replaced by prop



  const handleEditWorkout = (workout: WorkoutItem) => {
    onOpenWorkoutModal(workout, () => handleDeleteWorkout(workout.id));
  };

  /** Logs planned meals as eaten, at their slot's usual time (`timed`) or now. Ticks show once saved */
  const logPlanned = async (indices: number[], timed: boolean) => {
    const now = Date.now();
    const meals = indices.map(i => todayPlan.meals[i]).filter(Boolean);
    if (!meals.length) return;
    try {
      const result = await onRequestPlannedIntake(meals.map(meal => ({ meal, at: timed ? plannedTime(slotFor(meal), now) : now })));
      if (result.status !== 'saved' || !result.loggedKeys.length) return;
      refreshData();
      if (timed) {
        const kcal = result.items.reduce((sum, item) => sum + item.calories, 0);
        setToast({ message: `Logged ${result.items.length} meal${result.items.length === 1 ? '' : 's'} · ${kcal.toLocaleString()} kcal` });
      }
    } catch (e) {
      console.error('Failed to log the meals', e);
      setToast({ message: e instanceof Error ? e.message : "Couldn't save that. Check your connection." });
    }
  };

  /** The eating-out meal being logged (index in today's plan), from its card or a reminder */
  const [eatingOutIndex, setEatingOutIndex] = useState<number | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const eatOutParam = searchParams.get('eatout');
  useEffect(() => {
    if (!eatOutParam) return;
    const index = todayPlan.meals.findIndex(meal => mealKey(meal) === eatOutParam);
    if (index < 0) return;
    if (!isMealEaten(todayPlan, todayPlan.meals[index])) setEatingOutIndex(index);
    setSearchParams(params => { params.delete('eatout'); return params; }, { replace: true });
  }, [eatOutParam, todayPlan, setSearchParams]);

  /** Logs what was actually had out. The amount goes to this person's diary; their own plan then
   *  shows the dish, but a family meal is left as the family planned it. */
  const logEatingOut = async (index: number, name: string, calories: number, options: { estimated: boolean; protein?: number; place: string; dish: string }) => {
    const meal = todayPlan.meals[index];
    setEatingOutIndex(null);
    if (!meal) return;
    try {
      const result = await onRequestPlannedIntake([{
        meal, at: Date.now(),
        personal: { calories, estimated: options.estimated, protein: options.protein, name, place: options.place, dish: options.dish },
      }]);
      if (result.status !== 'saved' || !result.loggedKeys.length) return;
      if (!meal.familyMeal) {
        const budgeted = isBudgetMeal(meal) ? (meal.quick?.plannedBudget ?? meal.calories) : undefined;
        const key = mealKey(meal);
        await saveDayPlan({
          ...storedPlan,
          meals: storedPlan.meals.map(m => (mealKey(m) === key ? decideEatingOut(m, name, calories, { ...options, budgeted }) : m)),
          completedMealIds: [...new Set([...storedPlan.completedMealIds, key])],
        });
      }
      refreshData();
      setToast({ message: `Logged ${name} · ${calories.toLocaleString()} kcal` });
    } catch (e) {
      console.error('Failed to log the meal', e);
      setToast({ message: e instanceof Error ? e.message : "Couldn't save that. Check your connection." });
    }
  };

  const toggleMeal = async (mealIndex: number) => {
    const meal = todayPlan.meals[mealIndex];
    if (!meal) return;
    if (!isMealEaten(todayPlan, meal)) {
      await logPlanned([mealIndex], false);
      return;
    }
    try {
      await onRemovePlannedIntake(meal);
      refreshData();
    } catch (e) {
      console.error('Failed to untick the meal', e);
      setToast({ message: e instanceof Error ? e.message : "Couldn't save that. Check your connection." });
    }
  };

  // "Next up" on Today's plate
  const nextIndex = nextMealIndex(todayPlan);

  /** Deletes at once with Undo. An entry logged from the plan also unticks that meal (and Undo ticks it again). */
  const handleDeleteFoodItem = async (itemId: string) => {
    const item = dailyLog.items?.find(i => i.id === itemId);
    if (!item) return;
    // A planned meal's entry is removed with its tick, and Undo puts back exactly that entry (App routes both)
    try {
      await onDeleteFoodItem(itemId);
    } catch (e) {
      console.error('Failed to delete the entry', e);
      setToast({ message: e instanceof Error ? e.message : "Couldn't delete that. Check your connection." });
      return;
    }
    if (item.planInstanceId) refreshData();
    setToast({
      message: `Deleted ${item.name}`,
      undo: async () => {
        try {
          await onRestoreFoodItem(item);
          if (item.planInstanceId) refreshData();
        } catch (e) {
          console.error('Failed to restore the entry', e);
          setToast({ message: e instanceof Error ? e.message : "Couldn't put that back. Check your connection." });
        }
      },
    });
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    const workout = dailyLog.workouts?.find(w => w.id === workoutId);
    if (!workout) return;
    await onDeleteWorkout(workoutId);
    setToast({ message: `Deleted ${workout.type}`, undo: () => { onAddWorkout(workout); } });
  };

  /** The user isn't eating a family meal (out), or is again */
  const handleFamilyMealOut = async (meal: Recipe, out: boolean, plan: DayPlan = todayPlan) => {
    const uid = currentUid();
    if (!uid || !meal.instanceId) return;
    const next = setFamilyMealOut(plan, meal.instanceId, uid, out);
    try {
      await saveFamilyMealOut(next, meal.instanceId, out);
    } catch (e) {
      console.error('Failed to save plan', e);
      setToast({ message: "Couldn't save that change. Check your connection." });
      return;
    }
    refreshData();
    if (out) setToast({ message: `You're not eating ${meal.name}`, undo: () => { handleFamilyMealOut(meal, false, next); } });
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
      familyMeal: oldMeal.familyMeal,
      notEating: oldMeal.notEating,
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

  // Weight tile: the smoothed trend (as on Analytics), the latest scale reading and the last month's pace
  const weightInfo = React.useMemo(() => {
    const history = [...(stats.weightHistory || [])].filter(e => e.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
    const last = history[history.length - 1];
    const points = weightTrend(history);
    const latest = points[points.length - 1];
    // Chart: the current run of the trend over the last 30 days, and the weigh-ins in it
    const recent = latest ? points.filter(p => p.run === latest.run && p.date >= addDays(latest.date, -30)) : [];
    const from = recent.length ? recent[0].date : '';
    return {
      current: latest ? Math.round(latest.trend * 10) / 10 : null,
      scale: last ? last.weight : null,
      lastDate: last ? last.date : null,
      trend: recent.map(p => ({ date: p.date, weight: p.trend })),
      readings: recent.length ? history.filter(e => e.date >= from).map(e => ({ date: e.date, weight: e.weight })) : [],
      ratePerWeek: weightSummary(history, 30, stats.goalWeight).ratePerWeek,
    };
  }, [stats.weightHistory, stats.goalWeight]);

  // One-tap re-logging of frequent foods, with undo
  const frequentFoods = usePrewarmed(frequentFoodsData) ?? [];
  const dayTypes = usePrewarmed(analyticsDayTypesData) ?? EMPTY_DAY_TYPES;

  // Extra calories a day at weekends over the last eight weeks of fully logged days
  const recentWeekendGap = React.useMemo(
    () => weekendGap(buildDays(56, activityHistory, dayTypes, stats, dailyLog, addDays(localDateString(), -1))),
    [activityHistory, dayTypes, stats, dailyLog],
  );
  // Your usual intake on this kind of day, to ask about a day that looks light next to it
  const usual = React.useMemo(() => usualIntake(activityHistory, dayTypes, stats, !isNonFastDay), [activityHistory, dayTypes, stats, isNonFastDay]);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const handleQuickLog = async (food: FrequentFood) => {
    const item: FoodLogItem = {
      id: crypto.randomUUID(), name: food.name, calories: food.calories, timestamp: Date.now(),
      ...(food.protein !== undefined ? { protein: food.protein } : {}),
    };
    await onAddFoodLogItems([item]);
    setToast({ message: `Logged ${food.name} · ${food.calories} kcal`, undo: () => { onDeleteFoodItem(item.id); } });
  };

  // Coming up: tomorrow, then (Thursday and Friday) the weekend. Below today's plate and log, never above them
  const comingUp = (
    <div className="space-y-3">
      <TomorrowCard plan={tomorrowPlan} stats={stats} onPlan={() => navigate('/mealplanner', { state: { date: tomorrowPlan.date } })} />
      <WeekendPlanCard weekendGap={recentWeekendGap} tomorrow={tomorrowPlan.date} onPlan={date => navigate('/mealplanner', { state: { date } })} />
    </div>
  );

  const proteinToday = { eaten: (dailyLog.items || []).reduce((sum, item) => sum + (item.protein || 0), 0), target: proteinTarget(stats) };

  return (
    <div className="space-y-8">
    <div className="space-y-3">
        <CaloriesHero
          caloriesGoal={dailyTarget}
          caloriesEaten={consumed}
          caloriesBurned={caloriesBurned}
          burnCredit={stats.workoutCalorieCredit ?? 1}
          isFastDay={!isNonFastDay}
          onLogFood={onOpenFoodModal}
        />
        <TodayStrip
          water={{ liters: (dailyLog.waterIntake || 0) / 1000, goal: stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5, onAdd: handleAddWaterClick }}
          protein={proteinToday}
          weight={{ kg: weightInfo.current, ratePerWeek: weightInfo.ratePerWeek, onUpdate: onOpenWeightModal, onOpen: () => onNavigate(AppView.ANALYTICS) }}
          workouts={{
            caloriesBurned,
            types: (dailyLog.workouts || []).map(w => w.type),
            streak: analyzeActivityStreaks(effectiveHistory).currentStreak,
            onLog: () => onOpenWorkoutModal(),
            onOpen: () => setIsWorkoutOverviewOpen(true),
          }}
          fasting={{
            elapsedHours: elapsedFastingHours,
            targetHours: fastingState.config.targetFastHours,
            lastAteTime: fastingState.lastAteTime,
            firstMealTime,
            history: effectiveHistory,
            today: dailyLog.date,
            onOpen: () => onNavigate(AppView.ANALYTICS),
          }}
        />
      </div>

      {/* Only prompts about today's meals sit above the plate; later days are under Coming up */}
      {/* Evening: log the rest of the plan in one tap */}
      <AtePlannedCard plan={todayPlan} onLogAll={indices => logPlanned(indices, true)} />

      {/* Eating out: what was actually had */}
      <EatingOutCard plan={todayPlan} onLog={setEatingOutIndex} onConfirm={i => logPlanned([i], false)} />

      {/* Dual-Track Section */}
      <DualTrackSection
        todayPlan={todayPlan}
        dailyLog={dailyLog}
        onToggleMeal={toggleMeal}
        onViewRecipe={setSelectedRecipe}
        onEditWorkout={handleEditWorkout}
        onUpdateFoodItem={onUpdateFoodItem}
        onDeleteFoodItem={handleDeleteFoodItem}
        onNavigate={onNavigate}
        onSwapMeal={handleSwapMeal}
        onSetFamilyMealOut={(meal, out) => { handleFamilyMealOut(meal, out); }}
        nextIndex={nextIndex}
        caloriesLeft={dailyTarget - consumed + creditedBurn(caloriesBurned, stats)}
        frequentFoods={frequentFoods}
        onQuickLog={handleQuickLog}
        onLogFood={onOpenFoodModal}
        dayStatus={dailyLog.status}
        dayCounts={isCompleteDay(consumed, dailyTarget, dailyLog.status)}
        dayCountsForBurn={isCompleteDay(consumed, dailyTarget, dailyLog.status, ENERGY_COMPLETE_DAY_SHARE)}
        lightDayUsual={looksLight(consumed, usual, dailyLog.status) ? usual! : undefined}
        isFastDay={!isNonFastDay}
        onSetDayStatus={onSetDayStatus}
        planAside={comingUp}
      />

      {/* The most useful piece of guidance right now (all of it is on Analytics) */}
      <CoachCard
        stats={stats}
        summaries={activityHistory}
        dayTypes={dayTypes}
        dailyLog={dailyLog}
        onUpdateStats={onUpdateStats}
        onOpenFoodModal={onOpenFoodModal}
        onOpenWeightModal={onOpenWeightModal}
        onNavigate={onNavigate}
        coachRead={coachRead}
        onSetCoachRead={onSetCoachRead}
      />

      {/* Coming up: here on phones, beside the plan from lg up */}
      <div className="lg:hidden">{comingUp}</div>

      {eatingOutIndex !== null && todayPlan.meals[eatingOutIndex] && (
        <EatingOutDecideSheet
          meal={todayPlan.meals[eatingOutIndex]}
          confirmLabel="Log it"
          onDecide={(name, calories, options) => logEatingOut(eatingOutIndex, name, calories, options)}
          onClose={() => setEatingOutIndex(null)}
        />
      )}

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--tab-bar-bottom)+94px)] nav:bottom-8 z-[60] flex items-center gap-3 badge-ink !rounded-full pl-4 pr-1.5 py-1.5 text-sm font-semibold shadow-[var(--elev-md)] toast-in max-w-[calc(100vw-32px)]">
          <span className="truncate">{toast.message}</span>
          {toast.undo && (
            <button onClick={() => { toast.undo!(); setToast(null); }} className="hit-target shrink-0 min-h-8 px-3 rounded-full bg-on-ink/15 hover:bg-on-ink/25 font-semibold">Undo</button>
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
        <Sheet title="Swap meal" size="xl" onClose={() => setIsMealSelectorOpen(false)}>
          <React.Suspense fallback={<p className="p-8 text-center text-muted">Loading recipes…</p>}>
            <RecipeLibrary onSelect={handleMealSelected} />
          </React.Suspense>
        </Sheet>
      )}
    </div>
  );
};
