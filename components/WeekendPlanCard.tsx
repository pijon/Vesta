import React, { useEffect, useState } from 'react';
import { CalendarHeart, Check, ChevronRight, X } from 'lucide-react';
import { DayPlan, MealSlot } from '../types';
import { getCachedPlansInRange, getDayPlansInRange } from '../services/storageService';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { addDays, emptyDayPlan, mealKcalLabel, slotFor } from '../utils/planUtils';

interface WeekendPlanCardProps {
  /** Average extra calories a day at weekends from recent logs, when known */
  weekendGap: number | null;
  /** Tomorrow's date: on Friday the Tomorrow card above already covers Saturday */
  tomorrow: string;
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
const shortDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });

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

/** Thursday and Friday on Today, under Tomorrow: how planned the rest of the weekend is, with a way into the planner. */
export const WeekendPlanCard: React.FC<WeekendPlanCardProps> = ({ weekendGap, tomorrow, onPlan }) => {
  const today = localDateString();
  const weekday = parseLocalDate(today).getDay();
  const saturday = addDays(today, 6 - weekday);
  const sunday = addDays(saturday, 1);
  const show = SHOW_ON_DAYS.includes(weekday);

  const [plans, setPlans] = useState<Record<string, DayPlan> | null>(() => (show ? getCachedPlansInRange(saturday, sunday) : null));
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    getDayPlansInRange(saturday, sunday)
      .then(fresh => { if (!cancelled) setPlans(prev => ({ ...prev, ...fresh })); })
      .catch(e => console.error('Failed to load the weekend plan', e));
    return () => { cancelled = true; };
  }, [show, saturday, sunday]);

  if (!show || !plans || dismissed === saturday) return null;
  const days = [saturday, sunday].filter(date => date !== tomorrow).map(date => ({ date, ...dayStatus(plans[date] || emptyDayPlan(date)) }));
  if (days.every(d => d.done)) return null;

  const dismiss = () => {
    setDismissed(saturday);
    try { localStorage.setItem(DISMISS_KEY, saturday); } catch { /* per-device convenience */ }
  };

  const gap = weekendGap !== null && weekendGap >= 150 ? Math.round(weekendGap / 10) * 10 : null;

  return (
    <section className="card p-4 md:p-6" aria-labelledby="weekend-plan-title">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 pl-1 pt-1">
          <h2 id="weekend-plan-title" className="heading-3">Plan your weekend</h2>
          <p className="text-sm text-muted mt-0.5">
            {gap !== null
              ? `Your weekends run about ${gap} kcal a day over your weekdays.`
              : 'Planned meals take one tap to log, even at weekends.'}
          </p>
        </div>
        <button onClick={dismiss} className="icon-btn shrink-0 -mr-1 -mt-1 text-muted" aria-label="Not this week">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {/* A row per day, each straight into the planner at that day */}
      <ul className="mt-3">
        {days.map(d => (
          <li key={d.date} className="border-t border-border first:border-t-0">
            <button
              onClick={() => onPlan(d.date)}
              className="w-full flex items-center gap-3 py-2.5 text-left rounded-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              aria-label={`${d.done ? 'Open' : 'Plan'} ${dayName(d.date)}`}
            >
              <span className={`size-11 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${d.done ? 'tile-weight' : 'tile-water'}`} aria-hidden="true">
                {d.done ? <Check size={18} strokeWidth={2.5} /> : shortDay(d.date)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold leading-snug">{dayName(d.date)}</span>
                <span className="block text-sm text-muted truncate">{d.text}</span>
              </span>
              {d.done
                ? <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                : <span className="chip shrink-0 px-3 pointer-events-none"><CalendarHeart size={15} aria-hidden="true" /> Plan</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
