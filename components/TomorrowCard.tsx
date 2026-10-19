import { dayNutrition, nutritionLabel } from '../utils/recipeNutrition';
import React from 'react';
import { CalendarHeart, Flame, UsersRound } from 'lucide-react';
import { DayPlan, UserStats } from '../types';
import { MEAL_SLOTS, dayCalories, dayTarget, isFastDay, mealKcalLabel, slotFor } from '../utils/planUtils';
import { mealVisualFor } from '../utils/mealVisual';

interface TomorrowCardProps {
  plan: DayPlan;
  stats: UserStats;
  /** Open the planner at tomorrow */
  onPlan: () => void;
}

/** Tomorrow at a glance: day type, meals by slot and calories against the target. One line when empty. */
export const TomorrowCard: React.FC<TomorrowCardProps> = ({ plan, stats, onPlan }) => {
  const fast = isFastDay(plan);
  const target = dayTarget(plan, stats);
  const planned = dayCalories(plan);
  const nutrition = dayNutrition(plan);
  const meals = plan.meals || [];

  const dayTag = (
    <span className={`badge whitespace-nowrap ${fast ? 'badge-fasting' : 'badge-neutral'}`}>
      {fast && <Flame size={12} aria-hidden="true" />}{fast ? 'Fast day' : 'Nourish day'}
    </span>
  );

  if (meals.length === 0) {
    return (
      <section className="card p-4 md:p-6 flex items-center gap-3" aria-label="Tomorrow">
        <div className="flex-1 min-w-0 pl-1">
          <div className="flex items-center gap-2.5">
            <h2 className="heading-3">Tomorrow</h2>
            {dayTag}
          </div>
          <p className="text-sm text-muted mt-0.5">Nothing planned yet</p>
        </div>
        <button onClick={onPlan} className="btn-secondary btn-sm shrink-0" aria-label="Plan tomorrow"><CalendarHeart size={16} aria-hidden="true" /> Plan</button>
      </section>
    );
  }

  return (
    <section className="card p-5 md:p-6 @container" aria-label="Tomorrow">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="heading-3">Tomorrow</h2>
            {dayTag}
          </div>
          <p className={`text-sm mt-0.5 ${nutrition.complete && planned > target ? 'text-warning font-semibold' : 'text-muted'}`}>
            {nutrition.complete ? `${nutrition.estimated?'≈ ':''}${planned.toLocaleString()} of ${target.toLocaleString()} kcal planned` : nutritionLabel(nutrition)}
          </p>
        </div>
        <button onClick={onPlan} className="btn-ghost btn-sm"><CalendarHeart size={16} aria-hidden="true" /> Open planner</button>
      </div>
      {/* Two columns only when the card itself is wide (it sits in a half-width column on desktop) */}
      <ul className="grid grid-cols-[minmax(0,1fr)] @lg:grid-cols-2 gap-x-6">
        {MEAL_SLOTS.flatMap(({ slot, label }) =>
          meals.filter(m => slotFor(m) === slot).map((meal, i) => {
            const visual = mealVisualFor(meal);
            return (
              <li key={meal.instanceId || `${meal.id}-${slot}-${i}`} className="flex items-center gap-3 py-2 border-t border-border first:border-t-0 @lg:[&:nth-child(2)]:border-t-0">
                <span className={`shrink-0 flex items-center justify-center ${visual.tint} size-11 rounded-full`}>
                  <visual.Icon size={20} strokeWidth={2.25} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-muted">{label}</span>
                  <span className="block font-semibold leading-snug truncate">{meal.name}</span>
                </span>
                {meal.familyMeal && <UsersRound size={14} className="text-workout-text shrink-0" aria-label="Family meal" />}
                <span className="text-sm text-muted text-right max-w-[45%]">{mealKcalLabel(meal)}</span>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
};
