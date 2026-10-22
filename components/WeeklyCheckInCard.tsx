import React, { useState } from 'react';
import { CalendarCheck, Check } from 'lucide-react';
import { WeeklyCheckIn } from '../types';
import { MAX_WEEKLY_STEP } from '../utils/checkIn';
import { MIN_LOGGED_DAYS, MIN_WEIGH_INS } from '../utils/energyModel';

const kcal = (n: number) => `${(Math.round(n / 10) * 10).toLocaleString()} kcal`;
const kg = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const SEEN_KEY = 'vesta_checkInSeen';

/** Title and detail for a check-in, in words */
export const checkInText = (c: WeeklyCheckIn): { title: string; detail: string } => {
  const burn = c.expenditure !== null && c.margin !== null
    ? `about ${kcal(c.expenditure)} (likely ${kcal(c.expenditure - c.margin).replace(' kcal', '')}–${kcal(c.expenditure + c.margin)})`
    : null;
  if (c.status === 'held') {
    return {
      title: `Target held at ${kcal(c.target)}`,
      detail: `Not enough data to judge this week: ${c.loggedDays} of ${MIN_LOGGED_DAYS} fully logged days and ${c.weighIns} of ${MIN_WEIGH_INS} weigh-in days in the last four weeks.`,
    };
  }
  if (c.status === 'changed') {
    const capped = c.suggested !== null && c.suggested !== c.target;
    return {
      title: `Nourish days now ${kcal(c.target)}`,
      detail: `${c.target < c.previousTarget ? 'Down' : 'Up'} from ${kcal(c.previousTarget)}. You burn ${burn}, so this aims for ${kg(c.weeklyLoss)} kg a week.`
        + (capped ? ` Your pace calls for ${kcal(c.suggested!)}; it moves at most ${MAX_WEEKLY_STEP} kcal a week to get there.` : ''),
    };
  }
  return {
    title: `Staying at ${kcal(c.target)}`,
    detail: `You burn ${burn}, steady enough that your target still fits ${kg(c.weeklyLoss)} kg a week.`,
  };
};

const readSeen = () => { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } };

/** Sunday's check-in on Today, until it's been read */
export const WeeklyCheckInCard: React.FC<{ checkIn: WeeklyCheckIn | null; onSeePace: () => void }> = ({ checkIn, onSeePace }) => {
  const [seen, setSeen] = useState(readSeen);
  if (!checkIn || seen === checkIn.date) return null;
  const { title, detail } = checkInText(checkIn);
  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, checkIn.date); } catch { /* the card just shows again next time */ }
    setSeen(checkIn.date);
  };
  return (
    <section className="card p-5 md:p-6" aria-label="Weekly check-in">
      <div className="flex items-start gap-4">
        <span className="icon-tile size-12 shrink-0 tile-weight flex items-center justify-center"><CalendarCheck size={20} aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-muted">Weekly check-in</p>
          <h2 className="heading-3">{title}</h2>
          <p className="mt-1 leading-relaxed">{detail}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={dismiss} className="btn-primary btn-sm"><Check size={16} aria-hidden="true" /> Got it</button>
            <button onClick={onSeePace} className="btn-ghost btn-sm">See your pace</button>
          </div>
        </div>
      </div>
    </section>
  );
};
