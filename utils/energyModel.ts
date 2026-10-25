import { DailySummary, TrackingBreak, UserStats, WeightEntry } from '../types';
import { onBreak, settling, stretchOf } from './breaks';
import { localDateString, parseLocalDate } from './dateUtils';
import { completeDayFor, ENERGY_COMPLETE_DAY_SHARE } from './logCompleteness';
import { addDays } from './planUtils';
import { recovering, unwellDays } from './unwell';

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

/**
 * Least-squares slope in kg per day, its standard error and degrees of freedom (no error with too few
 * points). Points carry the stretch of tracking they belong to: each stretch gets its own level and they
 * share one slope, so the jump on the scale across a break doesn't bend the line.
 */
const fitSlope = (points: { time: number; weight: number; stretch: number }[]) => {
  const xs = points.map(p => (p.time - points[0].time) / DAY_MS);
  const groups = new Map<number, number[]>();
  points.forEach((p, i) => groups.set(p.stretch, [...(groups.get(p.stretch) ?? []), i]));
  const avg = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;
  const stretches = [...groups.values()].map(idx => ({ idx, mx: avg(idx.map(i => xs[i])), my: avg(idx.map(i => points[i].weight)) }));
  let sxx = 0;
  let sxy = 0;
  for (const { idx, mx, my } of stretches) for (const i of idx) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (points[i].weight - my); }
  const df = points.length - 1 - stretches.length;
  if (sxx === 0) return { slope: 0, se: null, df };
  const slope = sxy / sxx;
  if (df < 1) return { slope, se: null, df };
  let residuals = 0;
  for (const { idx, mx, my } of stretches) for (const i of idx) residuals += (points[i].weight - (my + slope * (xs[i] - mx))) ** 2;
  return { slope, se: Math.sqrt(residuals / df / sxx), df };
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
/** How far back the window may reach past breaks to find its 28 days (the logs read cover about 90) */
const MAX_LOOKBACK_DAYS = 89;
/** Fast and nourish days are only averaged apart once each kind has this many logged days */
export const MIN_LOGGED_PER_KIND = 3;
/**
 * The burn's likely range is never narrower than this either way. Even a validated model was off by
 * about 215 kcal/day per person against doubly labelled water (Sanghvi et al., AJCN 2015); 80% of that spread is about ±275.
 */
export const MIN_BURN_MARGIN = 250;

export interface EnergyEstimate {
  /** The window: the 28 days up to yesterday (today isn't finished), reaching back past any break or unwell day */
  from: string;
  to: string;
  /** Days in the window, not counting breaks or unwell days: 28 unless a long break left too few */
  windowDays: number;
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
  /** The two parts of the margin before the floor: from the weigh-ins' scatter, and from the logged days' */
  weightMargin: number | null;
  intakeMargin: number | null;
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
 * Days marked unwell are left out like break days, and so are the weigh-ins of the few days after them.
 */
export const estimateEnergy = (
  summaries: DailySummary[],
  history: WeightEntry[],
  today = localDateString(),
  /** Which days' food logs are full enough to count (see isCompleteDay); default any food at all */
  isComplete: (s: DailySummary) => boolean = s => (s.caloriesConsumed || 0) > 0,
  /** date → day type from the planner; 'fast' days are told apart from the rest */
  dayTypes: Record<string, string> = {},
  /** Breaks from tracking: their days are left out and the window reaches back past them (utils/breaks.ts) */
  breaks: TrackingBreak[] = [],
): EnergyEstimate => {
  const to = addDays(today, -1);
  const unwell = unwellDays(summaries);
  const windowDates: string[] = [];
  for (let back = 0; windowDates.length < ESTIMATE_WINDOW_DAYS && back <= MAX_LOOKBACK_DAYS; back++) {
    const date = addDays(to, -back);
    if (!onBreak(breaks, date) && !unwell.has(date)) windowDates.push(date);
  }
  const inWindowDate = new Set(windowDates);
  const windowDays = Math.max(windowDates.length, 1);
  const from = windowDates[windowDates.length - 1] ?? to;
  const inWindow = summaries.filter(s => inWindowDate.has(s.date));
  const logged = inWindow.filter(isComplete);
  // One point per day (several weigh-ins on a day count as their average), so a day can't count twice.
  // The days just after a break or an unwell day are left out while the scale settles
  const byDate = new Map<string, number[]>();
  (history || []).filter(e => e.weight > 0 && inWindowDate.has(e.date) && !settling(breaks, e.date) && !recovering(unwell, e.date))
    .forEach(e => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e.weight]));
  const weighIns = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ws]) => ({ time: parseLocalDate(date).getTime(), weight: ws.reduce((a, b) => a + b, 0) / ws.length, date, stretch: stretchOf(breaks, date) }));
  const weighSpanDays = weighIns.length >= 2 ? daysBetween(weighIns[0].date, weighIns[weighIns.length - 1].date) : 0;
  const ready = logged.length >= MIN_LOGGED_DAYS && weighIns.length >= MIN_WEIGH_INS && weighSpanDays >= MIN_WEIGH_SPAN_DAYS;

  const mean = (days: DailySummary[]) => (days.length ? days.reduce((a, s) => a + s.caloriesConsumed, 0) / days.length : null);
  const isFast = (date: string) => dayTypes[date] === 'fast';
  const fastDays = windowDates.filter(isFast).length;
  const loggedFast = logged.filter(s => isFast(s.date));
  const loggedNourish = logged.filter(s => !isFast(s.date));
  const fastAvg = mean(loggedFast);
  const nourishAvg = mean(loggedNourish);
  const split = fastDays > 0 && fastDays < windowDays && fastAvg !== null && nourishAvg !== null
    && loggedFast.length >= MIN_LOGGED_PER_KIND && loggedNourish.length >= MIN_LOGGED_PER_KIND;
  const avgIntake = split ? (fastAvg * fastDays + nourishAvg * (windowDays - fastDays)) / windowDays : mean(logged);
  const fit = weighIns.length >= 2 && weighSpanDays > 0 ? fitSlope(weighIns) : null;
  const slope = fit ? fit.slope : null;

  // Standard error of the average intake: each kind of day apart when split, weighted by its share of the window
  const sem = (days: DailySummary[]) => {
    const m = mean(days);
    if (m === null || days.length < 2) return null;
    return Math.sqrt(days.reduce((a, s) => a + (s.caloriesConsumed - m) ** 2, 0) / (days.length - 1) / days.length);
  };
  const fastShare = fastDays / windowDays;
  const intakeSe = split
    ? Math.sqrt((fastShare * sem(loggedFast)!) ** 2 + ((1 - fastShare) * sem(loggedNourish)!) ** 2)
    : sem(logged);
  const expenditure = ready && avgIntake !== null && slope !== null ? avgIntake - slope * KCAL_PER_KG : null;
  const weightMargin = expenditure !== null && fit?.se != null ? t80(fit.df) * fit.se * KCAL_PER_KG : null;
  const intakeMargin = expenditure !== null && intakeSe !== null ? t80(logged.length - 1) * intakeSe : null;
  const expenditureMargin = weightMargin !== null && intakeMargin !== null
    ? Math.max(MIN_BURN_MARGIN, Math.hypot(weightMargin, intakeMargin))
    : null;
  const avgWorkoutBurn = inWindow.reduce((a, s) => a + (s.caloriesBurned || 0), 0) / windowDays;

  return {
    from,
    to,
    windowDays,
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
    weightMargin,
    intakeMargin,
    avgWorkoutBurn,
  };
};

/** The burn estimate as the app shows it everywhere: the stricter completeness bar, fast and nourish days apart. */
export const estimateEnergyFor = (
  stats: Pick<UserStats, 'dailyCalorieGoal' | 'nonFastDayCalories' | 'weightHistory' | 'breaks'>,
  summaries: DailySummary[],
  dayTypes: Record<string, string>,
  today = localDateString(),
) => estimateEnergy(summaries, stats.weightHistory, today, completeDayFor(stats, dayTypes, ENERGY_COMPLETE_DAY_SHARE), dayTypes, stats.breaks);

/** The burn's likely range, rounded to tens: [low, high], or null before there's an estimate. */
export const burnRange = (estimate: Pick<EnergyEstimate, 'expenditure' | 'expenditureMargin'>): [number, number] | null => {
  if (estimate.expenditure === null || estimate.expenditureMargin === null) return null;
  const round = (n: number) => Math.round(n / 10) * 10;
  return [round(estimate.expenditure - estimate.expenditureMargin), round(estimate.expenditure + estimate.expenditureMargin)];
};

export interface RangeLimit {
  /** What widens the range most */
  cause: 'floor' | 'weighIns' | 'logging';
  /** About how wide (±) it would be with a weigh-in, or a fully logged day, every day; null when that's already so */
  daily: number | null;
}

/**
 * What limits the burn's range, and roughly how narrow it would get without that limit. Both parts shrink
 * about with the square root of how many days feed them, so a full window's worth is estimated from that.
 */
export const rangeLimit = (estimate: Pick<EnergyEstimate, 'expenditureMargin' | 'weightMargin' | 'intakeMargin' | 'weighIns' | 'loggedDays'>): RangeLimit | null => {
  const { expenditureMargin, weightMargin, intakeMargin } = estimate;
  if (expenditureMargin === null || weightMargin === null || intakeMargin === null) return null;
  if (Math.hypot(weightMargin, intakeMargin) <= MIN_BURN_MARGIN) return { cause: 'floor', daily: null };
  const full = (margin: number, days: number) => margin * Math.sqrt(Math.min(days, ESTIMATE_WINDOW_DAYS) / ESTIMATE_WINDOW_DAYS);
  const round = (n: number) => Math.round(Math.max(MIN_BURN_MARGIN, n) / 10) * 10;
  if (weightMargin >= intakeMargin) {
    return { cause: 'weighIns', daily: estimate.weighIns < ESTIMATE_WINDOW_DAYS ? round(Math.hypot(full(weightMargin, estimate.weighIns), intakeMargin)) : null };
  }
  return { cause: 'logging', daily: estimate.loggedDays < ESTIMATE_WINDOW_DAYS ? round(Math.hypot(weightMargin, full(intakeMargin, estimate.loggedDays))) : null };
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
  /** What you burn on a nourish day before workouts are added back: eating this, only fast days make a deficit */
  maintenance: number;
  /** kg a week with nourish days at maintenance, from the fast days alone (0 without fast days) */
  maintenanceLoss: number;
  /** With fast days, the pace asked for would have put nourish days more than NOURISH_BELOW_BURN under maintenance */
  limited: boolean;
  /** The nourish target the pace alone would have given, before the limits */
  unlimited: number;
  /** kg a week the suggested targets actually give */
  expectedLoss: number;
}

/**
 * On 5:2 the fast days make the deficit and nourish days stay near what you burn. A faster pace may
 * take nourish days this far under it, no further, so they don't turn into a second kind of fast day.
 */
export const NOURISH_BELOW_BURN = 300;

/**
 * The nourish-day target that gives the chosen weekly loss, given the fast days and their target.
 * The app adds workout calories (all, half or none, per Settings) back to the day's budget, so that
 * share of the average workout burn is taken off the estimate first; otherwise it would count twice.
 * With fast days (and `limit`), nourish days go no lower than NOURISH_BELOW_BURN under maintenance, and
 * the pace that gives is reported instead (`limited`, `expectedLoss`).
 */
export const suggestTargets = (
  estimate: EnergyEstimate,
  stats: Pick<UserStats, 'dailyCalorieGoal' | 'currentWeight' | 'workoutCalorieCredit'>,
  fastDaysPerWeek: number,
  weeklyLoss: number,
  /** Keep 5:2 nourish days within NOURISH_BELOW_BURN of maintenance; off for targets you set yourself */
  { limit = true }: { limit?: boolean } = {},
): TargetSuggestion | null => {
  if (estimate.expenditure === null) return null;
  const maxRate = stats.currentWeight > 0 ? Math.floor(stats.currentWeight * 0.01 * 20) / 20 : 1;
  const rate = Math.min(weeklyLoss, maxRate);
  const dailyDeficit = (rate * KCAL_PER_KG) / 7;
  const maintenance = estimate.expenditure - estimate.avgWorkoutBurn * (stats.workoutCalorieCredit ?? 1);
  const allowance = maintenance - dailyDeficit;
  const fastDays = Math.min(Math.max(Math.round(fastDaysPerWeek), 0), 6);
  const fast = stats.dailyCalorieGoal;
  const raw = (allowance * 7 - fastDays * fast) / (7 - fastDays);
  const lowest = fastDays > 0 && limit ? maintenance - NOURISH_BELOW_BURN : -Infinity;
  const limited = raw < lowest;
  const nourish = Math.max(MIN_NOURISH_TARGET, Math.round(Math.max(raw, lowest) / 10) * 10);
  const lossFrom = (nourishDay: number) => Math.max(0, (maintenance * 7 - fastDays * fast - (7 - fastDays) * nourishDay) / KCAL_PER_KG);
  return {
    nourish, fast, fastDaysPerWeek: fastDays, weeklyLoss: rate, dailyDeficit, capped: rate < weeklyLoss,
    floored: !limited && raw < MIN_NOURISH_TARGET,
    maintenance: Math.round(maintenance / 10) * 10, maintenanceLoss: fastDays > 0 ? lossFrom(maintenance) : 0,
    limited, unlimited: Math.round(raw / 10) * 10, expectedLoss: lossFrom(nourish),
  };
};

/** The fast days a week the targets plan for: the number you saved, else what the Planner shows lately */
export const planFastDays = (stats: Pick<UserStats, 'fastDaysPerWeek'>, estimate: Pick<EnergyEstimate, 'fastDays' | 'windowDays'>) =>
  stats.fastDaysPerWeek ?? Math.round(fastDaysPerWeek(estimate));

export interface PlanOutcome {
  /** What you burn on a nourish day before workouts are added back */
  maintenance: number;
  /** A week of the plan, and how far under maintenance that is */
  weeklyIntake: number;
  weeklyDeficit: number;
  /** kg a week it gives (negative = gaining) */
  weeklyLoss: number;
  /** Nourish days more than NOURISH_BELOW_BURN under maintenance on 5:2: close to a fast day */
  nourishNearFast: boolean;
}

/** What a week of your own targets gives: fast days at `fast`, the rest at `nourish`. */
export const planOutcome = (
  estimate: Pick<EnergyEstimate, 'expenditure' | 'avgWorkoutBurn'>,
  stats: Pick<UserStats, 'workoutCalorieCredit'>,
  plan: { fastDays: number; fast: number; nourish: number },
): PlanOutcome | null => {
  if (estimate.expenditure === null) return null;
  const maintenance = estimate.expenditure - estimate.avgWorkoutBurn * (stats.workoutCalorieCredit ?? 1);
  const weeklyIntake = plan.fastDays * plan.fast + (7 - plan.fastDays) * plan.nourish;
  const weeklyDeficit = maintenance * 7 - weeklyIntake;
  return {
    maintenance,
    weeklyIntake,
    weeklyDeficit,
    weeklyLoss: weeklyDeficit / KCAL_PER_KG,
    nourishNearFast: plan.fastDays > 0 && plan.nourish < maintenance - NOURISH_BELOW_BURN,
  };
};

/** Fast days per week over the estimate window, from the planner's day types (break days left out). */
export const fastDaysPerWeek = (estimate: Pick<EnergyEstimate, 'fastDays' | 'windowDays'>) => (estimate.fastDays / estimate.windowDays) * 7;
