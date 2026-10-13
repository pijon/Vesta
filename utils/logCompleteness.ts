import { DayLogStatus, UserStats } from '../types';
import { dayTarget } from './planUtils';

/** Below this share of the day's calorie target, a food log is taken as unfinished unless marked complete */
export const COMPLETE_DAY_SHARE = 0.4;

/**
 * Whether a day's food log is full enough to count in averages, the burn estimate and the coach.
 * A day with only breakfast logged would otherwise read as a very low intake day and pull the
 * estimate of what you burn (and the suggested target) down. The user's own mark wins.
 */
export const isCompleteDay = (calories: number, target: number, status?: DayLogStatus) =>
  status === 'complete' || (status !== 'incomplete' && calories > 0 && calories >= target * COMPLETE_DAY_SHARE);

/** isCompleteDay for a stored day, using that day's fast or nourish target. */
export const completeDayFor = (
  stats: Pick<UserStats, 'dailyCalorieGoal' | 'nonFastDayCalories'>,
  dayTypes: Record<string, string>,
) => (day: { date: string; caloriesConsumed: number; status?: DayLogStatus }) =>
  isCompleteDay(day.caloriesConsumed || 0, dayTarget({ type: dayTypes[day.date] === 'fast' ? 'fast' : undefined }, stats), day.status);
