import React, { useState, useEffect } from 'react';
import { DayPlan, UserStats, DailyLog, Recipe, FoodLogItem, WorkoutItem, FastingState, FastingConfig, AppView, DailySummary, CoachReadState, MealSlot, DayLogStatus } from '../types';
import { isCompleteDay } from '../utils/logCompleteness';
import { localDateString } from '../utils/dateUtils';
import { saveDayPlan, getDayPlan, getDailySummaries } from '../services/storageService';
import { RecipeDetailModal } from './RecipeDetailModal';
import { addDays, creditedBurn, dayTarget, proteinTarget, isFastDay, isMealEaten, mealCalories, mealKey, planMeal, slotFor, slotTime } from '../utils/planUtils';
import { AtePlannedCard } from './AtePlannedCard';
import { MealCaloriesSheet } from './MealCaloriesSheet';
import { DualTrackSection } from './DualTrackSection';
import { HearthWidget } from './HearthWidget';
import { TomorrowCard } from './TomorrowCard';
import { useNavigate } from 'react-router-dom';
import { analyticsDayTypesData, frequentFoodsData, FrequentFood } from '../services/pageData';
import { CoachCard } from './CoachPanel';
import { usePrewarmed } from '../utils/prewarm';
import { buildDays, weekendGap, weightSummary } from '../utils/analyticsModel';
import { WeekendPlanCard } from './WeekendPlanCard';
import { weightTrend } from '../utils/energyModel';
import { ActivityCard, FastingCard, HydrationCard, WeightCard } from './BentoGrid';
import { WorkoutOverviewModal } from './WorkoutOverviewModal';
import { DEFAULT_FAST_BREAK_CALORIES } from '../constants';
import { useDevMode } from '../contexts/DevModeContext';
import { CaloriesHero } from './CaloriesHero';
import { TonightCard } from './TonightCard';
import { TodayStrip } from './TodayStrip';
// Lazy load RecipeLibrary
const RecipeLibrary = React.lazy(() => import('./RecipeLibrary').then(module => ({ default: module.RecipeLibrary })));
import { Sheet } from './Sheet';
import { useAchievements } from '../hooks/useAchievements';
import { analyzeActivityStreaks } from '../utils/analytics';


const EMPTY_DAY_TYPES: Record<string, string> = {};

/** When a meal logged after the fact is assumed to have been eaten (never later than now) */
const plannedTime = (slot: MealSlot, now: number) => Math.min(slotTime(slot, now), now);

/** Meals being logged, and the quick meals among them still to be asked for calories */
interface CaloriesAsk { indices: number[]; plan: DayPlan; timed: boolean; queue: number[]; total: number }

interface TrackTodayProps {
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
  fastingState: FastingState;
  onUpdateStats: (stats: UserStats) => void;
  onLogMeal: (meal: Recipe, isAdding: boolean) => Promise<void>;
  onLogMeals: (entries: { meal: Recipe; at: number }[]) => Promise<void>;
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
  todayPlan,
  tomorrowPlan,
  stats,
  dailyLog,
  fastingState,
  onUpdateStats,
  onLogMeal,
  onLogMeals,
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
  const market = useDevMode().isFeatureEnabled('marketTheme');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [isWorkoutOverviewOpen, setIsWorkoutOverviewOpen] = useState(false);

  // Meal Swap State
  const [isMealSelectorOpen, setIsMealSelectorOpen] = useState(false);
  const [activeMealIndexToSwap, setActiveMealIndexToSwap] = useState<number | null>(null);

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

  // Called for its side effect: keeps streaks in stats up to date
  useAchievements(dailyLog, fastingState, stats, onUpdateStats);

  // Calculate calories
  const consumed = (dailyLog.items || []).reduce((sum, item) => sum + item.calories, 0);
  const caloriesBurned = (dailyLog.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);
  // Today's first meal that broke the fast (a coffee doesn't), which opens the eating window
  const fastBreakCalories = fastingState.config.fastBreakCalories ?? DEFAULT_FAST_BREAK_CALORIES;
  const firstMealTimes = (dailyLog.items || []).filter(item => item.calories > fastBreakCalories).map(item => item.timestamp);
  const firstMealTime = firstMealTimes.length ? Math.min(...firstMealTimes) : null;


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

  const [caloriesAsk, setCaloriesAsk] = useState<CaloriesAsk | null>(null);

  /** Ticks planned meals off and logs them: at their slot's usual time (`timed`), or now. */
  const logPlannedMeals = async (indices: number[], plan: DayPlan, timed: boolean) => {
    const now = Date.now();
    const meals = indices.map(i => plan.meals[i]).filter(Boolean);
    if (!meals.length) return;
    const completedMealIds = [...new Set([...plan.completedMealIds, ...meals.map(mealKey)])];
    await saveDayPlan({ ...plan, completedMealIds });
    await onLogMeals(meals.map(meal => ({ meal, at: timed ? plannedTime(slotFor(meal), now) : now })));
    refreshData();
    if (timed) {
      const kcal = meals.reduce((sum, meal) => sum + mealCalories(meal), 0);
      setToast({ message: `Logged ${meals.length} meal${meals.length === 1 ? '' : 's'} · ${kcal.toLocaleString()} kcal` });
    }
  };

  /** Quick meals planned without calories are asked for them first, so nothing is logged as 0 kcal. */
  const logPlanned = async (indices: number[], timed: boolean, plan: DayPlan = todayPlan) => {
    const queue = indices.filter(i => plan.meals[i]?.quick?.noCalories);
    if (queue.length) {
      setCaloriesAsk({ indices, plan, timed, queue, total: queue.length });
      return;
    }
    await logPlannedMeals(indices, plan, timed);
  };

  const answerCalories = (calories: number | null, estimated = false) => {
    if (!caloriesAsk) return;
    const [current, ...rest] = caloriesAsk.queue;
    let { indices, plan } = caloriesAsk;
    if (calories === null) {
      indices = indices.filter(i => i !== current);
    } else {
      const meal = plan.meals[current];
      const updated: Recipe = { ...meal, calories, quick: { ...meal.quick, noCalories: undefined, estimated: estimated || undefined } };
      plan = { ...plan, meals: plan.meals.map((m, i) => (i === current ? updated : m)) };
    }
    if (rest.length) {
      setCaloriesAsk({ ...caloriesAsk, indices, plan, queue: rest });
      return;
    }
    setCaloriesAsk(null);
    if (indices.length) logPlannedMeals(indices, plan, caloriesAsk.timed);
  };

  const toggleMeal = async (mealIndex: number) => {
    const meal = todayPlan.meals[mealIndex];
    if (!meal) return;
    if (!todayPlan.completedMealIds.includes(mealKey(meal)) && meal.quick?.noCalories) {
      await logPlanned([mealIndex], false);
      return;
    }

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

  // The hero's "Next up": the earliest planned meal by slot time that isn't eaten yet
  const nextMealIndex = todayPlan.meals
    .map((meal, index) => ({ meal, index }))
    .filter(({ meal }) => !isMealEaten(todayPlan, meal))
    .sort((a, b) => slotTime(slotFor(a.meal)) - slotTime(slotFor(b.meal)) || a.index - b.index)[0]?.index;

  /** Deletes at once with Undo. An entry logged from the plan also unticks that meal (and Undo ticks it again). */
  const handleDeleteFoodItem = async (itemId: string) => {
    const item = dailyLog.items?.find(i => i.id === itemId);
    if (!item) return;
    const key = item.planInstanceId;
    const untick = !!key && todayPlan.completedMealIds.includes(key);
    await onDeleteFoodItem(itemId);
    if (untick) {
      await saveDayPlan({ ...todayPlan, completedMealIds: todayPlan.completedMealIds.filter(id => id !== key) });
      refreshData();
    }
    setToast({
      message: `Deleted ${item.name}`,
      undo: async () => {
        await onRestoreFoodItem(item);
        if (untick) {
          const plan = await getDayPlan(todayPlan.date);
          await saveDayPlan({ ...plan, completedMealIds: [...new Set([...plan.completedMealIds, key])] });
          refreshData();
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

  const tomorrowCard = <TomorrowCard plan={tomorrowPlan} stats={stats} onPlan={() => navigate('/mealplanner', { state: { date: tomorrowPlan.date } })} />;

  // "Market day" look: tonight's dinner, else the next meal still to eat
  const dinnerIndex = todayPlan.meals.findIndex(meal => slotFor(meal) === 'dinner');
  const tonightIndex = dinnerIndex >= 0 ? dinnerIndex : nextMealIndex;
  const tonightMeal = tonightIndex === undefined ? undefined : todayPlan.meals[tonightIndex];
  const proteinToday = { eaten: (dailyLog.items || []).reduce((sum, item) => sum + (item.protein || 0), 0), target: proteinTarget(stats) };

  return (
    <div className="space-y-8">
      {market ? (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <CaloriesHero
              caloriesGoal={dailyTarget}
              caloriesEaten={consumed}
              caloriesBurned={caloriesBurned}
              burnCredit={stats.workoutCalorieCredit ?? 1}
              protein={proteinToday}
              isFastDay={!isNonFastDay}
              meals={{ total: todayPlan.meals.length, eaten: todayPlan.meals.filter(meal => isMealEaten(todayPlan, meal)).length }}
              onLogFood={onOpenFoodModal}
            />
            <TonightCard
              meal={tonightMeal}
              eaten={!!tonightMeal && isMealEaten(todayPlan, tonightMeal)}
              onView={() => tonightMeal && setSelectedRecipe(tonightMeal)}
              onSwap={() => tonightIndex !== undefined && handleSwapMeal(tonightIndex)}
              onPlan={() => navigate('/mealplanner', { state: { date: todayPlan.date } })}
            />
          </div>
          <TodayStrip
            water={{ liters: (dailyLog.waterIntake || 0) / 1000, goal: stats.dailyWaterGoal ? stats.dailyWaterGoal / 1000 : 2.5, onAdd: handleAddWaterClick }}
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
            }}
          />
        </div>
      ) : (
      /* Today: one hero block, then metric tiles */
      <div className="space-y-3">
        <HearthWidget
          caloriesGoal={dailyTarget}
          caloriesEaten={consumed}
          caloriesBurned={caloriesBurned}
          burnCredit={stats.workoutCalorieCredit ?? 1}
          protein={{ eaten: (dailyLog.items || []).reduce((sum, item) => sum + (item.protein || 0), 0), target: proteinTarget(stats) }}
          isFastDay={!isNonFastDay}
          onLogFood={onOpenFoodModal}
          nextMeal={nextMealIndex === undefined ? undefined : {
            meal: todayPlan.meals[nextMealIndex],
            onAte: () => toggleMeal(nextMealIndex),
            onView: () => setSelectedRecipe(todayPlan.meals[nextMealIndex]),
          }}
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
            scale={weightInfo.scale}
            lastDate={weightInfo.lastDate}
            trend={weightInfo.trend}
            readings={weightInfo.readings}
            goalWeight={stats.goalWeight}
            today={dailyLog.date}
            onAddWeight={onOpenWeightModal}
            onClick={() => onNavigate(AppView.ANALYTICS)}
          />
          <ActivityCard
            caloriesBurned={caloriesBurned}
            workoutTypes={(dailyLog.workouts || []).map(w => w.type)}
            history={effectiveHistory}
            today={dailyLog.date}
            onAddWorkout={() => onOpenWorkoutModal()}
            onClick={() => setIsWorkoutOverviewOpen(true)}
            streak={analyzeActivityStreaks(effectiveHistory).currentStreak}
          />
          <FastingCard
            elapsedHours={elapsedFastingHours}
            targetHours={fastingState.config.targetFastHours}
            lastAteTime={fastingState.lastAteTime}
            firstMealTime={firstMealTime}
            history={effectiveHistory}
            today={dailyLog.date}
          />
        </div>
      </div>
      )}

      {/* Evening: log the rest of the plan in one tap */}
      <AtePlannedCard plan={todayPlan} onLogAll={indices => logPlanned(indices, true)} />

      {/* Thursday and Friday: plan the weekend ahead */}
      <WeekendPlanCard weekendGap={recentWeekendGap} onPlan={date => navigate('/mealplanner', { state: { date } })} />

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
        caloriesLeft={dailyTarget - consumed + creditedBurn(caloriesBurned, stats)}
        frequentFoods={frequentFoods}
        onQuickLog={handleQuickLog}
        onLogFood={onOpenFoodModal}
        dayStatus={dailyLog.status}
        dayCounts={isCompleteDay(consumed, dailyTarget, dailyLog.status)}
        onSetDayStatus={onSetDayStatus}
        planAside={tomorrowCard}
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

      {/* Tomorrow: here on phones, beside the plan from lg up */}
      <div className="lg:hidden">{tomorrowCard}</div>

      {caloriesAsk && (
        <MealCaloriesSheet
          key={caloriesAsk.queue[0]}
          meal={caloriesAsk.plan.meals[caloriesAsk.queue[0]]}
          progress={caloriesAsk.total > 1 ? `${caloriesAsk.total - caloriesAsk.queue.length + 1} of ${caloriesAsk.total}` : undefined}
          onSave={(calories, estimated) => answerCalories(calories, estimated)}
          onSkip={() => answerCalories(null)}
          onClose={() => setCaloriesAsk(null)}
        />
      )}

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] flex items-center gap-3 badge-ink !rounded-full pl-4 pr-1.5 py-1.5 text-sm font-semibold shadow-[var(--elev-md)] animate-fade-in max-w-[calc(100vw-32px)]">
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
