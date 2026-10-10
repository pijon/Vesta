import React from 'react';
import { CalendarDays, Flame, UsersRound } from 'lucide-react';
import { DayPlan, UserStats } from '../types';
import { MEAL_SLOTS, dayCalories, dayTarget, isFastDay, mealCalories, slotFor } from '../utils/planUtils';
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
  const meals = plan.meals || [];

  const dayTag = (
    <span className={`badge ${fast ? 'badge-fasting' : 'badge-neutral'}`}>
      {fast && <Flame size={12} aria-hidden="true" />}{fast ? 'Fast day' : 'Nourish day'}
    </span>
  );

  if (meals.length === 0) {
    return (
      <section className="card px-5 py-4 flex flex-wrap items-center justify-between gap-3" aria-label="Tomorrow">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="heading-3">Tomorrow</h2>
          {dayTag}
          <span className="text-sm text-muted">Nothing planned yet</span>
        </div>
        <button onClick={onPlan} className="btn-secondary btn-sm"><CalendarDays size={16} aria-hidden="true" /> Plan tomorrow</button>
      </section>
    );
  }

  return (
    <section className="card p-5 md:p-6" aria-label="Tomorrow">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="heading-3">Tomorrow</h2>
            {dayTag}
          </div>
          <p className={`text-sm mt-0.5 ${planned > target ? 'text-warning font-semibold' : 'text-muted'}`}>
            {planned.toLocaleString()} of {target.toLocaleString()} kcal planned
          </p>
        </div>
        <button onClick={onPlan} className="btn-ghost btn-sm"><CalendarDays size={16} aria-hidden="true" /> Open planner</button>
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-6">
        {MEAL_SLOTS.flatMap(({ slot, label }) =>
          meals.filter(m => slotFor(m) === slot).map((meal, i) => {
            const visual = mealVisualFor(meal);
            return (
              <li key={meal.instanceId || `${meal.id}-${slot}-${i}`} className="flex items-center gap-3 py-2 border-t border-border first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
                <span className={`size-9 shrink-0 rounded-[10px] flex items-center justify-center ${visual.tint}`}>
                  <visual.Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs text-muted">{label}</span>
                  <span className="block font-semibold leading-snug truncate">{meal.name}</span>
                </span>
                {meal.familyDinner && <UsersRound size={14} className="text-workout-text shrink-0" aria-label="Family dinner" />}
                <span className="text-sm text-muted whitespace-nowrap">{mealCalories(meal)} kcal</span>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
};
