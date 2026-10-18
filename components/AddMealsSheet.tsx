import React, { useState } from 'react';
import { Check, ListPlus } from 'lucide-react';
import { Sheet } from './Sheet';
import { PlanMeal } from '../utils/shoppingUtils';
import { localDateString } from '../utils/dateUtils';

interface AddMealsSheetProps {
  /** Planned meals not on the list yet, with something to buy */
  meals: PlanMeal[];
  onAdd: (meals: PlanMeal[]) => Promise<void>;
  onClose: () => void;
}

const dayLabel = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  const day = date === localDateString() ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'long' });
  return `${day} · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

/** Picks planned meals to add to the shopping list; all start ticked. */
export const AddMealsSheet: React.FC<AddMealsSheetProps> = ({ meals, onAdd, onClose }) => {
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(meals.map(m => m.key)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) => setChosen(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await onAdd(meals.filter(m => chosen.has(m.key)));
      onClose();
    } catch (e) {
      console.error('Error adding meals to the list:', e);
      setError(e instanceof Error ? e.message : "We couldn't add the meals. Try again.");
      setBusy(false);
    }
  };

  const byDate = new Map<string, PlanMeal[]>();
  meals.forEach(meal => byDate.set(meal.date, [...(byDate.get(meal.date) || []), meal]));

  return (
    <Sheet
      title="Add meals"
      subtitle="Their ingredients go on the list, added up with what's there."
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
          <button onClick={add} disabled={busy || chosen.size === 0} className="btn-primary w-full">
            {busy ? <span className="spinner spinner-sm" aria-hidden="true" /> : <ListPlus size={20} aria-hidden="true" />}
            {busy ? 'Reading recipes…' : `Add ${chosen.size} ${chosen.size === 1 ? 'meal' : 'meals'}`}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        {[...byDate].map(([date, dayMeals]) => (
          <section key={date}>
            <h3 className="font-sans text-xs font-semibold text-muted px-2 pb-1">{dayLabel(date)}</h3>
            <ul>
              {dayMeals.map(meal => {
                const isChosen = chosen.has(meal.key);
                const count = meal.parts.reduce((n, p) => n + p.ingredients.length, 0);
                return (
                  <li key={meal.key}>
                    <button
                      onClick={() => toggle(meal.key)}
                      aria-pressed={isChosen}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-[14px] text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]"
                    >
                      <span className={`size-11 shrink-0 flex items-center justify-center rounded-full border-2 transition-colors ${isChosen ? 'bg-ink border-ink text-on-ink' : 'border-border-control text-transparent'}`}>
                        <Check size={20} strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className={`flex-1 min-w-0 ${isChosen ? '' : 'text-muted'}`}>
                        <span className="font-semibold leading-snug line-clamp-2">{meal.name}</span>
                        <span className="block text-xs text-muted mt-0.5">
                          {count} {count === 1 ? 'thing' : 'things'} to buy{meal.parts.length > 1 ? `, with ${meal.parts.length - 1 === 1 ? 'a side' : `${meal.parts.length - 1} sides`}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  );
};
