import { DailySummary } from '../types';
import { addDays } from './planUtils';
import { MAX_PLAUSIBLE_FAST_HOURS } from '../constants';

// Fasting and water figures for Today's strip (TodayStrip)

/** The last seven days, oldest first, ending today. Days with no summary are null. */
const lastSevenDays = (history: DailySummary[], today: string) => {
  const byDate = new Map(history.map(s => [s.date, s]));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i - 6);
    return { date, summary: byDate.get(date) ?? null };
  });
};

export interface FastingInput {
  elapsedHours: number;
  targetHours: number;
  lastAteTime: number | null;
  /** When today's first meal (one that breaks a fast) was logged, or null if none yet */
  firstMealTime: number | null;
  history?: DailySummary[];
  today: string;
}

export const fmtDuration = (hours: number) => `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
// Skip gaps too long to be a real fast (usually days nothing was logged), as Analytics does
const plausible = (h: number) => (h <= MAX_PLAUSIBLE_FAST_HOURS ? h : 0);

/** The last seven fasts, last night's, and the eating window if today's first meal opened one */
export const fastingProgress = ({ elapsedHours, targetHours, lastAteTime, firstMealTime, history = [], today }: FastingInput) => {
  // Today's fast is the one that ended at the first meal; before that, the one still running
  const week = lastSevenDays(history, today).map(({ date, summary }) => {
    const live = date === today && lastAteTime && firstMealTime === null ? plausible(elapsedHours) : 0;
    const hours = Math.max(plausible(summary?.maxFastingHours ?? 0), live);
    return { date, hours, hit: hours >= targetHours };
  });
  const windowHours = 24 - targetHours;
  const closesAt = firstMealTime !== null && windowHours > 0 ? firstMealTime + windowHours * 3_600_000 : null;
  return {
    week,
    hits: week.filter(d => d.hit).length,
    lastNight: week[week.length - 1].hours,
    windowHours,
    closesAt,
    inWindow: closesAt !== null && Date.now() < closesAt,
  };
};

/** How today's water compares with the goal spread evenly over 7:00 to 21:00, or null early on with nothing drunk */
export const waterPace = (liters: number, goal: number, now = new Date()) => {
  if (liters >= goal) return 'Goal reached';
  const dayShare = Math.min(Math.max((now.getHours() + now.getMinutes() / 60 - 7) / 14, 0), 1);
  if (dayShare === 0 && liters === 0) return null;
  return liters >= goal * dayShare - 0.25 ? 'On track' : 'Top up';
};
