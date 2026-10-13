import React, { useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { DayPlan } from '../types';
import { isMealEaten, mealKcalLabel, slotFor, slotLabel } from '../utils/planUtils';

interface AtePlannedCardProps {
  plan: DayPlan;
  /** Log every planned meal not yet ticked off */
  onLogAll: (indices: number[]) => void;
}

/** From this hour the day's plan is mostly behind you, so Today asks how it went */
const FROM_HOUR = 17;
const DISMISS_KEY = 'vesta_atePlannedDismissed';

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
};

/** Evening check-in: log the rest of today's plan in one tap, or go and tick off what was different. */
export const AtePlannedCard: React.FC<AtePlannedCardProps> = ({ plan, onLogAll }) => {
  const [hour, setHour] = useState(() => new Date().getHours());
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(false);

  // The card appears at FROM_HOUR without a reload
  useEffect(() => {
    const timer = window.setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = plan.meals.map((meal, index) => ({ meal, index })).filter(({ meal }) => !isMealEaten(plan, meal));
  if (hour < FROM_HOUR || remaining.length === 0 || dismissed === plan.date) return null;

  const dismiss = () => {
    setDismissed(plan.date);
    try { localStorage.setItem(DISMISS_KEY, plan.date); } catch { /* per-device convenience */ }
  };

  const logAll = async () => {
    setBusy(true);
    try { await onLogAll(remaining.map(({ index }) => index)); } finally { setBusy(false); }
  };

  const count = remaining.length;
  return (
    <section className="card p-4 md:px-6" aria-labelledby="ate-planned-title">
      <div className="flex items-start gap-3">
        <span className="size-10 shrink-0 rounded-[12px] flex items-center justify-center tile-weight" aria-hidden="true"><ClipboardCheck size={20} /></span>
        <div className="flex-1 min-w-0">
          <h2 id="ate-planned-title" className="heading-4">Did you eat as planned today?</h2>
          <ul className="text-sm text-muted mt-1 space-y-0.5">
            {remaining.map(({ meal, index }) => (
              <li key={meal.instanceId || `${meal.id}-${index}`} className="flex justify-between gap-3">
                <span className="truncate">{slotLabel(slotFor(meal))} · {meal.name}</span>
                <span className="whitespace-nowrap">{mealKcalLabel(meal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={logAll} disabled={busy} className="btn-secondary btn-sm">
              {busy ? 'Logging…' : count === 1 ? 'Yes, log it' : `Yes, log all ${count}`}
            </button>
            <button
              onClick={() => document.getElementById('from-your-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="btn-ghost btn-sm"
            >
              Some were different
            </button>
            <button onClick={dismiss} className="btn-ghost btn-sm">Not today</button>
          </div>
        </div>
      </div>
    </section>
  );
};
