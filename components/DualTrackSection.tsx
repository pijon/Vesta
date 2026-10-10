import React, { useState, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { DayPlan, DailyLog, FoodLogItem, WorkoutItem, AppView } from '../types';
import { Portal } from './Portal';
import { Coffee, Salad, Cookie, UtensilsCrossed, Moon, Dumbbell, Trash2, ChevronDown, Check, Shuffle } from 'lucide-react';
import { foodIconFor, mealVisualFor } from '../utils/mealVisual';

interface DualTrackSectionProps {
  todayPlan: DayPlan;
  dailyLog: DailyLog;
  lastAteTime?: number | null;
  onToggleMeal: (index: number) => void;
  onViewRecipe: (recipe: any) => void;
  onEditWorkout: (workout: WorkoutItem) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onUpdateFoodItem: (item: FoodLogItem) => void;
  onDeleteFoodItem: (itemId: string) => void;
  onNavigate: (view: AppView) => void;
  onSwapMeal: (index: number) => void;
}


type LogEntry =
  | { kind: 'food'; id: string; timestamp: number; item: FoodLogItem }
  | { kind: 'workout'; id: string; timestamp: number; workout: WorkoutItem };

const PERIODS = [
  { key: 'late', label: 'Late night', from: 0, to: 5, Icon: Moon },
  { key: 'morning', label: 'Morning', from: 5, to: 11, Icon: Coffee },
  { key: 'midday', label: 'Midday', from: 11, to: 15, Icon: Salad },
  { key: 'afternoon', label: 'Afternoon', from: 15, to: 18, Icon: Cookie },
  { key: 'evening', label: 'Evening', from: 18, to: 24, Icon: UtensilsCrossed },
] as const;

const periodFor = (timestamp: number) => {
  const hour = new Date(timestamp).getHours();
  return PERIODS.find(p => hour >= p.from && hour < p.to) ?? PERIODS[4];
};

// Icon for what was eaten (from the name), else the meal type, else the time of day.
const logIconFor = (item: FoodLogItem) => {
  const food = foodIconFor(item);
  if (food) return food;
  const kind = (item.type || item.tags?.[0] || '').toLowerCase();
  if (kind.includes('breakfast')) return Coffee;
  if (kind.includes('lunch')) return Salad;
  if (kind.includes('snack')) return Cookie;
  if (kind.includes('dinner')) return UtensilsCrossed;
  return periodFor(item.timestamp).Icon;
};

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const COLLAPSED_COUNT = 5;

export const DualTrackSection: React.FC<DualTrackSectionProps> = ({
  todayPlan,
  dailyLog,
  lastAteTime,
  onToggleMeal,
  onViewRecipe,
  onEditWorkout,
  onDeleteWorkout,
  onUpdateFoodItem,
  onDeleteFoodItem,
  onNavigate,
  onSwapMeal
}) => {
  const [editingFoodItem, setEditingFoodItem] = useState<FoodLogItem | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodCalories, setEditFoodCalories] = useState('');
  const [editFoodTime, setEditFoodTime] = useState('');
  const [showAllLoggedItems, setShowAllLoggedItems] = useState(false);
  const [timeSinceMeal, setTimeSinceMeal] = useState<string>('');

  useEffect(() => {
    if (!lastAteTime) {
      setTimeSinceMeal('');
      return;
    }

    const updateTime = () => {
      const now = Date.now();
      const diff = Math.max(0, now - lastAteTime);

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      if (hours > 0) {
        setTimeSinceMeal(`${hours}h ${minutes}m`);
      } else {
        setTimeSinceMeal(`${minutes}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [lastAteTime]);

  const sortedFoodItems = [...(dailyLog.items || [])].sort((a, b) => b.timestamp - a.timestamp);
  const sortedWorkouts = [...(dailyLog.workouts || [])].sort((a, b) => b.timestamp - a.timestamp);

  // One timeline, newest first, grouped by period of the day
  const logEntries: LogEntry[] = [
    ...sortedFoodItems.map(item => ({ kind: 'food' as const, id: item.id, timestamp: item.timestamp, item })),
    ...sortedWorkouts.map(workout => ({ kind: 'workout' as const, id: workout.id, timestamp: workout.timestamp, workout })),
  ].sort((a, b) => b.timestamp - a.timestamp);
  const visibleEntries = showAllLoggedItems ? logEntries : logEntries.slice(0, COLLAPSED_COUNT);
  const entryGroups = visibleEntries.reduce<{ key: string; label: string; entries: LogEntry[] }[]>((groups, entry) => {
    const period = periodFor(entry.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.key === period.key) last.entries.push(entry);
    else groups.push({ key: period.key, label: period.label, entries: [entry] });
    return groups;
  }, []);
  const caloriesEaten = sortedFoodItems.reduce((sum, i) => sum + i.calories, 0);
  const caloriesBurned = sortedWorkouts.reduce((sum, w) => sum + w.caloriesBurned, 0);

  const handleStartEditFood = (item: FoodLogItem) => {
    setEditingFoodItem(item);
    setEditFoodName(item.name);
    setEditFoodCalories(item.calories.toString());

    // Format timestamp to HH:mm for input
    const date = new Date(item.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    setEditFoodTime(`${hours}:${minutes}`);
  };

  const handleSaveEditFood = () => {
    if (!editingFoodItem || !editFoodName.trim() || !editFoodCalories || !editFoodTime) return;

    // Parse new time while keeping original date
    const originalDate = new Date(editingFoodItem.timestamp);
    const [hours, minutes] = editFoodTime.split(':').map(Number);
    originalDate.setHours(hours);
    originalDate.setMinutes(minutes);

    const updatedItem: FoodLogItem = {
      ...editingFoodItem,
      name: editFoodName,
      calories: parseInt(editFoodCalories) || 0,
      timestamp: originalDate.getTime()
    };

    onUpdateFoodItem(updatedItem);
    setEditingFoodItem(null);
    setEditFoodName('');
    setEditFoodCalories('');
    setEditFoodTime('');
  };

  const handleCancelEditFood = () => {
    setEditingFoodItem(null);
    setEditFoodName('');
    setEditFoodCalories('');
    setEditFoodTime('');
  };

  const handleDeleteFood = (itemId: string) => {
    if (confirm('Delete this food entry?')) {
      onDeleteFoodItem(itemId);
    }
  };

  const handleDeleteWorkout = (workoutId: string) => {
    if (confirm('Delete this workout?')) {
      onDeleteWorkout(workoutId);
    }
  };

  const totalLoggedItems = sortedFoodItems.length + sortedWorkouts.length;

  const plannedMeals = todayPlan.meals || [];
  const eatenCount = plannedMeals.filter(m => todayPlan.completedMealIds.includes(m.id)).length;
  const plannedCalories = plannedMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const remainingPlannedCalories = plannedMeals
    .filter(m => !todayPlan.completedMealIds.includes(m.id))
    .reduce((sum, m) => sum + (m.calories || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
      {/* Left: From Your Plan */}
      <div className="card flex flex-col h-full">
        <div className="px-5 md:px-6 pt-5 pb-4">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h3 className="heading-3 text-lg">From your plan</h3>
              <p className="text-sm text-muted mt-0.5">
                {plannedMeals.length === 0
                  ? 'Nothing planned yet'
                  : eatenCount === plannedMeals.length
                    ? `All ${plannedMeals.length} meals eaten · ${plannedCalories} kcal`
                    : `${eatenCount} of ${plannedMeals.length} eaten · ${remainingPlannedCalories} kcal to go`}
              </p>
            </div>
            <button onClick={() => onNavigate(AppView.PLANNER)} className="btn-ghost btn-sm shrink-0">
              Planner
            </button>
          </div>
          {plannedMeals.length > 0 && (
            <div className="flex gap-1 mt-3" role="img" aria-label={`${eatenCount} of ${plannedMeals.length} planned meals eaten`}>
              {plannedMeals.map((meal) => (
                <span
                  key={meal.id}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${todayPlan.completedMealIds.includes(meal.id) ? 'bg-primary' : 'bg-surface-sunken'}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-3 md:px-4 pb-4 flex-1 min-h-[200px]">
          {plannedMeals.length === 0 ? (
            <div className="tile tile-neutral items-center text-center py-8 mx-2">
              <p className="font-semibold">Nothing planned for today</p>
              <p className="text-sm text-muted mt-1 mb-4">Pick a few meals and we'll track them here.</p>
              <button onClick={() => onNavigate(AppView.PLANNER)} className="btn-primary btn-sm">
                Plan my day
              </button>
            </div>
          ) : (
            <ul>
              {plannedMeals.map((meal, index) => {
                const isEaten = todayPlan.completedMealIds.includes(meal.id);
                const visual = mealVisualFor(meal);
                return (
                  <li
                    key={`${meal.id}-${index}`}
                    className="group flex items-center gap-1 rounded-[14px] hover:bg-surface-sunken transition-colors"
                  >
                    <button
                      onClick={() => onViewRecipe(meal)}
                      className={`flex-1 min-w-0 flex items-center gap-3 px-2 py-2.5 text-left rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)] ${isEaten ? 'opacity-60' : ''}`}
                      aria-label={`View recipe: ${meal.name}`}
                    >
                      {meal.image ? (
                        <img src={meal.image} alt="" className="size-12 shrink-0 rounded-[12px] object-cover" />
                      ) : (
                        <span className={`size-12 shrink-0 rounded-[12px] flex items-center justify-center ${visual.tint}`}>
                          <visual.Icon size={22} strokeWidth={2} aria-hidden="true" />
                        </span>
                      )}
                      <span className="flex-1 min-w-0">
                        <span className={`block font-semibold leading-snug line-clamp-2 ${isEaten ? 'text-muted' : ''}`}>{meal.name}</span>
                        <span className="block text-xs text-muted mt-0.5">
                          {visual.label} · <span className="font-semibold text-main">{meal.calories} kcal</span>
                          {!!meal.protein && ` · ${meal.protein} g protein`}
                        </span>
                        {(isEaten || meal.isLeftover || meal.isPacked) && (
                          <span className="flex flex-wrap gap-1 mt-1">
                            {isEaten && <span className="badge badge-weight !py-0">Eaten</span>}
                            {meal.isLeftover && <span className="badge badge-neutral !py-0">Leftover</span>}
                            {meal.isPacked && <span className="badge badge-neutral !py-0">Packed</span>}
                          </span>
                        )}
                      </span>
                    </button>

                    {!isEaten && (
                      <button
                        onClick={() => onSwapMeal(index)}
                        className="size-9 shrink-0 flex items-center justify-center rounded-full text-muted hover:bg-surface hover:text-main transition-[opacity,colors] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                        aria-label={`Swap ${meal.name}`}
                      >
                        <Shuffle size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => onToggleMeal(index)}
                      className={`size-11 shrink-0 mr-0.5 flex items-center justify-center rounded-full border-2 transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${isEaten
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border-control text-transparent hover:text-muted hover:border-main'}`}
                      aria-pressed={isEaten}
                      aria-label={isEaten ? `Mark ${meal.name} as not eaten` : `Mark ${meal.name} as eaten`}
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Right: Today's log, a single timeline */}
      <div className="card flex flex-col h-full">
        <div className="px-5 md:px-6 pt-5 pb-4 flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h3 className="heading-3 text-lg">Today's log</h3>
            <p className="text-sm text-muted mt-0.5">
              {totalLoggedItems === 0
                ? 'Nothing logged yet'
                : [
                    `${caloriesEaten} kcal eaten`,
                    caloriesBurned > 0 ? `${caloriesBurned} burned` : null,
                    timeSinceMeal ? (timeSinceMeal === '0m' ? 'last meal just now' : `last meal ${timeSinceMeal} ago`) : null,
                  ].filter(Boolean).join(' · ')}
            </p>
          </div>
          {totalLoggedItems > 0 && (
            <span className="badge badge-neutral shrink-0">
              {totalLoggedItems} {totalLoggedItems === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>

        <div className="px-3 md:px-4 pb-4 flex-1 min-h-[200px]">
          {logEntries.length === 0 ? (
            <div className="tile tile-neutral items-center text-center py-8 mx-2">
              <p className="font-semibold">Your day starts here</p>
              <p className="text-sm text-muted mt-1">Log a meal or a workout and it will show up on this timeline.</p>
            </div>
          ) : (
            <>
              {entryGroups.map((group) => {
                // Subtotal counts food only; a workout-only period shows what was burned
                const eaten = group.entries.reduce((sum, e) => sum + (e.kind === 'food' ? e.item.calories : 0), 0);
                const burned = group.entries.reduce((sum, e) => sum + (e.kind === 'workout' ? e.workout.caloriesBurned : 0), 0);
                return (
                  <section key={group.key} className="mt-1 first:mt-0">
                    <div className="flex justify-between items-baseline px-2 pt-3 pb-1.5">
                      <h4 className="font-sans text-xs font-semibold text-muted">{group.label}</h4>
                      <span className="text-xs font-semibold text-muted">
                        {eaten > 0 ? `${eaten} kcal` : `−${burned} kcal`}
                      </span>
                    </div>
                    <ul>
                      {group.entries.map((entry) => {
                        const isFood = entry.kind === 'food';
                        const Icon = isFood ? logIconFor(entry.item) : Dumbbell;
                        const name = isFood ? entry.item.name : entry.workout.type;
                        const kcal = isFood ? entry.item.calories : entry.workout.caloriesBurned;
                        return (
                          <li key={entry.id} className="group relative flex items-center gap-1 rounded-[14px] hover:bg-surface-sunken transition-colors">
                            <button
                              onClick={() => (isFood ? handleStartEditFood(entry.item) : onEditWorkout(entry.workout))}
                              className="flex-1 min-w-0 flex items-center gap-3 px-2 py-2.5 text-left rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]"
                              aria-label={`Edit ${name}`}
                            >
                              <span className={`size-10 shrink-0 rounded-[12px] flex items-center justify-center ${isFood ? 'bg-calories-bg text-calories-text' : 'bg-workout-bg text-workout-text'}`}>
                                <Icon size={20} strokeWidth={2} aria-hidden="true" />
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block font-semibold leading-snug line-clamp-2">{name}</span>
                                <span className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                                  <span>{formatTime(entry.timestamp)}</span>
                                  {isFood && entry.item.isLeftover && <span className="badge badge-neutral !py-0">Leftover</span>}
                                  {isFood && entry.item.isPacked && <span className="badge badge-neutral !py-0">Packed</span>}
                                  {!isFood && <span>Workout</span>}
                                </span>
                              </span>
                              <span className={`shrink-0 text-right font-display font-extrabold text-lg leading-6 ${isFood ? 'text-main' : 'text-workout-text'}`}>
                                {isFood ? kcal : `−${kcal}`}
                                <span className="block font-sans text-[11px] font-semibold text-muted leading-3">kcal</span>
                              </span>
                            </button>
                            <button
                              onClick={() => (isFood ? handleDeleteFood(entry.id) : handleDeleteWorkout(entry.id))}
                              className="size-9 shrink-0 mr-1 flex items-center justify-center rounded-full text-muted hover:bg-error-bg hover:text-error transition-[opacity,colors] md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                              aria-label={`Delete ${name}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}

              {logEntries.length > COLLAPSED_COUNT && (
                <button
                  onClick={() => setShowAllLoggedItems(!showAllLoggedItems)}
                  className="btn-ghost btn-sm w-full mt-2"
                  aria-expanded={showAllLoggedItems}
                >
                  {showAllLoggedItems ? 'Show less' : `Show all ${logEntries.length} entries`}
                  <ChevronDown size={16} className={`transition-transform ${showAllLoggedItems ? 'rotate-180' : ''}`} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Food Modal */}
      {editingFoodItem && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-4 animate-fade-in"
            onClick={handleCancelEditFood}
          >
            <div
              className="bg-stone-50 dark:bg-background w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-border dark:border-white/5"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-charcoal/5 dark:border-white/5 flex justify-between items-center bg-charcoal/5 dark:bg-white/5">
                <h3 className="heading-3 text-charcoal dark:text-stone-200">Edit Food Entry</h3>
                <button
                  onClick={handleCancelEditFood}
                  className="p-2 bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-full text-muted dark:text-muted hover:text-charcoal dark:hover:text-stone-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Food Name</label>
                  <input
                    type="text"
                    value={editFoodName}
                    onChange={(e) => setEditFoodName(e.target.value)}
                    className="w-full input bg-charcoal/5 dark:bg-white/5 border-transparent text-charcoal dark:text-stone-200 placeholder-charcoal/40 dark:placeholder-stone-600"
                    placeholder="e.g. Apple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Calories</label>
                  <input
                    type="number"
                    value={editFoodCalories}
                    onChange={(e) => setEditFoodCalories(e.target.value)}
                    className="w-full input bg-charcoal/5 dark:bg-white/5 border-transparent text-charcoal dark:text-stone-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Time Eaten</label>
                  <input
                    type="time"
                    value={editFoodTime}
                    onChange={(e) => setEditFoodTime(e.target.value)}
                    className="w-full input bg-charcoal/5 dark:bg-white/5 border-transparent text-charcoal dark:text-stone-200"
                  />
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button
                  onClick={handleCancelEditFood}
                  className="flex-1 py-3 bg-surface dark:bg-white/5 text-charcoal dark:text-stone-200 font-bold rounded-2xl border border-border dark:border-white/10 hover:bg-surface-sunken dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditFood}
                  disabled={!editFoodName.trim() || !editFoodCalories}
                  className={`flex-1 py-3 font-bold rounded-2xl transition-colors shadow-lg ${!editFoodName.trim() || !editFoodCalories
                    ? 'bg-charcoal/10 text-charcoal/40 cursor-not-allowed shadow-none'
                    : 'bg-primary text-primary-foreground hover:bg-hearth/90'
                    }`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
