import type { PlannedIntakeTicks, PlannedMealIntakeEntry, PlannedMealIntakeResult, UserExperience } from '../types';
import { dayNutrition, nutritionLabel } from '../utils/recipeNutrition';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CalendarPlus, Check, ChevronLeft, CircleAlert, ChevronRight, CopyPlus, Flame, Package, Plus, Repeat, ShoppingBasket, UsersRound } from 'lucide-react';
import { DayPlan, MealSlot, Recipe, UserStats } from '../types';
import { getCachedPlansInRange, getDayPlan, getDayPlansInRange, getRecipes, saveDayPlan, saveFamilyMealOut, subscribeFamilyMeals, withFamilyMeals } from '../services/storageService';
import { familyData } from '../services/pageData';
import { isAddedBy, withAuthorNames } from '../utils/recipeAuthors';
import { usePrewarmed } from '../utils/prewarm';
import { currentUid } from '../services/firebase';
import { getCachedRecipes } from '../utils/cacheService';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { mealVisualFor } from '../utils/mealVisual';
import {
  MEAL_SLOTS, addDays, dayCalories, decideEatingOut, dayKcalApprox, dayMealsWithoutKcal, dayTarget, emptyDayPlan, isBudgetMeal, isFastDay, isMealEaten,
  isQuickMeal, mealCalories, mealKcalLabel, mealKcalSpoken, mealKey, planMeal, planRecipe, setFamilyMealOut, slotFor, slotLabel, weekDates, rangeStart, isoWeek,
} from '../utils/planUtils';
import { RecipeDetailModal } from './RecipeDetailModal';
import { CookingMode } from './CookingMode';
import { WeekPlannerSheet } from './WeekPlannerSheet';
import { Proposal } from '../utils/weekPlanner';
import { AddMode, LeftoverOption, PlannerAddSheet } from './PlannerAddSheet';
import { PlannerMealSheet } from './PlannerMealSheet';
import { EatingOutDecideSheet } from './EatingOutDecideSheet';

interface AddTarget { date: string; slot: MealSlot; mode: AddMode; index?: number }
interface MealTarget { date: string; index: number }

const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });
const longDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long' });
/** A Monday after the first day shown: where a new calendar week starts within the seven days */
const startsWeek = (date: string, index: number) => index > 0 && parseLocalDate(date).getDay() === 1;

/**
 * Week board: seven days from today (paging seven at a time), each with breakfast, lunch, dinner and
 * snack slots, so the days still to plan always fill it. A marker shows where a calendar week starts.
 * With a family group, a meal can be the family's (new dinners start out that way) or just the user's.
 */
export const Planner: React.FC<{
  stats: UserStats;
  onPlanChanged?: () => void;
  /** Logs a meal of today's as eaten (asking for unknown calories first). Without it there's no eaten action */
  onRequestPlannedIntake?: (entries: PlannedMealIntakeEntry[], onTick?: PlannedIntakeTicks) => Promise<PlannedMealIntakeResult>;
  /** Plan meals shows the meals without calories, targets, fast days or calorie-driven planning */
  experience?: UserExperience;
}> = ({ stats, onPlanChanged, onRequestPlannedIntake, experience = 'tracking' }) => {
  const planning = experience === 'planning';
  const location = useLocation();
  const today = localDateString();
  // The first of the seven days shown: today, or today plus or minus a multiple of seven
  const [start, setStart] = useState(today);
  // Left open past midnight, the page showing yesterday moves on to the new today
  const lastToday = useRef(today);
  useEffect(() => {
    if (lastToday.current === today) return;
    const previous = lastToday.current;
    lastToday.current = today;
    setStart(s => (s === previous ? today : rangeStart(s, today)));
  }, [today]);
  const dates = useMemo(() => weekDates(start), [start]);
  const [plans, setPlans] = useState<Record<string, DayPlan>>(() => getCachedPlansInRange(start, addDays(start, 6)) || {});
  const plansRef = useRef(plans);
  plansRef.current = plans;
  const [loadedWeeks, setLoadedWeeks] = useState<Set<string>>(new Set());
  const [recipes, setRecipes] = useState<Recipe[]>(() => getCachedRecipes() || []);
  // Family with other members, and their names (loaded in the background after sign-in)
  const family = usePrewarmed(familyData) ?? null;

  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [mealTarget, setMealTarget] = useState<MealTarget | null>(null);
  /** The eating-out budget being filled in with a real meal */
  const [decideTarget, setDecideTarget] = useState<MealTarget | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);
  const [cookRecipe, setCookRecipe] = useState<Recipe | null>(null);
  /** Where the meal being cooked is planned, so it can be ticked off when it's today's */
  const [cookTarget, setCookTarget] = useState<MealTarget | null>(null);
  const [showWeekPlanner, setShowWeekPlanner] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const inFamily = !!family;
  const myUid = currentUid();
  // All recipes are the family's; the add sheet can filter to the ones the user added
  const [myRecipes, familyRecipes] = useMemo(() => {
    const named = withAuthorNames(recipes, myUid, family?.names);
    return [named.filter(r => isAddedBy(r, myUid)), named.filter(r => !isAddedBy(r, myUid))];
  }, [recipes, myUid, family]);

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

  // Phones show one day at a time, picked from a strip of the seven days
  const [selectedDate, setSelectedDate] = useState(today);
  // New days shown keep the picked day if it's among them, else pick the first (today, on the first page)
  useEffect(() => {
    setSelectedDate(d => (rangeStart(d, today) === start ? d : start));
  }, [start, today]);
  const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

  // Opened with a date (e.g. "Plan tomorrow" on Today): show that week, scrolled to the day.
  const [scrollToDate, setScrollToDate] = useState<string | null>(null);
  useEffect(() => {
    const state = location.state as { date?: string } | null;
    if (state?.date) { setStart(rangeStart(state.date, today)); setScrollToDate(state.date); setSelectedDate(state.date); }
  }, [location.key]);

  // Also re-runs each time the page is shown again (App keeps it in an Activity), so meals
  // ticked off on Today appear without a loading state
  useEffect(() => { loadWeek(start); }, [start, loadWeek]);

  // Family meals other members plan, move or remove appear as they happen (only while the
  // Planner is shown: a hidden page's effects are paused)
  useEffect(() => subscribeFamilyMeals(start, addDays(start, 6), familyMeals => {
    const next = { ...plansRef.current };
    Object.entries(familyMeals).forEach(([date, meals]) => { next[date] = withFamilyMeals(next[date] || emptyDayPlan(date), meals); });
    plansRef.current = next;
    setPlans(next);
  }), [start]);

  useEffect(() => {
    // Keep the cached list if the refresh comes back empty (offline)
    getRecipes()
      .then(fresh => { if (fresh.length > 0 || !getCachedRecipes()) setRecipes(fresh); })
      .catch(e => console.error('Failed to load recipes', e));
  }, []);

  useEffect(() => {
    if (!scrollToDate || !loadedWeeks.has(rangeStart(scrollToDate, today))) return;
    // With the day strip the day is already picked and shown, so phones stay at the top
    if (!isPhone()) document.getElementById(`day-${scrollToDate}`)?.scrollIntoView({ block: 'start' });
    setScrollToDate(null);
  }, [scrollToDate, loadedWeeks]);

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
      loadWeek(start);
    }
  };
  const updateDay = (date: string, change: (plan: DayPlan) => DayPlan) => updateDays({ [date]: change });

  /**
   * A planned copy of a recipe for a slot (a new dinner is the family's).
   */
  const newMeal = (recipe: Recipe, slot: MealSlot, extra: Partial<Recipe> = {}) => {
    // Eating out is personal: a budget never becomes a family meal
    const personal: Partial<Recipe> = isBudgetMeal(recipe) ? { familyMeal: false } : {};
    return planRecipe(recipe, slot, { inFamily, addedBy: myUid }, { ...extra, ...personal });
  };

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
        const meal = newMeal(recipe, slot, { familyMeal: old.familyMeal, notEating: old.notEating });
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
      const leftover = newMeal(source, slot, { isLeftover: true, sides: source.sides, familyMeal: false });
      updateDay(date, plan => ({ ...plan, meals: [...plan.meals, leftover] }));
      showToast(`Planned leftovers of ${source.name}`);
      return;
    }

    // A quick meal says itself whether it's the family's (its form asks); a recipe goes by the slot
    const sharing = isQuickMeal(recipe) && recipe.familyMeal !== undefined ? { familyMeal: recipe.familyMeal } : {};
    updateDay(date, plan => ({ ...plan, meals: [...plan.meals, newMeal(recipe, slot, sharing)] }));
    showToast(`Added ${recipe.name} to ${longDay(date)}`);
  };

  /** Adds the week planner's meals, and saves the days it made fast or nourish days */
  const addWeekPlan = async (proposals: Proposal[], fastDays: Record<string, boolean>) => {
    const changes: Record<string, (plan: DayPlan) => DayPlan> = {};
    new Set([...proposals.map(p => p.date), ...Object.keys(fastDays)]).forEach(date => {
      const added = proposals.filter(p => p.date === date).map(p => (p.leftover
        ? newMeal(p.recipe, p.slot, { isLeftover: true, familyMeal: false, sides: p.sides })
        : newMeal(p.recipe, p.slot)));
      changes[date] = plan => ({
        ...plan,
        ...(date in fastDays && { type: fastDays[date] ? 'fast' : 'non-fast' }),
        meals: [...plan.meals, ...added],
      });
    });
    await updateDays(changes);
    if (proposals.length) showToast(`Added ${proposals.length} meal${proposals.length === 1 ? '' : 's'} to the week`);
  };

  const moveMeal = (from: MealTarget, toDate: string, toSlot: MealSlot, copy: boolean) => {
    const meal = planFor(from.date).meals[from.index];
    if (!meal) return;
    // A family meal stays the family's wherever it goes (a copy starts with everyone eating)
    const placed: Recipe = {
      ...meal,
      slot: toSlot,
      instanceId: copy ? crypto.randomUUID() : meal.instanceId,
      familyMeal: inFamily && !!meal.familyMeal,
      notEating: copy ? undefined : meal.notEating,
      isPacked: toSlot === 'lunch' ? meal.isPacked : false,
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
    const leftover = newMeal(meal, 'lunch', { isLeftover: true, sides: meal.sides, familyMeal: false });
    updateDay(tomorrow, plan => ({ ...plan, meals: [...plan.meals, leftover] }));
    showToast(`Planned leftovers for ${longDay(tomorrow)} lunch`);
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

  /** Logs one of today's meals as eaten after cooking it, the same way ticking it on Today does. The
   *  tick shows as soon as it's saving and goes again if the save fails; skipping or closing the
   *  calorie question changes nothing. */
  const markEaten = async (meal: Recipe) => {
    if (!onRequestPlannedIntake) return;
    const showTicks = (keys: string[], ticked: boolean) => {
      const plan = planFor(today);
      const completedMealIds = ticked ? [...new Set([...plan.completedMealIds, ...keys])] : plan.completedMealIds.filter(id => !keys.includes(id));
      plansRef.current = { ...plansRef.current, [today]: { ...plan, completedMealIds } };
      setPlans(plansRef.current);
    };
    try {
      const result = await onRequestPlannedIntake([{ meal, at: Date.now() }], showTicks);
      if (result.status !== 'saved' || !result.loggedKeys.length) return;
      showToast(`Marked ${meal.name} as eaten`);
      onPlanChanged?.();
    } catch (e) {
      console.error('Failed to mark the meal as eaten', e);
      showToast(e instanceof Error ? e.message : "Couldn't save that. Check your connection.");
    }
  };

  const editMeal = (target: MealTarget, change: (meal: Recipe) => Recipe) =>
    updateDay(target.date, plan => ({ ...plan, meals: replaceAt(plan.meals, target.index, change(plan.meals[target.index])) }));

  /** Shares a meal with the family, or keeps it just for the user */
  const setFamilyMeal = (target: MealTarget, shared: boolean) => {
    editMeal(target, m => ({ ...m, familyMeal: shared, notEating: undefined }));
    showToast(shared ? 'Shared with your family' : 'Now just yours');
  };

  /** The user isn't eating a family meal (out), or is again */
  const setOut = (date: string, meal: Recipe, out: boolean) => {
    if (!myUid || !meal.instanceId) return;
    const next = setFamilyMealOut(planFor(date), meal.instanceId, myUid, out);
    plansRef.current = { ...plansRef.current, [date]: next };
    setPlans(plansRef.current);
    saveFamilyMealOut(next, meal.instanceId, out)
      .then(() => onPlanChanged?.())
      .catch(e => {
        console.error('Failed to save plan', e);
        showToast("Couldn't save that change. Check your connection.");
        loadWeek(start);
      });
    showToast(out ? `You're not eating ${meal.name}` : `You're eating ${meal.name}`);
  };

  /** Other family members not eating a family meal */
  const outNames = (meal: Recipe) => (meal.notEating || [])
    .filter(id => id !== myUid)
    .map(id => family?.names.get(id) || 'Someone');

  const toggleFastDay = (date: string) => updateDay(date, plan => ({ ...plan, type: isFastDay(plan) ? 'non-fast' : 'fast' }));

  /** Fills the empty slots of the days shown from the same weekdays a week earlier. Nothing already planned is replaced. */
  const copyLastWeek = async () => {
    const previous = await getDayPlansInRange(addDays(start, -7), addDays(start, -1));
    let copied = 0;
    const changes: Record<string, (plan: DayPlan) => DayPlan> = {};
    dates.forEach(date => {
      const source = previous[addDays(date, -7)];
      if (!source || source.meals.length === 0) return;
      const current = planFor(date);
      const taken = new Set(current.meals.map(slotFor));
      const additions = source.meals
        .filter(m => !m.isLeftover && slotFor(m) !== 'snack' && !taken.has(slotFor(m)))
        .map(m => newMeal(m, slotFor(m), { familyMeal: inFamily && !!m.familyMeal, isPacked: m.isPacked, sides: m.sides }));
      if (additions.length === 0) return;
      copied += additions.length;
      changes[date] = plan => ({
        ...plan,
        type: plan.type ?? source.type,
        meals: [...plan.meals, ...additions],
      });
    });
    if (copied === 0) {
      showToast('Nothing to copy: the week before was empty or these days are already planned');
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
        // Dinners, and lunches from recipes for more than one, make leftovers
        if (meal.isLeftover || (isQuickMeal(meal) && meal.quick?.kind !== 'home')) return;
        if (!(slot === 'dinner' || (slot === 'lunch' && (meal.servings || 1) > 1)) || (back === 0 && slot === 'lunch')) return;
        leftoverDates.current.set(mealKey(meal), from);
        options.push({ meal, from: `${back === 0 ? 'today’s' : longDay(from)} ${slotLabel(slot).toLowerCase()}`.replace(/^t/, 'T') });
      });
    }
    return options.reverse();
  };

  const isCurrentWeek = start === today;
  const rangeLabel = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
    .formatRange(parseLocalDate(dates[0]), parseLocalDate(dates[6]));
  // Further out, the dates themselves are the title
  const weekTitle = isCurrentWeek ? 'Next 7 days'
    : start === addDays(today, 7) ? 'The 7 days after'
    : start === addDays(today, -7) ? 'The 7 days before'
    : rangeLabel;
  const upcoming = dates.filter(d => d >= today);
  const fastDays = dates.filter(d => isFastDay(plans[d])).length;
  const openSlots = upcoming.reduce((sum, d) => {
    const taken = new Set((plans[d]?.meals || []).map(slotFor));
    return sum + (['breakfast', 'lunch', 'dinner'] as MealSlot[]).filter(s => !taken.has(s)).length;
  }, 0);
  const isLoading = !loadedWeeks.has(start) && dates.every(d => !plans[d]);

  const decideMeal = decideTarget ? planFor(decideTarget.date).meals[decideTarget.index] : undefined;
  const mealSheetMeal = mealTarget ? planFor(mealTarget.date).meals[mealTarget.index] : undefined;
  const addTargetPlan = addTarget ? planFor(addTarget.date) : undefined;
  const addParent = addTarget?.index !== undefined ? addTargetPlan?.meals[addTarget.index] : undefined;
  const addCaloriesLeft = !planning && addTargetPlan && dayNutrition(addTargetPlan).complete
    ? dayTarget(addTargetPlan, stats) - dayCalories(addTargetPlan) + (addTarget?.mode === 'swap' && addParent ? mealCalories(addParent) : 0)
    : undefined;

  // --- Render ---

  // Meal thumbnails: round plates
  const thumb = 'size-11 @min-[66rem]/week:hidden rounded-full';

  const renderMeal = (date: string, plan: DayPlan, meal: Recipe, index: number) => {
    const visual = mealVisualFor(meal);
    const eaten = isMealEaten(plan, meal);
    const addedBy = meal.familyMeal && meal.addedBy && meal.addedBy !== myUid ? family?.names.get(meal.addedBy) : undefined;
    const othersOut = meal.familyMeal ? outNames(meal) : [];
    const quick = isQuickMeal(meal);
    const toBuy = quick ? (meal.ingredients?.length ?? 0) : 0;
    return (
      <li key={meal.instanceId || `${meal.id}-${index}`}>
        <button
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('text/plain', JSON.stringify({ date, index }));
            e.dataTransfer.effectAllowed = 'move';
          }}
          onClick={() => setMealTarget({ date, index })}
          className="w-full flex items-center gap-2.5 py-1.5 px-1.5 -mx-1.5 rounded-[12px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] @min-[66rem]/week:cursor-grab"
          aria-label={`${meal.name}, ${mealKcalSpoken(meal)}${quick ? ', no recipe' : ''}${meal.familyMeal ? ', family meal' : ''}${eaten ? ', eaten' : ''}. Open options`}
        >
          {meal.isMissing ? (
            <span className={`${thumb} flex items-center justify-center shrink-0 bg-surface-sunken text-muted`}>
              <CircleAlert size={18} strokeWidth={2.25} aria-hidden="true" />
            </span>
          ) : meal.image && !quick ? (
            <img src={meal.image} alt="" loading="lazy" className={`${thumb} object-cover shrink-0`} />
          ) : (
            <span className={`${thumb} flex items-center justify-center shrink-0 ${visual.tint} ${quick ? 'border-[1.5px] border-dashed border-border-control' : ''}`}>
              <visual.Icon size={18} strokeWidth={2.25} aria-hidden="true" />
            </span>
          )}
          <span className="flex-1 min-w-0">
            {/* Seven columns are about 150px: a smaller name keeps long (often compound) words whole. No
                automatic hyphens: the page is English, and its rules mangle Swedish names */}
            <span className={`text-[15px] @min-[66rem]/week:text-xs font-semibold leading-snug line-clamp-3 [overflow-wrap:anywhere] ${eaten || meal.isMissing ? 'text-muted' : ''}`}>{meal.name}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted mt-0.5">
              {meal.isMissing ? <span>Swap or remove</span> : !planning && <span className="whitespace-nowrap">{mealKcalLabel(meal)}</span>}
              {toBuy > 0 && <span className="inline-flex items-center gap-0.5" title={`${toBuy} to buy`}><ShoppingBasket size={12} aria-hidden="true" />{toBuy}</span>}
              {meal.sides && meal.sides.length > 0 && <span>· +{meal.sides.length} side{meal.sides.length > 1 ? 's' : ''}</span>}
              {meal.familyMeal && <UsersRound size={12} aria-hidden="true" />}
              {addedBy && <span className="truncate">{addedBy}</span>}
              {othersOut.length > 0 && <span className="truncate">· {othersOut.join(', ')} out</span>}
              {meal.isLeftover && <Repeat size={12} aria-hidden="true" />}
              {meal.isPacked && <Package size={12} aria-hidden="true" />}
            </span>
          </span>
          {eaten && <Check size={16} className="shrink-0 text-secondary" aria-hidden="true" />}
        </button>
      </li>
    );
  };

  /** A family meal the user isn't eating: muted, with a way back in */
  const renderMealOut = (date: string, meal: Recipe) => (
    <li key={meal.instanceId} className="flex items-center gap-2.5 py-1.5">
      <span className="flex-1 min-w-0 text-xs text-muted">
        <span className="font-semibold">{meal.name}</span> · family meal, you're out
      </span>
      <button
        onClick={() => setOut(date, meal, false)}
        className="btn-ghost btn-sm shrink-0"
        aria-label={`Eat ${meal.name} with the family after all`}
      >
        I'm in
      </button>
    </li>
  );

  const renderSlot = (date: string, plan: DayPlan, slot: MealSlot, label: string) => {
    const entries = plan.meals.map((meal, index) => ({ meal, index })).filter(({ meal }) => slotFor(meal) === slot);
    const mealsOut = (plan.familyMealsOut || []).filter(meal => slotFor(meal) === slot);
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
        {entries.length === 0 && mealsOut.length === 0 ? (
          <button
            onClick={() => setAddTarget({ date, slot, mode: 'add' })}
            className="group/add w-[calc(100%+0.75rem)] -mx-1.5 px-1.5 flex items-center justify-between gap-2 min-h-10 @min-[66rem]/week:min-h-9 rounded-[10px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            aria-label={`Add ${slot === 'snack' ? 'a snack' : label.toLowerCase()} on ${longDay(date)}`}
          >
            <span className="text-xs font-semibold text-muted">{label}</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-muted group-hover/add:text-main">
              <Plus size={14} aria-hidden="true" /><span className="@min-[66rem]/week:hidden">Add</span>
            </span>
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 min-h-7">
              <h4 className="font-sans text-xs font-semibold text-muted">
                {label}
              </h4>
              <button
                onClick={() => setAddTarget({ date, slot, mode: 'add' })}
                className="hit-target size-7 -mr-1 flex items-center justify-center rounded-full text-muted hover:bg-surface-sunken hover:text-main focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                aria-label={`Add another ${slot === 'snack' ? 'snack' : label.toLowerCase()} on ${longDay(date)}`}
              >
                <Plus size={16} />
              </button>
            </div>
            <ul>
              {entries.map(({ meal, index }) => renderMeal(date, plan, meal, index))}
              {mealsOut.map(meal => renderMealOut(date, meal))}
            </ul>
          </>
        )}
      </section>
    );
  };

  // The week goes to seven columns when the page has room for them (about 150px a day), not at a
  // screen width: how wide the page is depends on the sidebar too, and narrower columns break names mid-word
  return (
    <div className="space-y-5 pb-4 @container/week">
      {/* Week header */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setStart(s => addDays(s, -7))} className="icon-btn" aria-label="Previous 7 days"><ChevronLeft size={20} /></button>
          <div className="flex-1 min-w-0 text-center md:text-left md:flex-none">
            <h2 className="heading-2">{weekTitle}</h2>
            {weekTitle !== rangeLabel && <p className="text-sm text-muted">{rangeLabel}</p>}
          </div>
          <button onClick={() => setStart(s => addDays(s, 7))} className="icon-btn" aria-label="Next 7 days"><ChevronRight size={20} /></button>
          {!isCurrentWeek && (
            <button onClick={() => setStart(today)} className="btn-ghost btn-sm hidden md:inline-flex">Back to today</button>
          )}
          <div className="hidden md:flex flex-1 justify-end gap-2">
            <button onClick={copyLastWeek} className="btn-secondary btn-sm"><CopyPlus size={16} aria-hidden="true" /> Copy last week</button>
            {!planning && <button onClick={() => setShowWeekPlanner(true)} disabled={upcoming.length === 0} className="btn-secondary btn-sm"><CalendarPlus size={16} aria-hidden="true" /> Plan the week</button>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!planning && <span className={`badge ${fastDays > 0 ? 'badge-fasting' : 'badge-neutral'}`}><Flame size={12} aria-hidden="true" /> {fastDays} fast day{fastDays === 1 ? '' : 's'}</span>}
          {upcoming.length > 0 && (
            <span className="badge badge-neutral">{openSlots === 0 ? 'Every meal planned' : `${openSlots} meal${openSlots === 1 ? '' : 's'} to plan`}</span>
          )}
          {!isCurrentWeek && (
            <button onClick={() => setStart(today)} className="badge badge-neutral md:hidden underline underline-offset-2">Back to today</button>
          )}
        </div>

      </section>

      {/* Phones: pick a day; a dot marks days with meals (filled) or nothing yet (ring) */}
      <div className="grid grid-cols-7 gap-1 md:hidden" aria-label="Days">
        {dates.map((date, i) => {
          const selected = date === selectedDate;
          const planned = (plans[date]?.meals.length ?? 0) > 0;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              aria-pressed={selected}
              aria-current={date === today ? 'date' : undefined}
              aria-label={`${longDay(date)} ${parseLocalDate(date).getDate()}${startsWeek(date, i) ? `, week ${isoWeek(date)}` : ''}${planned ? '' : ', nothing planned'}`}
              className={`relative min-h-16 rounded-[18px] flex flex-col items-center justify-center gap-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${selected ? 'bg-ink text-on-ink' : 'hover:bg-surface-sunken'}`}
            >
              {/* A new calendar week starts here */}
              {startsWeek(date, i) && <span className="absolute -left-[3px] top-2 bottom-2 w-0.5 rounded-full bg-border-control" aria-hidden="true" />}
              <span className={`text-xs font-semibold ${selected ? '' : 'text-muted'}`}>{shortDay(date)}</span>
              <span className={`font-display font-extrabold text-lg leading-6 ${!selected && date === today ? 'text-primary' : !selected && date < today ? 'text-muted' : ''}`}>{parseLocalDate(date).getDate()}</span>
              <span
                className={`size-1.5 rounded-full ${planned ? (selected ? 'bg-on-ink' : 'bg-primary') : `border ${selected ? 'border-on-ink' : 'border-border-control'}`}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      <p className="md:hidden flex justify-center gap-4 -mt-3 text-xs text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary" /> Meals planned</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full border border-border-control" /> Nothing yet</span>
      </p>

      {/* Days */}
      {isLoading ? (
        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 @min-[66rem]/week:grid-cols-7 md:gap-3 @min-[66rem]/week:gap-2" aria-busy="true" aria-label="Loading the week">
          {dates.map(d => <div key={d} className="card h-48 @min-[66rem]/week:h-96 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-4 @min-[66rem]/week:grid-cols-7 md:gap-3 @min-[66rem]/week:gap-x-2">
          {dates.map((date, i) => {
            const plan = plans[date] || emptyDayPlan(date);
            const kcal = dayCalories(plan);
            const nutrition = dayNutrition(plan);
            const approx = dayKcalApprox(plan);
            const withoutKcal = dayMealsWithoutKcal(plan);
            const target = dayTarget(plan, stats);
            const fast = isFastDay(plan);
            const isToday = date === today;
            // Days gone by are left unfilled (dark mode keeps the card outline), so the days still to plan stand out
            const isPast = date < today;
            return (
              <article
                key={date}
                id={`day-${date}`}
                aria-label={`${longDay(date)} ${parseLocalDate(date).getDate()}${startsWeek(date, i) ? `, week ${isoWeek(date)}` : ''}`}
                className={`card relative min-w-0 scroll-mt-24 px-4 pb-2 @min-[66rem]/week:px-3 md:grid md:grid-rows-subgrid md:row-span-5 md:gap-y-0 ${isPast ? '!bg-transparent' : ''} ${date !== selectedDate ? 'max-md:hidden' : ''}`}
              >
                {/* A new calendar week starts here: a line in the gap before the day, named in seven columns */}
                {startsWeek(date, i) && (
                  <>
                    <span className="hidden md:block absolute -left-[7px] @min-[66rem]/week:-left-[5px] top-3 bottom-3 w-0.5 rounded-full bg-border-control" aria-hidden="true" />
                    <span className="hidden @min-[66rem]/week:block absolute left-1 -top-5 text-xs font-semibold text-muted whitespace-nowrap" aria-hidden="true">Week {isoWeek(date)}</span>
                  </>
                )}
                <header className="pt-3.5 pb-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Today is marked by an ink pill on its date */}
                    <h3 className={`font-display font-extrabold text-lg leading-6 ${isPast ? 'text-muted' : ''} ${isToday ? 'bg-ink text-on-ink rounded-full px-2.5 -ml-1 whitespace-nowrap' : ''}`}>
                      {shortDay(date)} {parseLocalDate(date).getDate()}
                    </h3>
                    {!planning && <button
                      onClick={() => toggleFastDay(date)}
                      aria-pressed={fast}
                      aria-label={`Fast day on ${longDay(date)}`}
                      title={fast ? 'Fast day: tap to make it a nourish day' : 'Nourish day: tap to make it a fast day'}
                      className={`shrink-0 inline-flex items-center justify-center gap-1 min-h-8 min-w-8 px-2.5 @min-[66rem]/week:px-0 rounded-full text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${fast ? 'bg-fasting-bg text-fasting-text' : 'bg-surface-sunken text-muted hover:text-main'}`}
                    >
                      <Flame size={14} aria-hidden="true" />
                      {/* Off, it says what tapping does; on, what the day is */}
                      <span className="@min-[66rem]/week:sr-only">{fast ? 'Fast day' : 'Make fast day'}</span>
                    </button>}
                  </div>
                  {!planning && <div>
                    <div className="flex justify-between text-xs mb-1" title={withoutKcal ? `${withoutKcal} meal${withoutKcal > 1 ? 's' : ''} without kcal` : undefined}>
                      <span className={nutrition.complete && kcal > target ? 'text-warning font-semibold' : 'text-muted'}>
                        {isToday && <span className="text-main font-semibold @min-[66rem]/week:sr-only">Today · </span>}
                        {fast && <span className="text-fasting-text font-semibold @min-[66rem]/week:sr-only">Fast · </span>}
                        {nutrition.complete ? `${approx?'≈ ':''}${kcal} / ${target} kcal` : nutritionLabel(nutrition)}
                      </span>
                      {nutrition.complete && kcal > target && <span className="text-warning font-semibold @min-[66rem]/week:hidden">{kcal - target} over</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
                      <div
                        className={`h-full rounded-full ${nutrition.complete && kcal > target ? 'bg-warning' : fast ? 'bg-fasting' : 'bg-calories'}`}
                        style={{ width: `${nutrition.complete && target > 0 ? Math.min(kcal / target, 1) * 100 : 0}%` }}
                      />
                    </div>
                  </div>}
                </header>
                {MEAL_SLOTS
                  .filter(({ slot }) => slot !== 'snack' || plan.meals.some(m => slotFor(m) === 'snack'))
                  .map(({ slot, label }) => renderSlot(date, plan, slot, label))}
              </article>
            );
          })}
        </div>
      )}

      {/* Phones: the week's actions under the day, so the day strip stays near the top */}
    <div className="flex gap-2 md:hidden">
      <button onClick={copyLastWeek} className="btn-secondary btn-sm flex-1 px-3 gap-1.5 whitespace-nowrap"><CopyPlus size={16} aria-hidden="true" /> Copy last week</button>
      {!planning && <button onClick={() => setShowWeekPlanner(true)} disabled={upcoming.length === 0} className="btn-secondary btn-sm flex-1 px-3 gap-1.5 whitespace-nowrap"><CalendarPlus size={16} aria-hidden="true" /> Plan the week</button>}
    </div>

      <p className="hidden lg:block text-xs text-muted">Drag a meal to move it. Hold Alt (Option) while dropping to copy it instead.</p>

      {/* Sheets */}
      {addTarget && addTargetPlan && (
        <PlannerAddSheet
          mode={addTarget.mode}
          inFamily={inFamily}
          slot={addTarget.slot}
          title={
            addTarget.mode === 'side' ? 'Add a side'
              : addTarget.mode === 'swap' ? `Swap ${addParent?.name ?? 'meal'}`
              : `Add to ${longDay(addTarget.date)} ${slotLabel(addTarget.slot).toLowerCase()}`
          }
          caloriesLeft={addCaloriesLeft}
          isFastDay={!planning && isFastDay(addTargetPlan)}
          recipes={myRecipes}
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
          dates={[...dates, ...weekDates(addDays(start, 7))].filter(d => d >= today || dates.includes(d)).slice(0, 14)}
          addedByName={mealSheetMeal.addedBy && mealSheetMeal.addedBy !== myUid ? family?.names.get(mealSheetMeal.addedBy) : undefined}
          outNames={outNames(mealSheetMeal)}
          inFamily={inFamily}
          onView={() => { setViewRecipe(mealSheetMeal); setMealTarget(null); }}
          onCook={() => { setCookRecipe(mealSheetMeal); setCookTarget(mealTarget); setMealTarget(null); }}
          onSwap={() => { setAddTarget({ date: mealTarget.date, slot: slotFor(mealSheetMeal), mode: 'swap', index: mealTarget.index }); setMealTarget(null); }}
          onAddSide={() => { setAddTarget({ date: mealTarget.date, slot: slotFor(mealSheetMeal), mode: 'side', index: mealTarget.index }); setMealTarget(null); }}
          onRemoveSide={i => editMeal(mealTarget, m => ({ ...m, sides: (m.sides || []).filter((_, j) => j !== i) }))}
          onMove={(d, s) => { moveMeal(mealTarget, d, s, false); setMealTarget(null); }}
          onCopy={(d, s) => { moveMeal(mealTarget, d, s, true); setMealTarget(null); }}
          onPlanLeftovers={() => { planLeftoversTomorrow(mealTarget); setMealTarget(null); }}
          onSetShopping={items => editMeal(mealTarget, m => ({ ...m, ingredients: items }))}
          onTogglePacked={() => editMeal(mealTarget, m => ({ ...m, isPacked: !m.isPacked }))}
          onSetFamilyMeal={shared => setFamilyMeal(mealTarget, shared)}
          onNotEating={() => { setOut(mealTarget.date, mealSheetMeal, true); setMealTarget(null); }}
          onRemove={() => { removeMeal(mealTarget); setMealTarget(null); }}
          onDecideEatingOut={() => { setDecideTarget(mealTarget); setMealTarget(null); }}
          onClose={() => setMealTarget(null)}
        />
      )}

      {decideTarget && decideMeal && decideMeal.quick?.kind === 'out' && (
        <EatingOutDecideSheet
          meal={decideMeal}
          onDecide={(name, calories, options) => {
            editMeal(decideTarget, m => decideEatingOut(m, name, calories, options));
            showToast(`Planned ${name}`);
            setDecideTarget(null);
          }}
          onClose={() => setDecideTarget(null)}
        />
      )}

      {viewRecipe && <RecipeDetailModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} />}
      {cookRecipe && (
        <CookingMode
          recipe={cookRecipe}
          onEaten={cookTarget?.date === today && onRequestPlannedIntake && !isMealEaten(planFor(today), cookRecipe) ? () => markEaten(cookRecipe) : undefined}
          onClose={() => { setCookRecipe(null); setCookTarget(null); }}
        />
      )}

      {showWeekPlanner && upcoming.length > 0 && (
        <WeekPlannerSheet
          dates={upcoming}
          plans={plans}
          recipes={recipes}
          stats={stats}
          onSave={addWeekPlan}
          onClose={() => setShowWeekPlanner(false)}
        />
      )}

      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--tab-bar-bottom)+94px)] nav:bottom-8 z-[60] badge-ink !rounded-full !px-4 !py-2.5 text-sm font-semibold shadow-[var(--elev-md)] toast-in max-w-[calc(100vw-32px)] text-center">
          {toast}
        </div>
      )}
    </div>
  );
};
