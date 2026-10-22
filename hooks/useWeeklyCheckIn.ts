import { useEffect, useRef } from 'react';
import { DailySummary, UserStats, WeeklyCheckIn } from '../types';
import { checkInsData } from '../services/pageData';
import { saveCheckInIfNew } from '../services/storageService';
import { ensureWarm, usePrewarmed } from '../utils/prewarm';
import { localDateString } from '../utils/dateUtils';
import { onBreak } from '../utils/breaks';
import { FIRST_CHECK_IN, checkInDateFor, weeklyCheckIn } from '../utils/checkIn';
import { DEFAULT_LOSS_RATE, estimateEnergyFor, fastDaysPerWeek, suggestTargets } from '../utils/energyModel';

/**
 * Runs this week's check-in once its Sunday has come, if no device has yet and it wasn't on a break, and applies a changed
 * nourish target. Waits for the logs, day types and past check-ins, which load after the first refresh
 * (so `stats` is fresh by then). Returns this week's check-in and the history.
 */
export const useWeeklyCheckIn = (
  stats: UserStats,
  summaries: DailySummary[] | undefined,
  dayTypes: Record<string, string> | undefined,
  onUpdateStats: (stats: UserStats) => void,
): { latest: WeeklyCheckIn | null; history: WeeklyCheckIn[] } => {
  const history = usePrewarmed(checkInsData);
  const date = checkInDateFor(localDateString());
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (!summaries || !dayTypes || !history || ran.current === date || date < FIRST_CHECK_IN) return;
    ran.current = date;
    // A Sunday spent on a break (Plan meals mode) gets no check-in, even when you're back by the time it's read
    if (history.some(c => c.date === date) || onBreak(stats.breaks, date)) return;
    const last = history.filter(c => c.date < date).at(-1) ?? null;
    const rate = stats.weeklyLossGoal ?? DEFAULT_LOSS_RATE;
    const estimate = estimateEnergyFor(stats, summaries, dayTypes);
    const suggestion = suggestTargets(estimate, stats, fastDaysPerWeek(estimate), rate);
    const checkIn = weeklyCheckIn(estimate, suggestion, stats.nonFastDayCalories || 2000, last, date, rate);
    saveCheckInIfNew(checkIn)
      .then(({ checkIn: saved, created }) => {
        if (created && saved.status === 'changed') onUpdateStats({ ...stats, nonFastDayCalories: saved.target });
        return ensureWarm(checkInsData, true);
      })
      .catch(e => {
        console.error('Weekly check-in failed', e);
        ran.current = null;
      });
  }, [summaries, dayTypes, history, date, stats, onUpdateStats]);

  return { latest: history?.find(c => c.date === date) ?? null, history: history ?? [] };
};
