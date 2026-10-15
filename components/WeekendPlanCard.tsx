import React, { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPlan, MealSlot } from '../types';
import { getCachedPlansInRange, getDayPlansInRange } from '../services/storageService';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { addDays, emptyDayPlan, mealKcalLabel, slotFor } from '../utils/planUtils';
import { useDevMode } from '../contexts/DevModeContext';

interface WeekendPlanCardProps {
  /** Average extra calories a day at weekends from recent logs, when known */
  weekendGap: number | null;
  /** Open the planner at a date */
  onPlan: (date: string) => void;
}

/** Thursday and Friday: weekends are when eating drifts and logging slips, so plan them ahead */
const SHOW_ON_DAYS = [4, 5];
/** A weekend day counts as planned once these slots have something in them */
const KEY_SLOTS: MealSlot[] = ['lunch', 'dinner'];
const DISMISS_KEY = 'vesta_weekendPlanDismissed';

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
};

const dayName = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long' });

/** What a weekend day still needs, e.g. "Lunch and dinner not planned", or its main meals when done */
const dayStatus = (plan: DayPlan) => {
  const missing = KEY_SLOTS.filter(slot => !plan.meals.some(m => slotFor(m) === slot));
  if (plan.meals.length === 0) return { done: false, text: 'Nothing planned yet' };
  if (missing.length) {
    const names = missing.join(' and ');
    return { done: false, text: `${names.charAt(0).toUpperCase()}${names.slice(1)} not planned` };
  }
  const dinner = plan.meals.find(m => slotFor(m) === 'dinner')!;
  return { done: true, text: `Dinner: ${dinner.name} · ${mealKcalLabel(dinner)}` };
};

/** Thursday and Friday on Today: how planned the coming weekend is, with a way into the planner. */
export const WeekendPlanCard: React.FC<WeekendPlanCardProps> = ({ weekendGap, onPlan }) => {
  const today = localDateString();
  const weekday = parseLocalDate(today).getDay();
  const saturday = addDays(today, 6 - weekday);
  const sunday = addDays(saturday, 1);
  const show = SHOW_ON_DAYS.includes(weekday);

  const [plans, setPlans] = useState<Record<string, DayPlan> | null>(() => (show ? getCachedPlansInRange(saturday, sunday) : null));
  const [dismissed, setDismissed] = useState(readDismissed);
  const quickMeals = useDevMode().isFeatureEnabled('quickMeals');

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    getDayPlansInRange(saturday, sunday)
      .then(fresh => { if (!cancelled) setPlans(prev => ({ ...prev, ...fresh })); })
      .catch(e => console.error('Failed to load the weekend plan', e));
    return () => { cancelled = true; };
  }, [show, saturday, sunday]);

  if (!show || !plans || dismissed === saturday) return null;
  const days = [saturday, sunday].map(date => ({ date, ...dayStatus(plans[date] || emptyDayPlan(date)) }));
  if (days.every(d => d.done)) return null;
  const firstOpen = days.find(d => !d.done)!.date;

  const dismiss = () => {
    setDismissed(saturday);
    try { localStorage.setItem(DISMISS_KEY, saturday); } catch { /* per-device convenience */ }
  };

  return (
    <section className="rounded-[24px] bg-water-bg p-5 md:p-6" aria-labelledby="weekend-plan-title">
      <div className="flex items-start gap-4">
        <span className="shrink-0 flex items-center justify-center size-12 rounded-full bg-surface text-water-text" aria-hidden="true"><CalendarDays size={20} /></span>
        <div className="flex-1 min-w-0">
          <h2 id="weekend-plan-title" className="heading-3">Plan your weekend</h2>
          <p className="text-sm mt-0.5">
            {weekendGap !== null && weekendGap >= 150
              ? `Your weekends run about ${Math.round(weekendGap / 10) * 10} kcal a day over your weekdays. Planning them ahead is the easiest fix, and planned meals take one tap to log.`
              : 'Weekends are when eating drifts and logging slips. Planned meals take one tap to log.'}
          </p>
          <ul className="mt-2 space-y-1">
            {days.map(d => (
              <li key={d.date} className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold w-20 shrink-0">{dayName(d.date)}</span>
                <span className={`min-w-0 truncate ${d.done ? 'text-muted' : ''}`}>{d.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={() => onPlan(firstOpen)} className="btn-primary btn-sm">
              Plan {dayName(firstOpen)}
            </button>
            <button onClick={dismiss} className="btn-ghost btn-sm">Not this week</button>
          </div>
          {quickMeals && <p className="text-xs text-muted mt-2">Eating out? Type the place in the planner search and plan it as a quick meal.</p>}
        </div>
      </div>
    </section>
  );
};
