import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, CircleAlert, ChevronRight, CopyPlus, Flame, Package, Plus, Repeat, ShoppingCart, Sparkles, UsersRound } from 'lucide-react';
import { DayPlan, MealSlot, Recipe, UserStats } from '../types';
import { getCachedPlansInRange, getDayPlan, getDayPlansInRange, getRecipes, saveDayPlan } from '../services/storageService';
import { familyData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { auth } from '../services/firebase';
import { getCachedRecipes } from '../utils/cacheService';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { mealVisualFor } from '../utils/mealVisual';
import {
  MEAL_SLOTS, addDays, dayCalories, dayTarget, emptyDayPlan, isFastDay, isMealEaten, mealCalories, mealKey,
  planMeal, planRecipe, slotFor, slotLabel, weekDates, weekStart,
} from '../utils/planUtils';
import { RecipeDetailModal } from './RecipeDetailModal';
import { CookingMode } from './CookingMode';
import BatchPlannerModal from './BatchPlannerModal';
import { AddMode, LeftoverOption, PlannerAddSheet } from './PlannerAddSheet';
import { PlannerMealSheet } from './PlannerMealSheet';

interface AddTarget { date: string; slot: MealSlot; mode: AddMode; index?: number }
interface MealTarget { date: string; index: number }

const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });
const longDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long' });

/**
 * Week board: Monday to Sunday, each day with breakfast, lunch, dinner and snack slots.
 * With a family group, dinners are shared with the family; the other slots are personal.
 */
export const Planner: React.FC<{ stats: UserStats; onPlanChanged?: () => void }> = ({ stats, onPlanChanged }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const today = localDateString();
  const [monday, setMonday] = useState(() => weekStart(today));
  const dates = useMemo(() => weekDates(monday), [monday]);
  const [plans, setPlans] = useState<Record<string, DayPlan>>(() => getCachedPlansInRange(monday, addDays(monday, 6)) || {});
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const [loadedWeeks, setLoadedWeeks] = useState<Set<string>>(new Set());
  const [recipes, setRecipes] = useState<Recipe[]>(() => getCachedRecipes() || []);
  // Family group, member names and their recipes (loaded in the background after sign-in)
  const family = usePrewarmed(familyData) ?? null;
  const familyRecipes = family?.recipes ?? [];

  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [mealTarget, setMealTarget] = useState<MealTarget | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [cookRecipe, setCookRecipe] = useState<Recipe | null>(null);
  const [showBatchPlanner, setShowBatchPlanner] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const todayRef = useRef<HTMLElement>(null);
  const didScroll = useRef(false);

  const inFamily = !!family;
  const myUid = auth.currentUser?.uid;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(t => (t === message ? null : t)), 2500);
  };

  // --- Loading ---

  const loadWeek = useCallback(async (start: string) => {
    const end = addDays(start, 6);
    const cached = getCachedPlansInRange(start, end);
    if (cached) setPlans(prev => ({ ...cached, ...prev }));
    const fresh = await getDayPlansInRange(start, end);
    setPlans(prev => ({ ...prev, ...fresh }));
    setLoadedWeeks(prev => new Set(prev).add(start));
  }, []);

  // Opened with a date (e.g. "Plan tomorrow" on Today): show that week
  useEffect(() => {
    const date = (location.state as { date?: string } | null)?.date;
    if (date) setMonday(weekStart(date));
  }, [location.key]);

  // Also re-runs each time the page is shown again (App keeps it in an Activity), so meals
  // ticked off on Today appear without a loading state
  useEffect(() => { loadWeek(monday); }, [monday, loadWeek]);

  useEffect(() => {
    // Keep the cached list if the refresh comes back empty (offline)
    getRecipes()
      .then(fresh => { if (fresh.length > 0 || !getCachedRecipes()) setRecipes(fresh); })
      .catch(e => console.error('Failed to load recipes', e));
  }, []);

  // Phones: start at today in the current week
  useEffect(() => {
    if (didScroll.current || monday !== weekStart(today) || !loadedWeeks.has(monday)) return;
    didScroll.current = true;
    if (today !== monday && window.matchMedia('(max-width: 767px)').matches) {
      todayRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [loadedWeeks, monday, today]);

  // --- Saving ---

  const planFor = (date: string) => plansRef.current[date] || emptyDayPlan(date);

  /** Applies changes to several days at once, then saves them. */
  const updateDays = async (changes: Record<string, (plan: DayPlan) => DayPlan>) => {
    const updated: Record<string, DayPlan> = {};
    for (const [date, change] of Object.entries(changes)) {
      const base = plansRef.current[date] || (await getDayPlan(date));
      updated[date] = change(base);
    }
    plansRef.current = { ...plansRef.current, ...updated };
    setPlans(plansRef.current);
    try {
      await Promise.all(Object.values(updated).map(saveDayPlan));
      onPlanChanged?.();
    } catch (e) {
      console.error('Failed to save plan', e);
      showToast("Couldn't save that change. Check your connection.");
      loadWeek(monday);
    }
  };
  const updateDay = (date: string, change: (plan: DayPlan) => DayPlan) => updateDays({ [date]: change });

  /** A planned copy of a recipe for a slot, shared with the family when it's a dinner. */
  const newMeal = (recipe: Recipe, slot: MealSlot, extra: Partial<Recipe> = {}) =>
    planRecipe(recipe, slot, { familySize: family?.memberCount, addedBy: myUid }, extra);

  const replaceAt = (meals: Recipe[], index: number, meal: Recipe) => meals.map((m, i) => (i === index ? meal : m));

  // --- Actions ---

  const handlePick = (recipe: Recipe, options?: { leftoverOf?: Recipe }) => {
    if (!addTarget) return;
    const { date, slot, mode, index } = addTarget;
    setAddTarget(null);

    if (mode === 'side' && index !== undefined) {
      const side = planMeal(recipe, slot, { tags: [...new Set([...(recipe.tags || []), 'side dish'])], addedBy: myUid, ownerId: recipe.ownerId });
      updateDay(date, plan => ({
        ...plan,
        meals: replaceAt(plan.meals, index, { ...plan.meals[index], sides: [...(plan.meals[index].sides || []), side] }),
      }));
      showToast(`Added ${recipe.name} as a side`);
      return;
    }

    if (mode === 'swap' && index !== undefined) {
      updateDay(date, plan => {
        const old = plan.meals[index];
        const meal = newMeal(recipe, slot, { familyDinner: old.familyDinner, cookingServings: old.cookingServings });
        return {
          ...plan,
          meals: replaceAt(plan.meals, index, meal),
          completedMealIds: plan.completedMealIds.filter(id => id !== mealKey(old)),
        };
      });
      showToast(`Swapped in ${recipe.name}`);
      return;
    }

    const source = options?.leftoverOf;
    if (source) {
      const sourceDate = leftoverDates.current.get(mealKey(source));
      const leftover = newMeal(source, slot, { isLeftover: true, sides: source.sides, cookingServings: undefined });
      const changes: Record<string, (plan: DayPlan) => DayPlan> = {
        [date]: plan => ({ ...plan, meals: [...plan.meals, leftover] }),
      };
      if (sourceDate) {
        const addPortion = (plan: DayPlan) => ({
          ...plan,
          meals: plan.meals.map(m => mealKey(m) === mealKey(source) ? { ...m, cookingServings: (m.cookingServings || 1) + 1 } : m),
        });
        const sameDay = changes[sourceDate];
        changes[sourceDate] = sameDay ? (plan => addPortion(sameDay(plan))) : addPortion;
      }
      updateDays(changes);
      showToast(`Planned leftovers of ${source.name}`);
      return;
    }

    updateDay(date, plan => ({ ...plan, meals: [...plan.meals, newMeal(recipe, slot)] }));
    showToast(`Added ${recipe.name} to ${longDay(date)}`);
  };

  const moveMeal = (from: MealTarget, toDate: string, toSlot: MealSlot, copy: boolean) => {
    const meal = planFor(from.date).meals[from.index];
    if (!meal) return;
    const shared = inFamily && toSlot === 'dinner';
    const placed: Recipe = {
      ...meal,
      slot: toSlot,
      instanceId: copy ? crypto.randomUUID() : meal.instanceId,
      familyDinner: shared,
      isPacked: toSlot === 'lunch' ? meal.isPacked : false,
      cookingServings: shared && !meal.familyDinner ? family!.memberCount : meal.cookingServings,
    };
    if (from.date === toDate) {
      updateDay(toDate, plan => ({
        ...plan,
        meals: copy ? [...plan.meals, placed] : replaceAt(plan.meals, from.index, placed),
      }));
    } else {
      const changes: Record<string, (plan: DayPlan) => DayPlan> = {
        [toDate]: plan => ({ ...plan, meals: [...plan.meals, placed] }),
      };
      if (!copy) {
        changes[from.date] = plan => ({
          ...plan,
          meals: plan.meals.filter((_, i) => i !== from.index),
          completedMealIds: plan.completedMealIds.filter(id => id !== mealKey(meal)),
        });
      }
      updateDays(changes);
    }
    showToast(`${copy ? 'Copied' : 'Moved'} ${meal.name} to ${longDay(toDate)} ${slotLabel(toSlot).toLowerCase()}`);
  };

  const planLeftoversTomorrow = (target: MealTarget) => {
    const meal = planFor(target.date).meals[target.index];
    const tomorrow = addDays(target.date, 1);
    const leftover = newMeal(meal, 'lunch', { isLeftover: true, sides: meal.sides, cookingServings: undefined, familyDinner: false });
    updateDays({
      [target.date]: plan => ({
        ...plan,
        meals: replaceAt(plan.meals, target.index, { ...meal, cookingServings: (meal.cookingServings || 1) + 1 }),
      }),
      [tomorrow]: plan => ({ ...plan, meals: [...plan.meals, leftover] }),
    });
    showToast(`Cooking one extra portion for ${longDay(tomorrow)} lunch`);
  };

  const removeMeal = (target: MealTarget) => {
    const meal = planFor(target.date).meals[target.index];
    updateDay(target.date, plan => ({
      ...plan,
      meals: plan.meals.filter((_, i) => i !== target.index),
      completedMealIds: plan.completedMealIds.filter(id => id !== mealKey(meal)),
    }));
    showToast(`Removed ${meal.name}`);
  };

  const editMeal = (target: MealTarget, change: (meal: Recipe) => Recipe) =>
    updateDay(target.date, plan => ({ ...plan, meals: replaceAt(plan.meals, target.index, change(plan.meals[target.index])) }));

  const toggleFastDay = (date: string) => updateDay(date, plan => ({ ...plan, type: isFastDay(plan) ? 'non-fast' : 'fast' }));

  /** Fills this week's empty slots from last week's plan. Nothing already planned is replaced. */
  const copyLastWeek = async () => {
    const previous = await getDayPlansInRange(addDays(monday, -7), addDays(monday, -1));
    let copied = 0;
    const changes: Record<string, (plan: DayPlan) => DayPlan> = {};
    dates.forEach((date, i) => {
      const source = previous[addDays(monday, i - 7)];
      if (!source || source.meals.length === 0) return;
      const current = planFor(date);
      const taken = new Set(current.meals.map(slotFor));
      const additions = source.meals
        .filter(m => !m.isLeftover && (slotFor(m) === 'snack' || !taken.has(slotFor(m))))
        .map(m => newMeal(m, slotFor(m), { cookingServings: m.cookingServings, isPacked: m.isPacked, sides: m.sides }));
      if (additions.length === 0) return;
      copied += additions.length;
      changes[date] = plan => ({
        ...plan,
        type: plan.type ?? source.type,
        meals: [...plan.meals, ...additions],
      });
    });
    if (copied === 0) {
      showToast('Nothing to copy: last week was empty or this week is already planned');
      return;
    }
    await updateDays(changes);
    showToast(`Copied ${copied} meals from last week`);
  };

  // --- Derived ---

  const leftoverDates = useRef(new Map<string, string>());
  const leftoverOptions = (date: string): LeftoverOption[] => {
    leftoverDates.current = new Map();
    const options: LeftoverOption[] = [];
    for (let back = 3; back >= 0; back--) {
      const from = addDays(date, -back);
      (plans[from]?.meals || []).forEach(meal => {
        const slot = slotFor(meal);
        // Dinners, and lunches cooked for more than one, make leftovers
        if (meal.isLeftover || meal.description === 'Eat Out / Custom Meal') return;
        if (!(slot === 'dinner' || (slot === 'lunch' && (meal.cookingServings || 1) > 1)) || (back === 0 && slot === 'lunch')) return;
        leftoverDates.current.set(mealKey(meal), from);
        options.push({ meal, from: `${back === 0 ? 'today’s' : longDay(from)} ${slotLabel(slot).toLowerCase()}`.replace(/^t/, 'T') });
      });
    }
    return options.reverse();
  };

  const isCurrentWeek = monday === weekStart(today);
  const weekTitle = isCurrentWeek ? 'This week'
    : monday === addDays(weekStart(today), 7) ? 'Next week'
    : monday === addDays(weekStart(today), -7) ? 'Last week'
    : `Week of ${parseLocalDate(monday).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  const rangeLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
    .formatRange(parseLocalDate(dates[0]), parseLocalDate(dates[6]));
  const upcoming = dates.filter(d => d >= today);
  const fastDays = dates.filter(d => isFastDay(plans[d])).length;
  const openSlots = upcoming.reduce((sum, d) => {
    const taken = new Set((plans[d]?.meals || []).map(slotFor));
    return sum + (['breakfast', 'lunch', 'dinner'] as MealSlot[]).filter(s => !taken.has(s)).length;
  }, 0);
  const isLoading = !loadedWeeks.has(monday) && dates.every(d => !plans[d]);

  const mealSheetMeal = mealTarget ? planFor(mealTarget.date).meals[mealTarget.index] : undefined;
  const addTargetPlan = addTarget ? planFor(addTarget.date) : undefined;
  const addParent = addTarget?.index !== undefined ? addTargetPlan?.meals[addTarget.index] : undefined;
  const addCaloriesLeft = addTargetPlan
    ? dayTarget(addTargetPlan, stats) - dayCalories(addTargetPlan) + (addTarget?.mode === 'swap' && addParent ? mealCalories(addParent) : 0)
    : 0;

  // --- Render ---

  const renderMeal = (date: string, plan: DayPlan, meal: Recipe, index: number) => {
    const visual = mealVisualFor(meal);
    const eaten = isMealEaten(plan, meal);
    const addedBy = meal.familyDinner && meal.addedBy && meal.addedBy !== myUid ? family?.names.get(meal.addedBy) : undefined;
    return (
      <li key={meal.instanceId || `${meal.id}-${index}`}>
        <button
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ date, index }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={() => setMealTarget({ date, index })}
          className="w-full flex items-center gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-[12px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] xl:cursor-grab"
          aria-label={`${meal.name}, ${mealCalories(meal)} kcal${meal.familyDinner ? ', family dinner' : ''}${eaten ? ', eaten' : ''}. Open options`}
        >
          {meal.isMissing ? (
            <span className="size-9 xl:hidden rounded-[10px] flex items-center justify-center shrink-0 bg-surface-sunken text-muted">
              <CircleAlert size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
          ) : meal.image ? (
            <img src={meal.image} alt="" loading="lazy" className="size-9 xl:hidden rounded-[10px] object-cover shrink-0" />
          ) : (
            <span className={`size-9 xl:hidden rounded-[10px] flex items-center justify-center shrink-0 ${visual.tint}`}>
              <visual.Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
          )}
          <span className="flex-1 min-w-0">
            <span className={`block text-[15px] xl:text-sm font-semibold leading-snug line-clamp-3 [overflow-wrap:anywhere] hyphens-auto ${eaten || meal.isMissing ? 'text-muted' : ''}`}>{meal.name}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted mt-0.5">
              {meal.isMissing ? <span>Swap or remove</span> : <span className="whitespace-nowrap">{mealCalories(meal)} kcal</span>}
              {meal.sides && meal.sides.length > 0 && <span>· +{meal.sides.length} side{meal.sides.length > 1 ? 's' : ''}</span>}
              {meal.familyDinner && <UsersRound size={12} className="text-workout-text" aria-hidden="true" />}
              {addedBy && <span className="truncate">{addedBy}</span>}
              {meal.isLeftover && <Repeat size={12} aria-hidden="true" />}
              {meal.isPacked && <Package size={12} aria-hidden="true" />}
              {(meal.cookingServings || 1) > 1 && !meal.isLeftover && <span>· ×{meal.cookingServings}</span>}
            </span>
          </span>
          {eaten && <Check size={16} className="shrink-0 text-secondary" aria-hidden="true" />}
        </button>
      </li>
    );
  };

  const renderSlot = (date: string, plan: DayPlan, slot: MealSlot, label: string) => {
    const entries = plan.meals.map((meal, index) => ({ meal, index })).filter(({ meal }) => slotFor(meal) === slot);
    const dropKey = `${date}/${slot}`;
    return (
      <section
        key={slot}
        aria-label={`${longDay(date)} ${label.toLowerCase()}`}
        onDragOver={e => { e.preventDefault(); setDragOver(dropKey); }}
        onDragLeave={() => setDragOver(k => (k === dropKey ? null : k))}
        onDrop={e => {
          e.preventDefault();
          setDragOver(null);
          try {
            const from = JSON.parse(e.dataTransfer.getData('text/plain')) as MealTarget;
            const meal = planFor(from.date).meals[from.index];
            if (meal && !(from.date === date && slotFor(meal) === slot)) moveMeal(from, date, slot, e.altKey);
          } catch { /* not a meal */ }
        }}
        className={`min-w-0 border-t border-border py-1.5 md:px-1 md:-mx-1 md:rounded-[10px] transition-colors ${dragOver === dropKey ? 'bg-surface-sunken' : ''}`}
      >
        {entries.length === 0 ? (
          <button
            onClick={() => setAddTarget({ date, slot, mode: 'add' })}
            className="group/add w-[calc(100%+0.75rem)] -mx-1.5 px-1.5 flex items-center justify-between gap-2 min-h-10 xl:min-h-9 rounded-[10px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            aria-label={`Add ${slot === 'snack' ? 'a snack' : label.toLowerCase()} on ${longDay(date)}`}
          >
            <span className="text-xs font-semibold text-muted">{label}</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-muted group-hover/add:text-main">
              <Plus size={14} aria-hidden="true" /><span className="xl:hidden">Add</span>
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 min-h-7">
              <h4 className="font-sans text-xs font-semibold text-muted">
                {label}
                {slot === 'dinner' && inFamily && <span className="sr-only"> (shared with family)</span>}
              </h4>
              <button
                onClick={() => setAddTarget({ date, slot, mode: 'add' })}
                className="size-7 -mr-1 flex items-center justify-center rounded-full text-muted hover:bg-surface-sunken hover:text-main focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                aria-label={`Add another ${slot === 'snack' ? 'snack' : label.toLowerCase()} on ${longDay(date)}`}
              >
                <Plus size={16} />
              </button>
            </div>
            <ul>{entries.map(({ meal, index }) => renderMeal(date, plan, meal, index))}</ul>
          </>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Week header */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMonday(m => addDays(m, -7))} className="icon-btn" aria-label="Previous week"><ChevronLeft size={20} /></button>
          <div className="flex-1 min-w-0 text-center md:text-left md:flex-none">
            <h2 className="heading-2">{weekTitle}</h2>
            <p className="text-sm text-muted">{rangeLabel}</p>
          </div>
          <button onClick={() => setMonday(m => addDays(m, 7))} className="icon-btn" aria-label="Next week"><ChevronRight size={20} /></button>
          {!isCurrentWeek && (
            <button onClick={() => setMonday(weekStart(today))} className="btn-ghost btn-sm hidden md:inline-flex">Back to this week</button>
          )}
          <div className="hidden md:flex flex-1 justify-end gap-2">
            <button onClick={copyLastWeek} className="btn-secondary btn-sm"><CopyPlus size={16} aria-hidden="true" /> Copy last week</button>
            <button onClick={() => setShowBatchPlanner(true)} className="btn-secondary btn-sm"><Sparkles size={16} aria-hidden="true" /> Fill with AI</button>
            <button onClick={() => navigate('/shopping')} className="btn-primary btn-sm"><ShoppingCart size={16} aria-hidden="true" /> Shopping list</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`badge ${fastDays > 0 ? 'badge-fasting' : 'badge-neutral'}`}><Flame size={12} aria-hidden="true" /> {fastDays} fast day{fastDays === 1 ? '' : 's'}</span>
          {upcoming.length > 0 && (
            <span className="badge badge-neutral">{openSlots === 0 ? 'Every meal planned' : `${openSlots} meal${openSlots === 1 ? '' : 's'} to plan`}</span>
          )}
          {inFamily && <span className="badge badge-workout"><UsersRound size={12} aria-hidden="true" /> Dinners shared with family</span>}
          {!isCurrentWeek && (
            <button onClick={() => setMonday(weekStart(today))} className="badge badge-neutral md:hidden underline underline-offset-2">Back to this week</button>
          )}
        </div>

        <div className="flex gap-2 md:hidden">
          <button onClick={() => navigate('/shopping')} className="btn-primary btn-sm flex-1"><ShoppingCart size={16} aria-hidden="true" /> Shopping list</button>
          <button onClick={copyLastWeek} className="btn-secondary btn-sm" aria-label="Copy last week"><CopyPlus size={16} aria-hidden="true" /> Copy</button>
          <button onClick={() => setShowBatchPlanner(true)} className="btn-secondary btn-sm" aria-label="Fill with AI"><Sparkles size={16} aria-hidden="true" /> AI</button>
        </div>
      </section>

      {/* Days */}
      {isLoading ? (
        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 md:gap-3 xl:gap-2" aria-busy="true" aria-label="Loading the week">
          {dates.map(d => <div key={d} className="card h-48 xl:h-96 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 md:gap-3 xl:gap-x-2">
          {dates.map(date => {
            const plan = plans[date] || emptyDayPlan(date);
            const kcal = dayCalories(plan);
            const target = dayTarget(plan, stats);
            const fast = isFastDay(plan);
            const isToday = date === today;
            const isPast = date < today;
            return (
              <article
                key={date}
                ref={isToday ? todayRef : undefined}
                aria-label={`${longDay(date)} ${parseLocalDate(date).getDate()}`}
                className={`card min-w-0 scroll-mt-24 px-4 pb-2 xl:px-3 md:grid md:grid-rows-subgrid md:row-span-5 md:gap-y-0 ${isToday ? 'ring-2 ring-ink' : ''}`}
              >
                <header className="pt-3.5 pb-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`font-display font-extrabold text-lg leading-6 ${isPast ? 'text-muted' : ''}`}>
                      {shortDay(date)} {parseLocalDate(date).getDate()}
                    </h3>
                    <button
                      onClick={() => toggleFastDay(date)}
                      aria-pressed={fast}
                      aria-label={`Fast day on ${longDay(date)}`}
                      title={fast ? 'Fast day: tap to make it a nourish day' : 'Nourish day: tap to make it a fast day'}
                      className={`shrink-0 inline-flex items-center justify-center gap-1 min-h-8 min-w-8 px-2.5 xl:px-0 rounded-full text-xs font-semibold border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${fast ? 'bg-fasting-bg text-fasting-text border-transparent' : 'border-border text-muted hover:bg-surface-sunken hover:text-main'}`}
                    >
                      <Flame size={14} aria-hidden="true" />
                      <span className="xl:sr-only">Fast day</span>
                    </button>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={kcal > target ? 'text-warning font-semibold' : 'text-muted'}>
                        {isToday && <span className="text-main font-semibold xl:sr-only">Today · </span>}
                        {fast && <span className="text-fasting-text font-semibold xl:sr-only">Fast · </span>}{kcal} / {target} kcal
                      </span>
                      {kcal > target && <span className="text-warning font-semibold xl:hidden">{kcal - target} over</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                      <div
                        className={`h-full rounded-full ${kcal > target ? 'bg-warning' : fast ? 'bg-fasting' : 'bg-primary'}`}
                        style={{ width: `${target > 0 ? Math.min(kcal / target, 1) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </header>
                {MEAL_SLOTS.map(({ slot, label }) => renderSlot(date, plan, slot, label))}
              </article>
            );
          })}
        </div>
      )}

      <p className="hidden lg:block text-xs text-muted">Drag a meal to move it. Hold Alt (Option) while dropping to copy it instead.</p>

      {/* Sheets */}
      {addTarget && addTargetPlan && (
        <PlannerAddSheet
          mode={addTarget.mode}
          slot={addTarget.slot}
          title={
            addTarget.mode === 'side' ? 'Add a side'
              : addTarget.mode === 'swap' ? `Swap ${addParent?.name ?? 'meal'}`
              : `Add to ${longDay(addTarget.date)} ${slotLabel(addTarget.slot).toLowerCase()}`
          }
          caloriesLeft={addCaloriesLeft}
          isFastDay={isFastDay(addTargetPlan)}
          recipes={recipes}
          familyRecipes={familyRecipes}
          leftovers={addTarget.mode === 'add' && addTarget.slot !== 'breakfast' ? leftoverOptions(addTarget.date) : []}
          mainMealName={addParent?.name}
          mainMealCalories={addParent?.calories}
          onPick={handlePick}
          onClose={() => setAddTarget(null)}
        />
      )}

      {mealTarget && mealSheetMeal && (
        <PlannerMealSheet
          meal={mealSheetMeal}
          date={mealTarget.date}
          slot={slotFor(mealSheetMeal)}
          dates={[...dates, ...weekDates(addDays(monday, 7))].filter(d => d >= today || dates.includes(d)).slice(0, 14)}
          addedByName={mealSheetMeal.addedBy && mealSheetMeal.addedBy !== myUid ? family?.names.get(mealSheetMeal.addedBy) : undefined}
          inFamily={inFamily}
          onView={() => { setViewRecipe(mealSheetMeal); setMealTarget(null); }}
          onCook={() => { setCookRecipe(mealSheetMeal); setMealTarget(null); }}
          onSwap={() => { setAddTarget({ date: mealTarget.date, slot: slotFor(mealSheetMeal), mode: 'swap', index: mealTarget.index }); setMealTarget(null); }}
          onAddSide={() => { setAddTarget({ date: mealTarget.date, slot: slotFor(mealSheetMeal), mode: 'side', index: mealTarget.index }); setMealTarget(null); }}
          onRemoveSide={i => editMeal(mealTarget, m => ({ ...m, sides: (m.sides || []).filter((_, j) => j !== i) }))}
          onMove={(d, s) => { moveMeal(mealTarget, d, s, false); setMealTarget(null); }}
          onCopy={(d, s) => { moveMeal(mealTarget, d, s, true); setMealTarget(null); }}
          onPlanLeftovers={() => { planLeftoversTomorrow(mealTarget); setMealTarget(null); }}
          onSetCookingServings={n => editMeal(mealTarget, m => ({ ...m, cookingServings: n }))}
          onTogglePacked={() => editMeal(mealTarget, m => ({ ...m, isPacked: !m.isPacked }))}
          onRemove={() => { removeMeal(mealTarget); setMealTarget(null); }}
          onClose={() => setMealTarget(null)}
        />
      )}

      {viewRecipe && <RecipeDetailModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} isOwned={false} />}
      {cookRecipe && <CookingMode recipe={cookRecipe} onClose={() => setCookRecipe(null)} />}

      <BatchPlannerModal
        isOpen={showBatchPlanner}
        onClose={() => {
          setShowBatchPlanner(false);
          loadWeek(monday);
          onPlanChanged?.();
        }}
      />

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[60] badge-ink !rounded-full !px-4 !py-2.5 text-sm font-semibold shadow-[var(--elev-md)] animate-fade-in max-w-[calc(100vw-32px)] text-center">
          {toast}
        </div>
      )}
    </div>
  );
};
