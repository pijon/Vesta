import { DailySummary, UserStats, WeightEntry } from '../types';
import { localDateString, parseLocalDate } from './dateUtils';
import { completeDayFor, ENERGY_COMPLETE_DAY_SHARE } from './logCompleteness';
import { addDays } from './planUtils';

/** Energy in a kilogram of body weight change (mostly fat), the usual rule of thumb. */
export const KCAL_PER_KG = 7700;

/** Smoothing for the trend weight: each day moves 15% towards the scale (a faster "Hacker's Diet" average, lagging about six days). */
const TREND_ALPHA = 0.15;
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

/** Student's t for an 80% range, by degrees of freedom; beyond the table it's about 1.3 */
const T80 = [Infinity, 3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372, 1.363, 1.356, 1.35, 1.345, 1.341];
export const t80 = (df: number) => T80[df] ?? (df < 30 ? 1.32 : 1.3);

/** Least-squares slope in kg per day, and its standard error (null with fewer than three points). */
const fitSlope = (points: { time: number; weight: number }[]) => {
  const xs = points.map(p => (p.time - points[0].time) / DAY_MS);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = points.reduce((a, p) => a + p.weight, 0) / points.length;
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  if (sxx === 0) return { slope: 0, se: null };
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (points[i].weight - my), 0) / sxx;
  if (xs.length < 3) return { slope, se: null };
  const residuals = xs.reduce((a, x, i) => a + (points[i].weight - (my + slope * (x - mx))) ** 2, 0);
  return { slope, se: Math.sqrt(residuals / (xs.length - 2) / sxx) };
};

/** What the estimate needs over the window before it's worth showing. */
export const ESTIMATE_WINDOW_DAYS = 28;
export const MIN_LOGGED_DAYS = 14;
/**
 * Days with a weigh-in: about three a week. Hall & Chow (AJCN 2011) needed daily weigh-ins over more than
 * 28 days to estimate intake within ±300 kcal/day, so fewer than this leaves the range very wide.
 */
export const MIN_WEIGH_INS = 12;
/** First and last weigh-in in the window must be at least this far apart */
export const MIN_WEIGH_SPAN_DAYS = 14;
/** Fast and nourish days are only averaged apart once each kind has this many logged days */
export const MIN_LOGGED_PER_KIND = 3;
/**
 * The burn's likely range is never narrower than this either way. Even a validated model was off by
 * about 215 kcal/day per person against doubly labelled water (Sanghvi et al., AJCN 2015); 80% of that spread is about ±275.
 */
export const MIN_BURN_MARGIN = 250;

export interface EnergyEstimate {
  /** The window: the 28 days up to yesterday (today isn't finished) */
  from: string;
  to: string;
  loggedDays: number;
  /** Days with a weigh-in (several on one day count once) */
  weighIns: number;
  weighSpanDays: number;
  ready: boolean;
  /** Average daily food: logged days, weighted by how many fast and nourish days the window held (see estimateEnergy) */
  avgIntake: number | null;
  /** Average food on logged fast / nourish days, when the window has both kinds and each has MIN_LOGGED_PER_KIND logged days */
  fastAvgIntake: number | null;
  nourishAvgIntake: number | null;
  /** Fast days in the window, from the planner's day types */
  fastDays: number;
  /** kg per week from the weigh-ins in the window (negative = losing) */
  weightChangePerWeek: number | null;
  /** Calories burned per day, everything included (workouts too) */
  expenditure: number | null;
  /**
   * How far the burn could plausibly be off either way (an 80% range), from the scatter of the weigh-ins
   * around their line and of the logged days around their average. It doesn't cover food left unlogged.
   */
  expenditureMargin: number | null;
  /** Average workout calories per day in the window */
  avgWorkoutBurn: number;
}

/**
 * Estimates daily calorie burn from what was eaten and how weight changed:
 * burn ≈ average intake − (weight change per day × 7,700 kcal/kg).
 * Only days with food logged count towards intake, so the estimate is only as good as the logging.
 * With day types (fast or nourish), fast and nourish days are averaged apart and combined by how many of
 * each the window held, so logging fast days more (or less) diligently than the rest doesn't skew it,
 * which matters on a 5:2 pattern where the two differ by well over a thousand kcal.
 */
export const estimateEnergy = (
  summaries: DailySummary[],
  history: WeightEntry[],
  today = localDateString(),
  /** Which days' food logs are full enough to count (see isCompleteDay); default any food at all */
  isComplete: (s: DailySummary) => boolean = s => (s.caloriesConsumed || 0) > 0,
  /** date → day type from the planner; 'fast' days are told apart from the rest */
  dayTypes: Record<string, string> = {},
): EnergyEstimate => {
  const to = addDays(today, -1);
  const from = addDays(to, -(ESTIMATE_WINDOW_DAYS - 1));
  const inWindow = summaries.filter(s => s.date >= from && s.date <= to);
  const logged = inWindow.filter(isComplete);
  // One point per day (several weigh-ins on a day count as their average), so a day can't count twice
  const byDate = new Map<string, number[]>();
  (history || []).filter(e => e.weight > 0 && e.date >= from && e.date <= to)
    .forEach(e => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e.weight]));
  const weighIns = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ws]) => ({ time: parseLocalDate(date).getTime(), weight: ws.reduce((a, b) => a + b, 0) / ws.length, date }));
  const weighSpanDays = weighIns.length >= 2 ? daysBetween(weighIns[0].date, weighIns[weighIns.length - 1].date) : 0;
  const ready = logged.length >= MIN_LOGGED_DAYS && weighIns.length >= MIN_WEIGH_INS && weighSpanDays >= MIN_WEIGH_SPAN_DAYS;

  const mean = (days: DailySummary[]) => (days.length ? days.reduce((a, s) => a + s.caloriesConsumed, 0) / days.length : null);
  const isFast = (date: string) => dayTypes[date] === 'fast';
  const fastDays = Object.keys(dayTypes).filter(d => isFast(d) && d >= from && d <= to).length;
  const loggedFast = logged.filter(s => isFast(s.date));
  const loggedNourish = logged.filter(s => !isFast(s.date));
  const fastAvg = mean(loggedFast);
  const nourishAvg = mean(loggedNourish);
  const split = fastDays > 0 && fastDays < ESTIMATE_WINDOW_DAYS && fastAvg !== null && nourishAvg !== null
    && loggedFast.length >= MIN_LOGGED_PER_KIND && loggedNourish.length >= MIN_LOGGED_PER_KIND;
  const avgIntake = split ? (fastAvg * fastDays + nourishAvg * (ESTIMATE_WINDOW_DAYS - fastDays)) / ESTIMATE_WINDOW_DAYS : mean(logged);
  const fit = weighIns.length >= 2 && weighSpanDays > 0 ? fitSlope(weighIns) : null;
  const slope = fit ? fit.slope : null;

  // Standard error of the average intake: each kind of day apart when split, weighted by its share of the window
  const sem = (days: DailySummary[]) => {
    const m = mean(days);
    if (m === null || days.length < 2) return null;
    return Math.sqrt(days.reduce((a, s) => a + (s.caloriesConsumed - m) ** 2, 0) / (days.length - 1) / days.length);
  };
  const fastShare = fastDays / ESTIMATE_WINDOW_DAYS;
  const intakeSe = split
    ? Math.sqrt((fastShare * sem(loggedFast)!) ** 2 + ((1 - fastShare) * sem(loggedNourish)!) ** 2)
    : sem(logged);
  const expenditure = ready && avgIntake !== null && slope !== null ? avgIntake - slope * KCAL_PER_KG : null;
  const expenditureMargin = expenditure !== null && fit?.se != null && intakeSe !== null
    ? Math.max(MIN_BURN_MARGIN, Math.hypot(t80(weighIns.length - 2) * fit.se * KCAL_PER_KG, t80(logged.length - 1) * intakeSe))
    : null;
  const avgWorkoutBurn = inWindow.reduce((a, s) => a + (s.caloriesBurned || 0), 0) / ESTIMATE_WINDOW_DAYS;

  return {
    from,
    to,
    loggedDays: logged.length,
    weighIns: weighIns.length,
    weighSpanDays,
    ready,
    avgIntake,
    fastAvgIntake: split ? fastAvg : null,
    nourishAvgIntake: split ? nourishAvg : null,
    fastDays,
    weightChangePerWeek: slope !== null ? slope * 7 : null,
    expenditure,
    expenditureMargin,
    avgWorkoutBurn,
  };
};

/** The burn estimate as the app shows it everywhere: the stricter completeness bar, fast and nourish days apart. */
export const estimateEnergyFor = (
  stats: Pick<UserStats, 'dailyCalorieGoal' | 'nonFastDayCalories' | 'weightHistory'>,
  summaries: DailySummary[],
  dayTypes: Record<string, string>,
  today = localDateString(),
) => estimateEnergy(summaries, stats.weightHistory, today, completeDayFor(stats, dayTypes, ENERGY_COMPLETE_DAY_SHARE), dayTypes);

/** The burn's likely range, rounded to tens: [low, high], or null before there's an estimate. */
export const burnRange = (estimate: Pick<EnergyEstimate, 'expenditure' | 'expenditureMargin'>): [number, number] | null => {
  if (estimate.expenditure === null || estimate.expenditureMargin === null) return null;
  const round = (n: number) => Math.round(n / 10) * 10;
  return [round(estimate.expenditure - estimate.expenditureMargin), round(estimate.expenditure + estimate.expenditureMargin)];
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
