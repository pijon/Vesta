import { DailySummary, UserStats, WeightEntry } from '../types';
import { localDateString, parseLocalDate } from './dateUtils';
import { addDays } from './planUtils';

/** Energy in a kilogram of body weight change (mostly fat), the usual rule of thumb. */
export const KCAL_PER_KG = 7700;

/** Smoothing for the trend weight: each day moves 10% towards the scale (the "Hacker's Diet" average). */
const TREND_ALPHA = 0.1;
/** A longer break between weigh-ins starts a fresh trend instead of drawing a line across it. */
const TREND_GAP_DAYS = 21;

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / DAY_MS);

export interface TrendPoint {
  date: string;
  time: number;
  /** Smoothed weight */
  trend: number;
  /** The scale reading, on days with a weigh-in */
  scale: number | null;
  /** Which unbroken run of weigh-ins the day belongs to (a gap of more than 21 days starts a new one) */
  run: number;
}

/**
 * One point per day from the first weigh-in to the last, with a smoothed trend weight. Days between
 * weigh-ins are filled in on a straight line, so sparse weigh-ins still give a steady trend; several
 * weigh-ins on one day count as their average.
 */
export const weightTrend = (history: WeightEntry[]): TrendPoint[] => {
  const byDate = new Map<string, number[]>();
  (history || []).filter(e => e.weight > 0).forEach(e => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e.weight]));
  const entries = [...byDate.entries()]
    .map(([date, ws]) => ({ date, weight: ws.reduce((a, b) => a + b, 0) / ws.length }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const points: TrendPoint[] = [];
  let run = 0;
  let trend = 0;
  entries.forEach((entry, i) => {
    const prev = entries[i - 1];
    const gap = prev ? daysBetween(prev.date, entry.date) : 0;
    if (!prev || gap > TREND_GAP_DAYS) {
      if (prev) run++;
      trend = entry.weight;
      points.push({ date: entry.date, time: parseLocalDate(entry.date).getTime(), trend, scale: entry.weight, run });
      return;
    }
    for (let d = 1; d <= gap; d++) {
      const date = addDays(prev.date, d);
      const value = prev.weight + ((entry.weight - prev.weight) * d) / gap;
      trend += TREND_ALPHA * (value - trend);
      points.push({ date, time: parseLocalDate(date).getTime(), trend, scale: d === gap ? entry.weight : null, run });
    }
  });
  return points;
};

/** Least-squares slope in kg per day. */
const slopePerDay = (points: { time: number; weight: number }[]) => {
  const xs = points.map(p => (p.time - points[0].time) / DAY_MS);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = points.reduce((a, p) => a + p.weight, 0) / points.length;
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return den === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (points[i].weight - my), 0) / den;
};

/** What the estimate needs over the window before it's worth showing. */
export const ESTIMATE_WINDOW_DAYS = 28;
export const MIN_LOGGED_DAYS = 14;
export const MIN_WEIGH_INS = 4;
/** First and last weigh-in in the window must be at least this far apart */
export const MIN_WEIGH_SPAN_DAYS = 14;

export interface EnergyEstimate {
  /** The window: the 28 days up to yesterday (today isn't finished) */
  from: string;
  to: string;
  loggedDays: number;
  weighIns: number;
  weighSpanDays: number;
  ready: boolean;
  /** Average food logged on logged days */
  avgIntake: number | null;
  /** kg per week from the weigh-ins in the window (negative = losing) */
  weightChangePerWeek: number | null;
  /** Calories burned per day, everything included (workouts too) */
  expenditure: number | null;
  /** Average workout calories per day in the window */
  avgWorkoutBurn: number;
}

/**
 * Estimates daily calorie burn from what was eaten and how weight changed:
 * burn ≈ average intake − (weight change per day × 7,700 kcal/kg).
 * Only days with food logged count towards intake, so the estimate is only as good as the logging.
 */
export const estimateEnergy = (summaries: DailySummary[], history: WeightEntry[], today = localDateString()): EnergyEstimate => {
  const to = addDays(today, -1);
  const from = addDays(to, -(ESTIMATE_WINDOW_DAYS - 1));
  const inWindow = summaries.filter(s => s.date >= from && s.date <= to);
  const logged = inWindow.filter(s => (s.caloriesConsumed || 0) > 0);
  const weighIns = (history || [])
    .filter(e => e.weight > 0 && e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({ time: parseLocalDate(e.date).getTime(), weight: e.weight, date: e.date }));
  const weighSpanDays = weighIns.length >= 2 ? daysBetween(weighIns[0].date, weighIns[weighIns.length - 1].date) : 0;
  const ready = logged.length >= MIN_LOGGED_DAYS && weighIns.length >= MIN_WEIGH_INS && weighSpanDays >= MIN_WEIGH_SPAN_DAYS;

  const avgIntake = logged.length ? logged.reduce((a, s) => a + s.caloriesConsumed, 0) / logged.length : null;
  const slope = weighIns.length >= 2 && weighSpanDays > 0 ? slopePerDay(weighIns) : null;
  const avgWorkoutBurn = inWindow.reduce((a, s) => a + (s.caloriesBurned || 0), 0) / ESTIMATE_WINDOW_DAYS;

  return {
    from,
    to,
    loggedDays: logged.length,
    weighIns: weighIns.length,
    weighSpanDays,
    ready,
    avgIntake,
    weightChangePerWeek: slope !== null ? slope * 7 : null,
    expenditure: ready && avgIntake !== null && slope !== null ? avgIntake - slope * KCAL_PER_KG : null,
    avgWorkoutBurn,
  };
};

export const LOSS_RATES = [0.25, 0.5, 0.75, 1] as const;
export const DEFAULT_LOSS_RATE = 0.5;
/** Never suggest a nourish day below this */
export const MIN_NOURISH_TARGET = 1200;

export interface TargetSuggestion {
  /** Suggested nourish-day target */
  nourish: number;
  /** The fast-day target it assumes (unchanged) */
  fast: number;
  fastDaysPerWeek: number;
  /** The weekly loss it aims for (may be lower than asked, see `capped`) */
  weeklyLoss: number;
  /** Average daily deficit that gives that loss */
  dailyDeficit: number;
  /** The rate was lowered to 1% of body weight a week */
  capped: boolean;
  /** The target hit the floor, so the real loss will be slower than asked */
  floored: boolean;
}

/**
 * The nourish-day target that gives the chosen weekly loss, given the fast days and their target.
 * The app adds workout calories (all, half or none, per Settings) back to the day's budget, so that
 * share of the average workout burn is taken off the estimate first; otherwise it would count twice.
 */
export const suggestTargets = (
  estimate: EnergyEstimate,
  stats: Pick<UserStats, 'dailyCalorieGoal' | 'currentWeight' | 'workoutCalorieCredit'>,
  fastDaysPerWeek: number,
  weeklyLoss: number,
): TargetSuggestion | null => {
  if (estimate.expenditure === null) return null;
  const maxRate = stats.currentWeight > 0 ? Math.floor(stats.currentWeight * 0.01 * 20) / 20 : 1;
  const rate = Math.min(weeklyLoss, maxRate);
  const dailyDeficit = (rate * KCAL_PER_KG) / 7;
  const allowance = estimate.expenditure - estimate.avgWorkoutBurn * (stats.workoutCalorieCredit ?? 1) - dailyDeficit;
  const fastDays = Math.min(Math.max(Math.round(fastDaysPerWeek), 0), 6);
  const fast = stats.dailyCalorieGoal;
  const raw = (allowance * 7 - fastDays * fast) / (7 - fastDays);
  const nourish = Math.max(MIN_NOURISH_TARGET, Math.round(raw / 10) * 10);
  return { nourish, fast, fastDaysPerWeek: fastDays, weeklyLoss: rate, dailyDeficit, capped: rate < weeklyLoss, floored: raw < MIN_NOURISH_TARGET };
};

/** Fast days per week over the estimate window, from the planner's day types. */
export const fastDaysPerWeek = (dayTypes: Record<string, string>, estimate: Pick<EnergyEstimate, 'from' | 'to'>) =>
  (Object.entries(dayTypes).filter(([date, type]) => type === 'fast' && date >= estimate.from && date <= estimate.to).length / ESTIMATE_WINDOW_DAYS) * 7;
