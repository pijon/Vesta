import React from 'react';
import { Store } from 'lucide-react';
import { DayPlan } from '../types';
import { isBudgetMeal, isMealEaten, mealKcalLabel, slotFor, slotLabel, slotTime } from '../utils/planUtils';

interface EatingOutCardProps {
  plan: DayPlan;
  /** Log what was had for the eating-out meal at this index */
  onLog: (index: number) => void;
}

/** Eating-out meals whose time has come and that aren't logged yet: ask what was actually eaten. */
export const EatingOutCard: React.FC<EatingOutCardProps> = ({ plan, onLog }) => {
  const now = Date.now();
  const due = plan.meals
    .map((meal, index) => ({ meal, index }))
    .filter(({ meal }) => meal.quick?.kind === 'out' && !isMealEaten(plan, meal) && now >= slotTime(slotFor(meal), now));
  if (due.length === 0) return null;

  return (
    <section className="rounded-[24px] bg-workout-bg p-5 md:p-6" aria-labelledby="eating-out-title">
      <div className="flex items-start gap-4">
        <span className="shrink-0 flex items-center justify-center size-12 rounded-full bg-surface text-workout-text" aria-hidden="true"><Store size={20} /></span>
        <div className="flex-1 min-w-0">
          <h2 id="eating-out-title" className="heading-3">Eating out today</h2>
          <ul className="mt-2 space-y-2">
            {due.map(({ meal, index }) => (
              <li key={meal.instanceId || `${meal.id}-${index}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <span className="min-w-0 text-sm">
                  <span className="font-semibold">{slotLabel(slotFor(meal))} · {meal.name}</span>
                  <span className="block text-muted">
                    {mealKcalLabel(meal)}
                    {isBudgetMeal(meal) && meal.quick?.plannedBudget !== undefined && meal.quick.plannedBudget !== meal.calories && ` · planned ${meal.quick.plannedBudget}`}
                  </span>
                </span>
                <button onClick={() => onLog(index)} className="btn-primary btn-sm">
                  {isBudgetMeal(meal) ? 'Where did you eat?' : 'Log what you had'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
