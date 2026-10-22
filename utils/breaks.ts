import { TrackingBreak, UserExperience } from '../types';
import { addDays } from './planUtils';

/** After a break, the scale shows water, salt and food in transit for a few days; those weigh-ins are left out */
export const SETTLE_DAYS = 3;
/** Older breaks stop mattering once they're out of every window; this many are kept */
const KEEP_BREAKS = 12;

/** The day was on a break (Plan meals mode) */
export const onBreak = (breaks: TrackingBreak[] | undefined, date: string) =>
  (breaks ?? []).some(b => date >= b.start && (!b.end || date < b.end));

/** The day is in the first few after a break, while the scale settles */
export const settling = (breaks: TrackingBreak[] | undefined, date: string) =>
  (breaks ?? []).some(b => !!b.end && date >= b.end && date < addDays(b.end, SETTLE_DAYS));

/** Which unbroken stretch of tracking a day belongs to: the number of breaks that ended by then */
export const stretchOf = (breaks: TrackingBreak[] | undefined, date: string) =>
  (breaks ?? []).filter(b => !!b.end && b.end <= date).length;

/**
 * The breaks after switching modes: leaving tracking for Plan meals opens one today, coming back closes
 * it (a break opened and closed the same day is dropped, as nothing was missed).
 */
export const breaksAfterSwitch = (breaks: TrackingBreak[] | undefined, from: UserExperience, to: UserExperience, today: string): TrackingBreak[] => {
  const list = [...(breaks ?? [])];
  const open = list.findIndex(b => !b.end);
  if (from === 'tracking' && to === 'planning' && open < 0) list.push({ start: today });
  if (from === 'planning' && to === 'tracking' && open >= 0) {
    if (list[open].start >= today) list.splice(open, 1);
    else list[open] = { start: list[open].start, end: today };
  }
  return list.slice(-KEEP_BREAKS);
};
