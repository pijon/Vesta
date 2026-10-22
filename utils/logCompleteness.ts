import { DailySummary, DayLogStatus, UserStats } from '../types';
import { localDateString } from './dateUtils';
import { addDays, dayTarget } from './planUtils';

/** Below this share of the day's calorie target, a food log is taken as unfinished unless marked complete */
export const COMPLETE_DAY_SHARE = 0.4;
/** The burn estimate is stricter: it is intake minus the weight change, so a half-logged day biases it directly */
export const ENERGY_COMPLETE_DAY_SHARE = 0.6;

/**
 * Whether a day's food log is full enough to count in averages, the burn estimate and the coach.
 * A day with only breakfast logged would otherwise read as a very low intake day and pull the
 * estimate of what you burn (and the suggested target) down. The user's own mark wins.
 */
export const isCompleteDay = (calories: number, target: number, status?: DayLogStatus, share = COMPLETE_DAY_SHARE) =>
  status === 'complete' || (status !== 'incomplete' && calories > 0 && calories >= target * share);

/** isCompleteDay for a stored day, using that day's fast or nourish target. */
export const completeDayFor = (
  stats: Pick<UserStats, 'dailyCalorieGoal' | 'nonFastDayCalories'>,
  dayTypes: Record<string, string>,
  share = COMPLETE_DAY_SHARE,
) => (day: { date: string; caloriesConsumed: number; status?: DayLogStatus }) =>
  isCompleteDay(day.caloriesConsumed || 0, dayTarget({ type: dayTypes[day.date] === 'fast' ? 'fast' : undefined }, stats), day.status, share);

/** Below this share of your usual intake for that kind of day, Today asks whether everything is logged */
export const LIGHT_DAY_SHARE = 0.7;
/** Fully logged days of a kind needed before "usual" means anything */
const USUAL_MIN_DAYS = 5;

/**
 * Your usual intake on a fast or nourish day: the median of the days of that kind you fully logged in the
 * four weeks before today (null with fewer than five). A day can clear the share of its target and still
 * be missing a meal; compared with your own days, it stands out.
 */
export const usualIntake = (
  summaries: DailySummary[],
  dayTypes: Record<string, string>,
  stats: Pick<UserStats, 'dailyCalorieGoal' | 'nonFastDayCalories'>,
  fast: boolean,
  today = localDateString(),
): number | null => {
  const from = addDays(today, -28);
  const isComplete = completeDayFor(stats, dayTypes, ENERGY_COMPLETE_DAY_SHARE);
  const days = summaries
    .filter(s => s.date >= from && s.date < today && (dayTypes[s.date] === 'fast') === fast && isComplete(s))
    .map(s => s.caloriesConsumed)
    .sort((a, b) => a - b);
  if (days.length < USUAL_MIN_DAYS) return null;
  const mid = Math.floor(days.length / 2);
  return days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
};

/** Whether a day that counts looks light next to your usual for its kind, so it's worth asking about */
export const looksLight = (calories: number, usual: number | null, status?: DayLogStatus) =>
  !status && usual !== null && calories > 0 && calories < usual * LIGHT_DAY_SHARE;
