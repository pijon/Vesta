import React, { useState, useEffect, useRef } from 'react';
import { DayPlan, DailyLog, DayLogStatus, FoodLogItem, Recipe, WorkoutItem, AppView } from '../types';
import { Sheet } from './Sheet';
import { motion } from 'framer-motion';
import { Coffee, Salad, Cookie, CookingPot, Moon, Trash2, ChevronDown, Check, Shuffle, Plus, BookOpen, UserX } from 'lucide-react';
import { foodIconFor, mealVisualFor } from '../utils/mealVisual';
import { workoutIconFor } from '../utils/workoutVisual';
import { MEAL_SLOTS, isMealEaten, mealCalories, mealKcalLabel, mealKey, slotFor, slotLabel, slotTime } from '../utils/planUtils';
import type { FrequentFood } from '../services/pageData';
import { useMoment } from '../hooks/useMoment';

interface DualTrackSectionProps {
  todayPlan: DayPlan;
  dailyLog: DailyLog;
  onToggleMeal: (index: number) => void;
  onViewRecipe: (recipe: Recipe) => void;
  onEditWorkout: (workout: WorkoutItem) => void;
  onUpdateFoodItem: (item: FoodLogItem) => void;
  onDeleteFoodItem: (itemId: string) => void;
  onNavigate: (view: AppView) => void;
  onSwapMeal: (index: number) => void;
  /** The user isn't eating a family meal (out), or is again; family meals offer this instead of Swap */
  onSetFamilyMealOut: (meal: Recipe, out: boolean) => void;
  /** The plan index of the next meal still to eat, shown as a highlighted row */
  nextIndex?: number;
  /** Calories left today (target − eaten + burned), to say whether the rest of the plan fits */
  caloriesLeft: number;
  frequentFoods: FrequentFood[];
  onQuickLog: (food: FrequentFood) => void;
  onLogFood: () => void;
  /** The user's own mark on today's log, if any */
  dayStatus?: DayLogStatus;
  /** Today counts in averages and the burn estimate (see isCompleteDay) */
  dayCounts: boolean;
  onSetDayStatus: (status: DayLogStatus | undefined) => void;
  /** Shown under the plan card from lg up, where the plan and the log sit side by side (Today passes Coming up: tomorrow and the weekend) */
  planAside?: React.ReactNode;
}

/** Shows a logged name with a capital first letter; what the user typed is stored unchanged. */
const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);


type LogEntry =
  | { kind: 'food'; id: string; timestamp: number; item: FoodLogItem }
  | { kind: 'workout'; id: string; timestamp: number; workout: WorkoutItem };

const PERIODS = [
  { key: 'late', label: 'Late night', from: 0, to: 5, Icon: Moon },
  { key: 'morning', label: 'Morning', from: 5, to: 11, Icon: Coffee },
  { key: 'midday', label: 'Midday', from: 11, to: 15, Icon: Salad },
  { key: 'afternoon', label: 'Afternoon', from: 15, to: 18, Icon: Cookie },
  { key: 'evening', label: 'Evening', from: 18, to: 24, Icon: CookingPot },
] as const;

const periodFor = (timestamp: number) => {
  const hour = new Date(timestamp).getHours();
  return PERIODS.find(p => hour >= p.from && hour < p.to) ?? PERIODS[4];
};

/** Clock time in the device's 12/24-hour style. AM/PM is left out: the period heading (Morning, Evening) says it. */
const clockTime = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
    .formatToParts(new Date(timestamp))
    .filter(part => part.type === 'hour' || part.type === 'minute' || (part.type === 'literal' && part.value.trim()))
    .map(part => part.value)
    .join('');

/** Long days show the latest entries, with the earlier ones a tap away */
const COLLAPSED_COUNT = 6;

/** From this hour the day's log is mostly done, so Today says whether it will count */
const STATUS_FROM_HOUR = 17;

/** Whether today's log counts in averages, with a one-tap way to say otherwise. */
const DayStatusRow: React.FC<{ status?: DayLogStatus; counts: boolean; onSet: (status: DayLogStatus | undefined) => void }> = ({ status, counts, onSet }) => {
  const [text, action] = status === 'complete'
    ? ['Marked as everything you ate today.', <button key="a" onClick={() => onSet(undefined)} className="btn-ghost btn-sm shrink-0">Undo</button>]
    : status === 'incomplete'
      ? ["Marked as not fully logged, so it's left out of your averages.", <button key="a" onClick={() => onSet(undefined)} className="btn-ghost btn-sm shrink-0">Undo</button>]
      : counts
        ? ['Counts towards your averages and daily burn.', <button key="a" onClick={() => onSet('incomplete')} className="btn-ghost btn-sm shrink-0">Not everything is logged</button>]
        : ["Under 40% of today's target, so it won't count in your averages.", <button key="a" onClick={() => onSet('complete')} className="btn-secondary btn-sm shrink-0">That's all I ate</button>];
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border mt-3 pt-3 px-2">
      <p className="text-xs text-muted flex-1 min-w-[12rem]">{text}</p>
      {action}
    </div>
  );
};

export const DualTrackSection: React.FC<DualTrackSectionProps> = ({
  todayPlan,
  dailyLog,
  onToggleMeal,
  onViewRecipe,
  onEditWorkout,
  onUpdateFoodItem,
  onDeleteFoodItem,
  onNavigate,
  onSwapMeal,
  onSetFamilyMealOut,
  nextIndex,
  caloriesLeft,
  frequentFoods,
  onQuickLog,
  onLogFood,
  dayStatus,
  dayCounts,
  onSetDayStatus,
  planAside,
}) => {
  const [editingFoodItem, setEditingFoodItem] = useState<FoodLogItem | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodCalories, setEditFoodCalories] = useState('');
  const [editFoodProtein, setEditFoodProtein] = useState('');
  const [editFoodTime, setEditFoodTime] = useState('');
  const [showAllLoggedItems, setShowAllLoggedItems] = useState(false);
  const [showEaten, setShowEaten] = useState(false);
  const [foldPlan, setFoldPlan] = useState(todayPlan);
  useEffect(() => {
    const timer = setTimeout(() => setFoldPlan(todayPlan), 450);
    return () => clearTimeout(timer);
  }, [todayPlan]);
  // "Log again" fades at the right edge while more chips are scrolled out of view
  const chipsRef = useRef<HTMLDivElement>(null);
  const [chipsFade, setChipsFade] = useState(false);
  const updateChipsFade = () => {
    const el = chipsRef.current;
    if (el) setChipsFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    updateChipsFade();
    window.addEventListener('resize', updateChipsFade);
    return () => window.removeEventListener('resize', updateChipsFade);
  }, [frequentFoods.length]);

  const sortedFoodItems = [...(dailyLog.items || [])].sort((a, b) => b.timestamp - a.timestamp);
  const sortedWorkouts = [...(dailyLog.workouts || [])].sort((a, b) => b.timestamp - a.timestamp);

  // One timeline through the day, morning at the top, grouped by period
  const logEntries: LogEntry[] = [
    ...sortedFoodItems.map(item => ({ kind: 'food' as const, id: item.id, timestamp: item.timestamp, item })),
    ...sortedWorkouts.map(workout => ({ kind: 'workout' as const, id: workout.id, timestamp: workout.timestamp, workout })),
  ].sort((a, b) => a.timestamp - b.timestamp);
  const hiddenCount = !showAllLoggedItems && logEntries.length > COLLAPSED_COUNT + 1 ? logEntries.length - COLLAPSED_COUNT : 0;
  const visibleEntries = logEntries.slice(hiddenCount);
  const entryGroups = visibleEntries.reduce<{ key: string; label: string; entries: LogEntry[] }[]>((groups, entry) => {
    const period = periodFor(entry.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.key === period.key) last.entries.push(entry);
    else groups.push({ key: period.key, label: period.label, entries: [entry] });
    return groups;
  }, []);

  const handleStartEditFood = (item: FoodLogItem) => {
    setEditingFoodItem(item);
    setEditFoodName(item.name);
    setEditFoodCalories(item.calories.toString());
    setEditFoodProtein(typeof item.protein === 'number' ? String(item.protein) : '');

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

    const protein = parseInt(editFoodProtein, 10);
    const { protein: _previous, ...rest } = editingFoodItem;
    const updatedItem: FoodLogItem = {
      ...rest,
      name: editFoodName.trim(),
      calories: parseInt(editFoodCalories, 10) || 0,
      // Empty clears it, so the protein estimate can fill it in again
      ...(Number.isFinite(protein) ? { protein } : {}),
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

  // Deletes at once; Today offers Undo
  const handleDeleteFood = (itemId: string) => onDeleteFoodItem(itemId);


  const plannedMeals = todayPlan.meals || [];
  const mealsOut = todayPlan.familyMealsOut || [];
  const eatenCount = plannedMeals.filter(m => isMealEaten(todayPlan, m)).length;
  const remainingPlannedCalories = plannedMeals
    .filter(m => !isMealEaten(todayPlan, m))
    .reduce((sum, m) => sum + mealCalories(m), 0);
  // Meals in slot order (breakfast → snacks); toggling still uses the plan index.
  // Eaten ones fold into one row (they're in Today's log too); the rest are grouped by slot.
  const inSlotOrder = MEAL_SLOTS.flatMap(({ slot, label }) =>
    plannedMeals.map((meal, index) => ({ meal, index, label })).filter(({ meal }) => slotFor(meal) === slot));
  // Folding follows the plan a beat late, so a tick's pop is seen before the row moves into the eaten row
  const eatenMeals = inSlotOrder.filter(({ meal }) => isMealEaten(foldPlan, meal));
  const allEaten = plannedMeals.length > 0 && eatenMeals.length === plannedMeals.length;
  // A lone eaten meal stays in its slot; two or more (or the whole plan) fold into one row
  const foldEaten = allEaten || eatenMeals.length >= 2;
  const foldMoment = useMoment(foldEaten ? eatenMeals.length : 0);
  const mealsBySlot = MEAL_SLOTS
    .map(({ label }) => ({ label, entries: inSlotOrder.filter(e => e.label === label && !(foldEaten && isMealEaten(foldPlan, e.meal))) }))
    .filter(group => group.entries.length > 0);
  const eatenCalories = eatenMeals.reduce((sum, { meal }) => sum + mealCalories(meal), 0);
  const fits = remainingPlannedCalories <= caloriesLeft;
  // The planned meal an entry was logged from, if it's still in today's plan
  const editingPlanned = editingFoodItem?.planInstanceId
    ? plannedMeals.find(meal => mealKey(meal) === editingFoodItem.planInstanceId)
    : undefined;

  // A period of the log as a heading with its total, then rows with a round icon, the
  // name, time and protein under it, and the calories large on the right
  const renderLogGroup = (group: { key: string; label: string; entries: LogEntry[] }) => {
    const food = group.entries.flatMap(e => (e.kind === 'food' ? [e.item] : []));
    const kcal = food.reduce((sum, item) => sum + item.calories, 0);
    return (
      <section key={group.key} className="pt-3">
        <h3 className="font-sans text-sm font-semibold text-muted pb-1">
          {group.label}{food.length > 0 && ` · ${kcal.toLocaleString()} kcal`}
        </h3>
        <ul className="stagger">
          {group.entries.map(entry => {
            const isFood = entry.kind === 'food';
            const name = displayName(isFood ? entry.item.name : entry.workout.type);
            const FoodIcon = isFood ? foodIconFor({ name: entry.item.name }) ?? CookingPot : null;
            const WorkoutIcon = isFood ? null : workoutIconFor(entry.workout.type);
            const protein = isFood && typeof entry.item.protein === 'number' ? ` · ${entry.item.protein} g protein` : '';
            return (
              <li key={entry.id} className="border-t border-border first:border-t-0">
                <button
                  onClick={() => (isFood ? handleStartEditFood(entry.item) : onEditWorkout(entry.workout))}
                  className="w-full flex items-center gap-3.5 py-3 text-left rounded-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  aria-label={`Edit ${name}`}
                >
                  <span className={`size-11 shrink-0 rounded-full flex items-center justify-center ${isFood ? 'tile-calories' : 'tile-workout'}`}>
                    {FoodIcon && <FoodIcon size={20} strokeWidth={2.25} aria-hidden="true" />}
                    {WorkoutIcon && <WorkoutIcon size={20} stroke={1.75} aria-hidden="true" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-semibold leading-snug line-clamp-2">{name}</span>
                    <span className="block text-sm text-muted tabular-nums">
                      {clockTime(entry.timestamp)}{isFood ? protein : ` · ${entry.workout.caloriesBurned.toLocaleString()} kcal burned`}
                    </span>
                  </span>
                  {isFood && (
                    <span className="shrink-0 font-display font-extrabold text-xl tabular-nums">{entry.item.calories.toLocaleString()}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  // A planned meal as a row on the page, a round plate, the name large and a big tick.
  // The next meal to eat is highlighted: a sunken pill with its time, who it's for and Swap always shown.
  const renderPlateRow = ({ meal, index }: { meal: Recipe; index: number }) => {
    const isEaten = isMealEaten(todayPlan, meal);
    const isNext = index === nextIndex && !isEaten;
    const visual = mealVisualFor(meal);
    const forWho = meal.familyMeal ? 'Family meal' : null;
    const details = [
      slotLabel(slotFor(meal)),
      mealKcalLabel(meal),
      isNext ? forWho : null,
      meal.isLeftover ? 'leftover' : null,
      meal.isPacked ? 'packed' : null,
    ].filter(Boolean).join(' · ');
    return (
      <li
        key={`${meal.id}-${index}`}
        aria-current={isNext ? 'step' : undefined}
        className={isNext
          ? 'group flex items-center gap-2 rounded-[24px] bg-surface-sunken pl-3 pr-2 my-1 [&+li]:border-t-0'
          : 'group flex items-center gap-2 border-t border-border first:border-t-0'}
      >
        <button
          onClick={() => onViewRecipe(meal)}
          className="flex-1 min-w-0 flex items-center gap-3.5 py-3 text-left rounded-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          aria-label={`View recipe: ${meal.name}`}
        >
          {meal.image ? (
            <img src={meal.image} alt="" className={`${isNext ? 'size-16' : 'size-14'} shrink-0 rounded-full object-cover`} />
          ) : (
            <span className={`${isNext ? 'size-16' : 'size-14'} shrink-0 rounded-full flex items-center justify-center ${visual.tint}`}>
              <visual.Icon size={24} strokeWidth={2.25} aria-hidden="true" />
            </span>
          )}
          <span className="flex-1 min-w-0">
            {isNext && (
              <span className="block text-sm font-bold text-secondary">Next up · {clockTime(slotTime(slotFor(meal)))}</span>
            )}
            {!isNext && <span className="block text-sm text-muted">{details}</span>}
            <span className={`text-[17px] font-semibold leading-snug line-clamp-2 ${isEaten ? 'text-muted' : ''}`}>{meal.name}</span>
            {isNext && details && <span className="block text-sm text-muted">{details}</span>}
          </span>
        </button>
        {!isEaten && (
          <button
            onClick={() => (meal.familyMeal ? onSetFamilyMealOut(meal, true) : onSwapMeal(index))}
            className={`hit-target size-9 shrink-0 flex items-center justify-center rounded-full text-muted hover:text-main transition-[opacity,colors] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${isNext
              ? 'hover:bg-surface'
              : 'hover:bg-surface-sunken md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100'}`}
            aria-label={meal.familyMeal ? `I'm not eating ${meal.name}` : `Swap ${meal.name}`}
            title={meal.familyMeal ? 'Not eating this' : undefined}
          >
            {meal.familyMeal ? <UserX size={16} /> : <Shuffle size={16} />}
          </button>
        )}
        <motion.button
          onClick={() => onToggleMeal(index)}
          initial={false}
          animate={{ scale: isEaten ? [1, 1.14, 1] : 1 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          whileTap={{ scale: 0.92 }}
          className={`size-12 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${isEaten
            ? 'bg-ink border-ink text-on-ink'
            : 'border-border-control text-transparent hover:text-muted hover:border-main'}`}
          aria-pressed={isEaten}
          aria-label={isEaten ? `Mark ${meal.name} as not eaten` : `Mark ${meal.name} as eaten`}
        >
          {/* lucide's Check, drawn in when ticked (in full when not, for the hover hint) */}
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <motion.path
              d="M20 6 9 17l-5-5"
              initial={false}
              animate={{ pathLength: isEaten ? [0, 1] : 1 }}
              transition={{ duration: isEaten ? 0.28 : 0, ease: 'easeOut', delay: isEaten ? 0.06 : 0 }}
            />
          </svg>
        </motion.button>
      </li>
    );
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-start">
      {/* Left: From Your Plan (and, on wide screens, what comes after it) */}
      <div className="space-y-6 md:space-y-8">
      <div id="from-your-plan" className="flex flex-col scroll-mt-24">
        <div className="px-1 pb-2">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <h2 className="heading-2">Today’s plate</h2>
              {!allEaten && (
                <p className="text-sm text-muted mt-0.5">
                  {plannedMeals.length === 0
                    ? 'Nothing planned yet'
                    : `${eatenCount} of ${plannedMeals.length} eaten · ${remainingPlannedCalories.toLocaleString()} kcal to go`}
                </p>
              )}
              {remainingPlannedCalories > 0 && (
                <p className={`text-sm mt-0.5 font-semibold ${fits ? 'text-weight-text' : 'text-warning'}`}>
                  {fits
                    ? `Fits your ${Math.max(caloriesLeft, 0).toLocaleString()} kcal left`
                    : `${(remainingPlannedCalories - Math.max(caloriesLeft, 0)).toLocaleString()} kcal more than you have left`}
                </p>
              )}
            </div>
            {/* An empty plate is one line, so it doesn't push the log down */}
            <button onClick={() => onNavigate(AppView.PLANNER)} className={`${plannedMeals.length === 0 ? 'btn-secondary' : 'btn-ghost'} btn-sm shrink-0`}>
              {plannedMeals.length === 0 ? 'Plan my day' : 'Planner'}
            </button>
          </div>
        </div>

        <div className="px-1">
          {plannedMeals.length === 0 ? null : (
            <>
            {foldEaten && (
              <section>
                <button
                  onClick={() => setShowEaten(v => !v)}
                  aria-expanded={showEaten}
                  className="w-full flex items-center gap-3 px-2 py-2.5 text-left rounded-[14px] hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]"
                >
                  <span className={`shrink-0 tile-weight flex items-center justify-center size-14 rounded-full ${foldMoment ? 'moment-pop' : ''}`}>
                    <Check size={20} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold">
                      {allEaten ? 'All planned meals eaten' : `${eatenMeals.length} eaten`} · {eatenCalories.toLocaleString()} kcal
                    </span>
                    <span className="block text-xs text-muted truncate">{eatenMeals.map(({ meal }) => meal.name).join(', ')}</span>
                  </span>
                  <ChevronDown size={18} className={`shrink-0 mr-3 text-muted transition-transform ${showEaten ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {showEaten && <ul className="stagger">{eatenMeals.map(renderPlateRow)}</ul>}
              </section>
            )}
            {mealsBySlot.map(group => (
            <section key={group.label}>
            <ul className="stagger">
              {group.entries.map(renderPlateRow)}
            </ul>
            </section>
            ))}
            </>
          )}
          {/* Family meals the user said they aren't eating: not counted, with a way back in */}
          {mealsOut.length > 0 && (
            <ul className="border-t border-border">
              {mealsOut.map(meal => (
                <li key={meal.instanceId} className="flex items-center gap-3 py-2.5">
                  <span className="flex-1 min-w-0 text-sm text-muted">
                    {slotLabel(slotFor(meal))} · <span className="font-semibold">{meal.name}</span> · family meal, you're out
                  </span>
                  <button
                    onClick={() => onSetFamilyMealOut(meal, false)}
                    className="btn-ghost btn-sm shrink-0"
                    aria-label={`Eat ${meal.name} with the family after all`}
                  >
                    I'm in
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {planAside && <div className="hidden lg:block">{planAside}</div>}
      </div>

      {/* Right: Today's log, a single timeline */}
      <div className="flex flex-col">
        {/* The day's totals are in the hero and the period headings, so the header is just the title */}
        <div className="flex justify-between items-center gap-3 px-1 pb-3">
          <h2 className="heading-2">What you’ve eaten</h2>
          <button onClick={onLogFood} className="btn-secondary btn-sm shrink-0"><Plus size={16} aria-hidden="true" /> Add</button>
        </div>

        {frequentFoods.length > 0 && (
          <div className="px-1 pb-2">
            <p className="text-xs font-semibold text-muted mb-1.5">Log again</p>
            <div
              ref={chipsRef}
              onScroll={updateChipsFade}
              className={`flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5 ${chipsFade ? '[mask-image:linear-gradient(to_right,#000_80%,transparent)]' : ''}`}
            >
              {frequentFoods.map(food => {
                const Icon = foodIconFor({ name: food.name });
                return (
                  <button
                    key={food.name}
                    onClick={() => onQuickLog(food)}
                    aria-label={`Log ${food.name}, ${food.calories} kcal`}
                    className="chip hit-target shrink-0 pl-2.5 pr-3"
                  >
                    {Icon ? <Icon size={15} className="text-calories-text" aria-hidden="true" /> : <Plus size={15} className="text-muted" aria-hidden="true" />}
                    <span className="max-w-[11rem] truncate">{displayName(food.name)}</span>
                    <span className="text-muted font-normal">{food.calories}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-1">
          {logEntries.length === 0 ? (
            <div className="tile tile-neutral items-center text-center py-8 mx-2">
              <p className="font-semibold">Your day starts here</p>
              <p className="text-sm text-muted mt-1">Log a meal or a workout and it will show up on this timeline.</p>
            </div>
          ) : (
            <>
              {(hiddenCount > 0 || showAllLoggedItems) && (
                <button
                  onClick={() => setShowAllLoggedItems(!showAllLoggedItems)}
                  className="btn-ghost btn-sm w-full mb-1"
                  aria-expanded={showAllLoggedItems}
                >
                  {showAllLoggedItems ? 'Show fewer' : `Show ${hiddenCount} earlier ${hiddenCount === 1 ? 'entry' : 'entries'}`}
                  <ChevronDown size={16} className={`transition-transform ${showAllLoggedItems ? '' : 'rotate-180'}`} />
                </button>
              )}

              {entryGroups.map(renderLogGroup)}

              {sortedFoodItems.length > 0 && (dayStatus || new Date().getHours() >= STATUS_FROM_HOUR) && (
                <DayStatusRow status={dayStatus} counts={dayCounts} onSet={onSetDayStatus} />
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit a logged food */}
      {editingFoodItem && (
        <Sheet
          title="Edit food"
          onClose={handleCancelEditFood}
          footer={
            <div className="flex gap-2">
              <button
                onClick={() => { const id = editingFoodItem.id; handleCancelEditFood(); handleDeleteFood(id); }}
                className="btn-ghost !text-error hover:!bg-error-bg"
              >
                <Trash2 size={16} aria-hidden="true" /> Delete
              </button>
              <button onClick={handleSaveEditFood} disabled={!editFoodName.trim() || !editFoodCalories || !editFoodTime} className="btn-primary flex-1">
                Save
              </button>
            </div>
          }
        >
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSaveEditFood(); }}>
            {editingPlanned && (
              <div className="flex items-center justify-between gap-3 rounded-[14px] bg-surface-sunken pl-3 pr-1.5 py-1.5">
                <span className="text-sm text-muted">From your plan · {slotLabel(slotFor(editingPlanned))}</span>
                <button type="button" onClick={() => { const meal = editingPlanned; handleCancelEditFood(); onViewRecipe(meal); }} className="btn-ghost btn-sm">
                  <BookOpen size={16} aria-hidden="true" /> View recipe
                </button>
              </div>
            )}
            <label className="block">
              <span className="block text-sm font-semibold mb-1.5">Food</span>
              <input value={editFoodName} onChange={e => setEditFoodName(e.target.value)} className="input w-full" placeholder="Apple" />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['Calories', editFoodCalories, setEditFoodCalories, 'kcal'],
                ['Protein', editFoodProtein, setEditFoodProtein, 'g'],
              ] as const).map(([label, value, set, unit]) => (
                <label key={label} className="block min-w-0">
                  <span className="block text-sm font-semibold mb-1.5">{label}</span>
                  <span className="relative block">
                    <input
                      value={value}
                      onChange={e => set(e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      placeholder={label === 'Protein' ? '–' : '0'}
                      className={`input w-full ${unit === 'kcal' ? '!pr-11' : '!pr-7'}`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{unit}</span>
                  </span>
                </label>
              ))}
              <label className="block min-w-0">
                <span className="block text-sm font-semibold mb-1.5">Time</span>
                <input type="time" value={editFoodTime} onChange={e => setEditFoodTime(e.target.value)} className="input w-full !px-2" />
              </label>
            </div>
            <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
          </form>
        </Sheet>
      )}
    </div>
  );
};
