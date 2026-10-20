import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarHeart, ChevronRight, CookingPot, Plus, UsersRound } from 'lucide-react';
import { AppView, DayPlan, MealSlot, Recipe } from '../types';
import { MEAL_SLOTS, PLANNABLE_SLOTS, SLOT_TIMES, isQuickMeal, setFamilyMealOut, slotFor, slotLabel } from '../utils/planUtils';
import { mealVisualFor } from '../utils/mealVisual';
import { saveFamilyMealOut } from '../services/storageService';
import { familyData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { FamilyFaces } from './MemberAvatar';
import { TodayShoppingWidget } from './TodayShoppingWidget';
import { RecipeDetailModal } from './RecipeDetailModal';

/** How long after a slot's usual time its meal still counts as "next" */
const NEXT_WINDOW_MINUTES = 90;

/** The first meal still to come today (by its slot's usual time), or none once the day's meals are past */
export const upcomingMealIndex = (plan: Pick<DayPlan, 'meals'>, now = new Date()): number | undefined => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = (slot: MealSlot) => SLOT_TIMES[slot][0] * 60 + SLOT_TIMES[slot][1];
  return plan.meals
    .map((meal, index) => ({ index, at: slotMinutes(slotFor(meal)) }))
    .filter(({ at }) => at + NEXT_WINDOW_MINUTES > minutes)
    .sort((a, b) => a.at - b.at || a.index - b.index)[0]?.index;
};

const slotClock = (slot: MealSlot) => {
  const [h, m] = SLOT_TIMES[slot];
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

interface PlanTodayProps {
  uid: string;
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  /** Shows a saved change to today's plan straight away */
  onPlanChange: (plan: DayPlan) => void;
  refreshData: () => Promise<void>;
  onNavigate: (view: AppView) => void;
}

/**
 * Today for Plan meals: what's being eaten today and who's eating it, with ways to plan and shop.
 * No calories, ticks or logging; those belong to tracking.
 */
export const PlanToday: React.FC<PlanTodayProps> = ({ uid, todayPlan, tomorrowPlan, onPlanChange, refreshData, onNavigate }) => {
  const navigate = useNavigate();
  const family = usePrewarmed(familyData) ?? null;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);

  const openPlanner = (date = todayPlan.date) => navigate('/mealplanner', { state: { date } });
  const nextIndex = upcomingMealIndex(todayPlan);
  const next = nextIndex !== undefined ? todayPlan.meals[nextIndex] : undefined;
  const mealsOut = todayPlan.familyMealsOut ?? [];

  /** Family members eating a family meal (everyone but those who said they're out) */
  const eaters = (meal: Recipe) => family
    ? [...family.names.keys()].filter(id => !(meal.notEating ?? []).includes(id)).map(id => ({ id, avatar: family.avatars.get(id) }))
    : [];
  const outNames = (meal: Recipe) => (meal.notEating ?? []).filter(id => id !== uid).map(id => family?.names.get(id) || 'Someone');

  const setOut = async (meal: Recipe, out: boolean) => {
    if (!meal.instanceId || saving) return;
    setSaving(meal.instanceId);
    setError(null);
    const next = setFamilyMealOut(todayPlan, meal.instanceId, uid, out);
    try {
      await saveFamilyMealOut(next, meal.instanceId, out);
      onPlanChange(next);
      void refreshData();
    } catch (e) {
      console.error('Failed to save who is eating', e);
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  };

  /** Sides and who's out; whether it's a family meal shows as faces, so it isn't spelled out */
  const mealMeta = (meal: Recipe) => {
    const sides = meal.sides?.length ? `+ ${meal.sides.map(s => s.name).join(', ')}` : undefined;
    const others = meal.familyMeal ? outNames(meal) : [];
    return [sides, others.length ? `${others.join(', ')} out` : undefined].filter(Boolean).join(' · ');
  };

  /** A recipe opens its card; a quick meal has none, so it opens the Planner on its day */
  const openMeal = (meal: Recipe, date = todayPlan.date) => isQuickMeal(meal) ? openPlanner(date) : setViewRecipe(meal);

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]';

  return (
    <div className="space-y-6 pb-4">
      {/* The one bold block: the next meal, or a nudge to plan one */}
      {next ? (
        <section className="hero p-5 md:p-6 space-y-4" aria-labelledby="next-meal-heading">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Next up · {slotLabel(slotFor(next))} around {slotClock(slotFor(next))}</p>
              <h2 id="next-meal-heading" className="mt-2 font-display font-extrabold text-[32px] leading-9 tracking-tight [overflow-wrap:anywhere]">{next.name}</h2>
              {mealMeta(next) && <p className="text-sm font-medium mt-1">{mealMeta(next)}</p>}
            </div>
            {next.image && <img src={next.image} alt="" className="size-20 md:size-28 shrink-0 rounded-full object-cover" />}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {next.familyMeal && eaters(next).length > 0 && (
              <span className="flex items-center gap-2 text-sm font-semibold">
                <FamilyFaces members={eaters(next)} size={32} />
                {eaters(next).length} eating
              </span>
            )}
            <button onClick={() => openMeal(next)} className="btn-primary btn-sm ml-auto">
              {isQuickMeal(next)
                ? <><CalendarHeart size={16} aria-hidden="true" /> Open in Planner</>
                : <><CookingPot size={16} aria-hidden="true" /> See recipe</>}
            </button>
          </div>
        </section>
      ) : (
        <section className="hero p-5 md:p-6 space-y-3" aria-labelledby="next-meal-heading">
          <h2 id="next-meal-heading" className="font-display font-extrabold text-[32px] leading-9 tracking-tight">
            {todayPlan.meals.length ? "That's today's meals" : 'Nothing planned today'}
          </h2>
          <p className="text-sm font-medium">
            {todayPlan.meals.length ? 'Have a look at tomorrow, or plan the rest of the week.' : 'Pick something to cook, or plan the week ahead.'}
          </p>
          <button onClick={() => openPlanner()} className="btn-primary">
            <Plus size={18} aria-hidden="true" /> Plan a meal
          </button>
        </section>
      )}

      {error && <p role="alert" className="text-sm font-medium text-error">{error}</p>}

      {/* Phones: meals, shopping, tomorrow. From md up: meals over tomorrow, shopping beside them */}
      <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] md:items-start">
      {/* Today's meals by slot */}
      <section className="card p-4 md:p-6" aria-labelledby="today-meals-heading">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="today-meals-heading" className="heading-3">Today's meals</h2>
          <button onClick={() => openPlanner()} className="btn-ghost btn-sm">
            Plan the week <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        <ul className="divide-y divide-border">
          {MEAL_SLOTS.filter(({ slot }) => slot !== 'snack' || todayPlan.meals.some(m => slotFor(m) === 'snack')).map(({ slot, label }) => {
            const meals = todayPlan.meals.filter(m => slotFor(m) === slot);
            if (!meals.length) {
              return PLANNABLE_SLOTS.some(s => s.slot === slot) ? (
                <li key={slot} className="py-2">
                  <button onClick={() => openPlanner()} className={`w-full min-h-11 flex items-center gap-3 text-left text-muted hover:text-main rounded-2xl ${focusRing}`}>
                    <span className="size-12 shrink-0 rounded-full border-[1.5px] border-dashed border-border-control flex items-center justify-center" aria-hidden="true"><Plus size={18} /></span>
                    <span className="text-sm font-semibold">Plan {label.toLowerCase()}</span>
                  </button>
                </li>
              ) : null;
            }
            return meals.map(meal => {
              const visual = mealVisualFor(meal);
              const meta = mealMeta(meal);
              const faces = meal.familyMeal ? eaters(meal) : [];
              return (
                <li key={meal.instanceId ?? meal.id} className="py-2">
                  <button onClick={() => openMeal(meal)} className={`w-full min-h-11 flex items-center gap-3 text-left rounded-2xl ${focusRing}`}>
                    {meal.image ? (
                      <img src={meal.image} alt="" loading="lazy" className="size-12 shrink-0 rounded-full object-cover bg-surface-sunken" />
                    ) : (
                      <span className={`size-12 shrink-0 rounded-full flex items-center justify-center ${visual.tint}`} aria-hidden="true">
                        <visual.Icon size={20} strokeWidth={2.25} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-muted">
                        {label}{meal.familyMeal && <span className="sr-only">, family meal</span>}
                      </span>
                      <span className="block font-semibold leading-snug [overflow-wrap:anywhere]">{meal.name}</span>
                      {meta && <span className="block text-xs text-muted">{meta}</span>}
                    </span>
                  </button>
                  {/* Family meals: who's eating, and a quiet way out, under the name */}
                  {meal.familyMeal && meal.instanceId && (
                    <div className="ml-[60px] flex items-center gap-2">
                      {faces.length > 0 && <FamilyFaces members={faces} size={22} />}
                      <button
                        onClick={() => setOut(meal, true)}
                        disabled={saving === meal.instanceId}
                        className={`hit-target text-xs font-semibold text-muted hover:text-main underline underline-offset-2 rounded-full ${focusRing}`}
                        aria-label={`I'm not eating ${meal.name}`}
                      >
                        Not eating
                      </button>
                    </div>
                  )}
                </li>
              );
            });
          })}
        </ul>

        {/* Family meals this person said they're out of, with a way back in */}
        {mealsOut.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            {mealsOut.map(meal => (
              <div key={meal.instanceId} className="flex items-center gap-3">
                <span className="size-10 shrink-0 rounded-full bg-surface-sunken text-muted flex items-center justify-center" aria-hidden="true"><UsersRound size={18} strokeWidth={2.25} /></span>
                <p className="flex-1 min-w-0 text-sm text-muted">You're not eating <span className="font-semibold text-main">{meal.name}</span> ({slotLabel(slotFor(meal)).toLowerCase()})</p>
                <button onClick={() => setOut(meal, false)} disabled={saving === meal.instanceId} className="chip shrink-0">I'm eating</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="md:col-start-2 md:row-start-1 md:row-span-2">
        <TodayShoppingWidget onOpen={() => onNavigate(AppView.SHOPPING)} />
      </div>

      {/* Coming up: tomorrow, as a plain card */}
      <section className="card p-4 md:p-6 md:col-start-1" aria-labelledby="tomorrow-heading">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 id="tomorrow-heading" className="heading-3">Tomorrow</h2>
          <button onClick={() => openPlanner(tomorrowPlan.date)} className="btn-ghost btn-sm">
            Plan <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
        {tomorrowPlan.meals.length ? (
          <ul>
            {[...tomorrowPlan.meals]
              .sort((a, b) => MEAL_SLOTS.findIndex(s => s.slot === slotFor(a)) - MEAL_SLOTS.findIndex(s => s.slot === slotFor(b)))
              .map(meal => (
                <li key={meal.instanceId ?? meal.id}>
                  <button onClick={() => openMeal(meal, tomorrowPlan.date)} className={`w-full min-h-11 py-1 flex items-baseline gap-2 text-sm text-left rounded-2xl hover:bg-surface-sunken ${focusRing}`}>
                    <span className="w-20 shrink-0 text-muted">{slotLabel(slotFor(meal))}</span>
                    <span className="flex-1 font-semibold min-w-0 [overflow-wrap:anywhere]">{meal.name}</span>
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-muted flex items-center gap-2"><CookingPot size={16} aria-hidden="true" /> Nothing planned yet.</p>
        )}
      </section>
      </div>

      {viewRecipe && <RecipeDetailModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} />}
    </div>
  );
};
