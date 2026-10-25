import { DailySummary } from '../types';
import { SETTLE_DAYS } from './breaks';
import { addDays } from './planUtils';

/**
 * Days marked as feeling unwell. Eating and the scale are both off while ill (appetite, fluid from the
 * illness or its medicines), so these days are left out of the burn estimate, like a short break, and
 * streaks pause over them instead of breaking.
 */
export const unwellDays = (summaries: Pick<DailySummary, 'date' | 'unwell'>[]) =>
  new Set(summaries.filter(s => s.unwell).map(s => s.date));

/** The day is one of the few after an unwell day, while the scale settles; those weigh-ins are left out */
export const recovering = (unwell: Set<string>, date: string) => {
  for (let back = 1; back <= SETTLE_DAYS; back++) if (unwell.has(addDays(date, -back))) return true;
  return false;
};
