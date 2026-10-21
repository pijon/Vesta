import { DailyLog, DailySummary, MealSlot, PlannedDayRecord, UserStats, WeightEntry } from '../types';
import { MAX_PLAUSIBLE_FAST_HOURS } from '../constants';
import { localDateString, parseLocalDate } from './dateUtils';
import { MEAL_SLOTS, addDays } from './planUtils';
import { normalizeFoodName } from './foodMatch';
import { isCompleteDay } from './logCompleteness';
import { weightTrend } from './energyModel';

export type AnalyticsPeriod = 'week' | 'month' | 'quarter';

export const PERIODS: { value: AnalyticsPeriod; label: string; days: number }[] = [
  { value: 'week', label: 'Week', days: 7 },
  { value: 'month', label: 'Month', days: 30 },
  { value: 'quarter', label: '3 months', days: 90 },
];

export interface AnalyticsDay {
  date: string;
  /** Midnight timestamp, for time axes */
  time: number;
  isFastDay: boolean;
  /** Food logged that day (calories > 0) */
  logged: boolean;
  /** Logged fully enough to count in averages (see isCompleteDay) */
  complete: boolean;
  calories: number;
  /** Grams, when any of the day's food had a protein amount */
  protein: number | null;
  calorieTarget: number;
  burned: number;
  workouts: number;
  water: number;
  /** Longest fast ending that day, when plausible (≤ 72 h) */
  fastHours: number | null;
  goals: { calories: boolean; water: boolean; movement: boolean };
}

/**
 * One entry per calendar day in the period (oldest first), so charts show unlogged days as gaps
 * instead of drawing logged days next to each other. Today uses the live log. The period ends
 * today unless `end` says otherwise.
 */
export const buildDays = (
  periodDays: number,
  summaries: DailySummary[],
  dayTypes: Record<string, string>,
  stats: UserStats,
  todayLog: DailyLog,
  end = localDateString(),
): AnalyticsDay[] => {
  const today = localDateString();
  const byDate = new Map(summaries.map(s => [s.date, s]));
  byDate.set(today, {
    date: today,
    caloriesConsumed: todayLog.items.reduce((sum, item) => sum + (item.calories || 0), 0),
    caloriesBurned: (todayLog.workouts || []).reduce((sum, w) => sum + (w.caloriesBurned || 0), 0),
    netCalories: 0,
    workoutCount: (todayLog.workouts || []).length,
    waterIntake: todayLog.waterIntake || 0,
    maxFastingHours: todayLog.maxFastingHours,
    ...(todayLog.items.some(item => typeof item.protein === 'number')
      ? { proteinConsumed: todayLog.items.reduce((sum, item) => sum + (item.protein || 0), 0) }
      : {}),
    ...(todayLog.status ? { status: todayLog.status } : {}),
  });

  const waterGoal = stats.dailyWaterGoal || 2000;

  return Array.from({ length: periodDays }, (_, i) => {
    const date = addDays(end, i - periodDays + 1);
    const s = byDate.get(date);
    const isFastDay = dayTypes[date] === 'fast';
    const calorieTarget = isFastDay ? stats.dailyCalorieGoal : (stats.nonFastDayCalories || 2000);
    const calories = s?.caloriesConsumed || 0;
    const water = s?.waterIntake || 0;
    const workouts = s?.workoutCount || 0;
    const fast = s?.maxFastingHours;
    return {
      date,
      time: parseLocalDate(date).getTime(),
      isFastDay,
      logged: calories > 0,
      complete: isCompleteDay(calories, calorieTarget, s?.status),
      calories,
      protein: s?.proteinConsumed ?? null,
      calorieTarget,
      burned: s?.caloriesBurned || 0,
      workouts,
      water,
      fastHours: fast && fast > 0 && fast <= MAX_PLAUSIBLE_FAST_HOURS ? fast : null,
      goals: {
        calories: calories > 0 && calories <= calorieTarget,
        water: water >= waterGoal,
        movement: workouts > 0,
      },
    };
  });
};

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export interface PeriodSummary {
  loggedDays: number;
  avgCalories: number | null;
  avgTarget: number | null;
  daysOnTarget: number;
  /** Fully logged nourish days, and how many stayed within their target */
  nourishLogged: number;
  nourishOnTarget: number;
  /** Fully logged fast days, and how many were kept (within the fast-day target) */
  fastDaysLogged: number;
  fastDaysKept: number;
  fastDays: number;
  avgFastDayCalories: number | null;
  avgFast: number | null;
  longestFast: number | null;
  fastsReachingTarget: number;
  fastCount: number;
  workouts: number;
  burned: number;
  avgWater: number | null;
  /** Average protein on days where it was tracked, and how many such days */
  avgProtein: number | null;
  proteinDays: number;
  waterDaysMet: number;
  waterDaysLogged: number;
}

export const summarize = (days: AnalyticsDay[], targetFastHours: number): PeriodSummary => {
  // Averages only use fully logged days; a half-logged day would look like an easy day on target
  const logged = days.filter(d => d.complete);
  const fasts = days.map(d => d.fastHours).filter((h): h is number => h !== null);
  const fastDaysLogged = logged.filter(d => d.isFastDay);
  const waterDays = days.filter(d => d.water > 0);
  return {
    loggedDays: logged.length,
    avgCalories: average(logged.map(d => d.calories)),
    avgTarget: average(logged.map(d => d.calorieTarget)),
    daysOnTarget: logged.filter(d => d.goals.calories).length,
    nourishLogged: logged.length - fastDaysLogged.length,
    nourishOnTarget: logged.filter(d => !d.isFastDay && d.goals.calories).length,
    fastDaysLogged: fastDaysLogged.length,
    fastDaysKept: fastDaysLogged.filter(d => d.goals.calories).length,
    fastDays: days.filter(d => d.isFastDay).length,
    avgFastDayCalories: average(fastDaysLogged.map(d => d.calories)),
    avgFast: average(fasts),
    longestFast: fasts.length ? Math.max(...fasts) : null,
    fastsReachingTarget: fasts.filter(h => h >= targetFastHours).length,
    fastCount: fasts.length,
    workouts: days.reduce((sum, d) => sum + d.workouts, 0),
    burned: days.reduce((sum, d) => sum + d.burned, 0),
    avgWater: average(waterDays.map(d => d.water)),
    avgProtein: average(logged.filter(d => d.protein !== null).map(d => d.protein!)),
    proteinDays: logged.filter(d => d.protein !== null).length,
    waterDaysMet: days.filter(d => d.goals.water).length,
    waterDaysLogged: waterDays.length,
  };
};

/** A stretch this long with nothing logged ends one spell of tracking; charts start after the latest */
const CHART_BREAK_DAYS = 14;

/**
 * Where the period's charts start: the first active day after the latest long break, so a stray
 * day logged weeks before you really started doesn't squash everything since into a corner.
 * Charts always keep at least `minDays`.
 */
export const chartStart = (days: AnalyticsDay[], minDays = 14): number => {
  // Food and fasts only: the charts that use this are about eating
  const active = days.map(d => d.logged || d.fastHours !== null);
  let start = active.indexOf(true);
  if (start < 0) return 0;
  let idle = 0;
  active.forEach((on, i) => {
    if (on) {
      if (idle >= CHART_BREAK_DAYS) start = i;
      idle = 0;
    } else idle++;
  });
  return Math.max(0, Math.min(start, days.length - minDays));
};

export interface WeightProgress {
  /** Latest smoothed trend weight */
  current: number;
  /** Where the current spell of weigh-ins started, and the trend's change since */
  since: string;
  change: number;
  /** kg per week (negative = losing): the projection's pace, else the trend over the last four weeks */
  ratePerWeek: number | null;
  /** kg still to go (positive) when there's a goal */
  toGoal: number | null;
  projection: WeightProjection | null;
  /** The trend over the last 90 days of the current spell, for a small line */
  line: { time: number; trend: number }[];
}

/** Progress towards the goal, from the smoothed trend; it doesn't depend on the chosen period */
export const weightProgress = (history: WeightEntry[], goal: number, today = localDateString()): WeightProgress | null => {
  const trend = weightTrend(history).filter(p => p.date <= today);
  if (!trend.length) return null;
  const latest = trend[trend.length - 1];
  const run = trend.filter(p => p.run === latest.run);
  const recent = run.filter(p => p.date >= addDays(today, -(PROJECTION_WINDOW_DAYS - 1)));
  const projection = projectGoal(history, goal, today);
  let ratePerWeek = projection?.ratePerWeek ?? null;
  if (ratePerWeek === null && recent.length >= 2 && (recent[recent.length - 1].time - recent[0].time) / 86_400_000 >= 14) {
    const xs = recent.map(p => (p.time - recent[0].time) / 86_400_000);
    const mx = average(xs)!;
    const my = average(recent.map(p => p.trend))!;
    ratePerWeek = 7 * xs.reduce((sum, x, i) => sum + (x - mx) * (recent[i].trend - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  }
  return {
    current: latest.trend,
    since: run[0].date,
    change: latest.trend - run[0].trend,
    ratePerWeek,
    toGoal: goal > 0 ? Math.abs(latest.trend - goal) : null,
    projection,
    line: run.filter(p => p.date >= addDays(today, -89)).map(p => ({ time: p.time, trend: p.trend })),
  };
};

/** When the goal would be reached losing (or gaining) `ratePerWeek` kg a week from `current` */
export const goalDateAtPace = (current: number, goal: number, ratePerWeek: number, today = localDateString()): string | null => {
  if (!(goal > 0) || ratePerWeek <= 0 || Math.abs(current - goal) < 0.05) return null;
  return addDays(today, Math.round((Math.abs(current - goal) / ratePerWeek) * 7));
};

export interface WeightPoint { date: string; time: number; weight: number }

export interface WeightSummary {
  /** Weigh-ins shown on the chart */
  points: WeightPoint[];
  /** True when the period had fewer than two weigh-ins and the latest ones are shown instead */
  fallback: boolean;
  /** Weigh-ins within the period */
  inPeriod: number;
  /** Latest smoothed trend weight */
  current: number | null;
  /** Change in the trend across the shown points (within the latest unbroken run) */
  change: number | null;
  toGoal: number | null;
  /** kg per week: the slope of the trend across the shown points (negative = losing) */
  ratePerWeek: number | null;
  /** When the goal would be reached at the recent pace, if heading towards it within two years */
  projection: WeightProjection | null;
}

/** Weigh-ins the projection reads, counting back from today, and how much it needs */
export const PROJECTION_WINDOW_DAYS = 28;
const PROJECTION_MIN_WEIGH_INS = 4;
const PROJECTION_MIN_SPAN_DAYS = 14;
const PROJECTION_MAX_DAYS = 730;
/** Student's t for an 80% range, by degrees of freedom (weigh-ins − 2); beyond the table it's about 1.3 */
const T80 = [Infinity, 3.078, 1.886, 1.638, 1.533, 1.476, 1.44, 1.415, 1.397, 1.383, 1.372, 1.363, 1.356, 1.35, 1.345, 1.341];
const t80 = (df: number) => T80[df] ?? (df < 30 ? 1.32 : 1.3);

export interface WeightProjection {
  /** Most likely date the goal is reached */
  date: string;
  /** Earliest and latest likely dates; latest is null when a slower pace might not get there within two years */
  earliest: string;
  latest: string | null;
  /** kg per week over the window (negative = losing) */
  ratePerWeek: number;
}

/**
 * Fits a straight line through the last four weeks of weigh-ins (one per day, averaged) and follows
 * it to the goal. Starting from the fitted line rather than the smoothed trend keeps the trend's lag
 * out of the date. The likely range is where the line's 80% confidence band reaches the goal, so it
 * allows for doubt about both the pace and where you are now.
 */
export const projectGoal = (history: WeightEntry[], goal: number, today = localDateString()): WeightProjection | null => {
  if (!(goal > 0)) return null;
  const since = addDays(today, -(PROJECTION_WINDOW_DAYS - 1));
  const byDate = new Map<string, number[]>();
  (history || []).filter(e => e.weight > 0 && e.date >= since && e.date <= today)
    .forEach(e => byDate.set(e.date, [...(byDate.get(e.date) ?? []), e.weight]));
  const days = [...byDate.entries()]
    .map(([date, ws]) => ({ date, weight: ws.reduce((a, b) => a + b, 0) / ws.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < PROJECTION_MIN_WEIGH_INS) return null;
  const last = days[days.length - 1];
  const xs = days.map(d => Math.round((parseLocalDate(d.date).getTime() - parseLocalDate(days[0].date).getTime()) / 86_400_000));
  if (xs[xs.length - 1] < PROJECTION_MIN_SPAN_DAYS) return null;

  const mx = average(xs)!;
  const my = average(days.map(d => d.weight))!;
  const sxx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  const slope = xs.reduce((sum, x, i) => sum + (x - mx) * (days[i].weight - my), 0) / sxx;
  const fitted = (x: number) => my + slope * (x - mx);
  const variance = xs.reduce((sum, x, i) => sum + (days[i].weight - fitted(x)) ** 2, 0) / (xs.length - 2);
  const t = t80(xs.length - 2);
  const bandAt = (x: number) => t * Math.sqrt(variance * (1 / xs.length + (x - mx) ** 2 / sxx));

  const lastX = xs[xs.length - 1];
  const start = fitted(lastX);
  const direction = Math.sign(slope);
  if (direction === 0 || Math.sign(goal - start) !== direction) return null;
  const reached = (value: number) => (direction < 0 ? value <= goal : value >= goal);
  // First day after the last weigh-in when `valueAt` reaches the goal, within two years
  const firstDay = (valueAt: (x: number) => number) => {
    for (let k = 0; k <= PROJECTION_MAX_DAYS; k++) if (reached(valueAt(lastX + k))) return k;
    return null;
  };
  const likely = Math.round((goal - start) / slope);
  if (likely > PROJECTION_MAX_DAYS) return null;
  const earliest = firstDay(x => fitted(x) + direction * bandAt(x)) ?? likely;
  const latest = firstDay(x => fitted(x) - direction * bandAt(x));
  return {
    date: addDays(last.date, likely),
    earliest: addDays(last.date, earliest),
    latest: latest === null ? null : addDays(last.date, latest),
    ratePerWeek: slope * 7,
  };
};

export const weightSummary = (history: WeightEntry[], periodDays: number, goal: number): WeightSummary => {
  const all = [...(history || [])]
    .filter(e => e.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({ date: e.date, time: parseLocalDate(e.date).getTime(), weight: e.weight }));
  const since = addDays(localDateString(), -periodDays + 1);
  let points = all.filter(p => p.date >= since);
  const inPeriod = points.length;
  const fallback = points.length < 2 && all.length >= 2;
  if (fallback) points = all.slice(-8);

  // Everything below reads the smoothed trend, so the numbers match the line on the chart
  const trend = weightTrend(history);
  const latest = trend.length ? trend[trend.length - 1] : null;
  const current = latest ? latest.trend : null;
  const shown = latest && points.length
    ? trend.filter(p => p.run === latest.run && p.date >= points[0].date && p.date <= points[points.length - 1].date)
    : [];
  const change = shown.length >= 2 ? shown[shown.length - 1].trend - shown[0].trend : null;

  let ratePerWeek: number | null = null;
  if (shown.length >= 2) {
    const days = shown.map(p => (p.time - shown[0].time) / 86_400_000);
    if (days[days.length - 1] >= 3) {
      const mx = average(days)!;
      const my = average(shown.map(p => p.trend))!;
      const slope = days.reduce((sum, x, i) => sum + (x - mx) * (shown[i].trend - my), 0) /
        days.reduce((sum, x) => sum + (x - mx) ** 2, 0);
      ratePerWeek = slope * 7;
    }
  }

  return { points, fallback, inPeriod, current, change, toGoal: current !== null && goal > 0 ? current - goal : null, ratePerWeek, projection: projectGoal(history, goal) };
};

export interface Insight {
  id: string;
  /** win = better than the period before (or on target), watch = worse, steady = about the same */
  tone: 'win' | 'watch' | 'steady';
  text: string;
}

const MAX_INSIGHTS = 4;
const round10 = (n: number) => Math.round(n / 10) * 10;
const pct = (n: number, of: number) => Math.round((n / of) * 100);
const kcal = (n: number) => `${round10(n).toLocaleString()} kcal`;

/** A period has enough food logged to say something about it */
const enoughLogged = (s: PeriodSummary) => s.loggedDays >= 3;

/** Average calories more a day at weekends than on weekdays, when both have enough logged days */
export const weekendGap = (days: AnalyticsDay[]) => {
  const logged = days.filter(d => d.complete);
  const isWeekend = (d: AnalyticsDay) => [0, 6].includes(parseLocalDate(d.date).getDay());
  const weekend = logged.filter(isWeekend);
  const weekday = logged.filter(d => !isWeekend(d));
  if (weekend.length < 2 || weekday.length < 3) return null;
  return average(weekend.map(d => d.calories))! - average(weekday.map(d => d.calories))!;
};

/**
 * How the period went compared with the one before it, wins first. Each insight needs enough data
 * in both periods to compare; a few also stand alone against a target. What to change is the
 * Guidance panel's job, so logging gaps and protein shortfalls aren't repeated here.
 */
export const insightsFor = (
  current: AnalyticsDay[],
  previous: AnalyticsDay[],
  targetFastHours: number,
  fastTarget: number,
): { insights: Insight[]; compared: boolean } => {
  const insights: Insight[] = [];
  const cur = summarize(current, targetFastHours);
  const prev = summarize(previous, targetFastHours);
  const hasPrev = enoughLogged(prev);
  if (!enoughLogged(cur)) return { insights, compared: false };
  const change = (now: number, before: number, step: number): Insight['tone'] =>
    now - before >= step ? 'win' : before - now >= step ? 'watch' : 'steady';

  // Days within the calorie target
  const onTarget = pct(cur.daysOnTarget, cur.loggedDays);
  if (hasPrev) {
    const before = pct(prev.daysOnTarget, prev.loggedDays);
    const tone = change(onTarget, before, 10);
    insights.push({
      id: 'on-target', tone,
      text: tone === 'steady'
        ? `Within your calorie target on ${onTarget}% of logged days, about the same as before.`
        : `Within your calorie target on ${onTarget}% of logged days, ${tone === 'win' ? 'up' : 'down'} from ${before}%.`,
    });
  } else {
    insights.push({ id: 'on-target', tone: onTarget >= 70 ? 'win' : 'steady', text: `Within your calorie target on ${cur.daysOnTarget} of ${cur.loggedDays} logged days.` });
  }

  // Weekends against weekdays
  const gap = weekendGap(current);
  const gapBefore = hasPrev ? weekendGap(previous) : null;
  if (gap !== null && gapBefore !== null && gapBefore >= 250 && gap < 150) {
    insights.push({ id: 'weekends', tone: 'win', text: `Weekends now match your weekdays, down from ${kcal(gapBefore)} a day more.` });
  } else if (gap !== null && gap >= 150) {
    const tone = gapBefore === null ? 'watch' : change(gapBefore, gap, 100);
    insights.push({
      id: 'weekends', tone,
      text: gapBefore === null || tone === 'steady'
        ? `You eat about ${kcal(gap)} more a day at weekends.`
        : `Weekends are ${kcal(gap)} a day over weekdays, ${tone === 'win' ? 'down' : 'up'} from ${kcal(gapBefore)}.`,
    });
  }

  // Fast days against their target
  const fastDays = current.filter(d => d.complete && d.isFastDay).length;
  if (fastDays >= 2 && cur.avgFastDayCalories !== null && fastTarget > 0) {
    const avg = cur.avgFastDayCalories;
    insights.push(avg <= fastTarget * 1.05
      ? { id: 'fast-days', tone: 'win', text: `Fast days averaged ${kcal(avg)}, ${avg < fastTarget * 0.95 ? 'under' : 'right on'} your ${kcal(fastTarget)} target.` }
      : avg <= fastTarget * 1.1
        ? { id: 'fast-days', tone: 'steady', text: `Fast days averaged ${kcal(avg)}, close to your ${kcal(fastTarget)} target.` }
        : { id: 'fast-days', tone: 'watch', text: `Fast days averaged ${kcal(avg)}, ${kcal(avg - fastTarget)} over your ${kcal(fastTarget)} target.` });
  }

  // Protein
  if (hasPrev && cur.avgProtein !== null && prev.avgProtein !== null && cur.proteinDays >= 3 && prev.proteinDays >= 3) {
    const now = Math.round(cur.avgProtein);
    const before = Math.round(prev.avgProtein);
    const tone = change(now, before, Math.max(5, before * 0.1));
    insights.push({
      id: 'protein', tone,
      text: tone === 'steady' ? `Protein steady at about ${now} g a day.` : `Protein ${tone === 'win' ? 'up' : 'down'} to ${now} g a day, from ${before} g.`,
    });
  }

  // Fasts reaching their target length
  if (cur.fastCount >= 3) {
    const reached = pct(cur.fastsReachingTarget, cur.fastCount);
    const base = `${cur.fastsReachingTarget} of ${cur.fastCount} fasts reached ${targetFastHours} h`;
    if (hasPrev && prev.fastCount >= 3) {
      const before = pct(prev.fastsReachingTarget, prev.fastCount);
      const tone = change(reached, before, 15);
      insights.push({ id: 'fasts', tone, text: tone === 'steady' ? `${base}, about the same as before.` : `${base}, ${tone === 'win' ? 'up' : 'down'} from ${before}% of them.` });
    } else {
      insights.push({ id: 'fasts', tone: reached >= 70 ? 'win' : 'steady', text: `${base}.` });
    }
  }

  // Workouts
  if (hasPrev && (cur.workouts >= 2 || prev.workouts >= 2)) {
    const tone = change(cur.workouts, prev.workouts, Math.max(2, prev.workouts * 0.2));
    const n = `${cur.workouts} workout${cur.workouts === 1 ? '' : 's'}`;
    insights.push({ id: 'workouts', tone, text: tone === 'steady' ? `${n}, the same pace as before.` : `${n}, ${tone === 'win' ? 'up' : 'down'} from ${prev.workouts}.` });
  }

  // Water goal
  if (hasPrev && cur.waterDaysLogged >= 3 && prev.waterDaysLogged >= 3) {
    const tone = change(cur.waterDaysMet, prev.waterDaysMet, 2);
    if (tone !== 'steady') insights.push({ id: 'water', tone, text: `Water goal met on ${cur.waterDaysMet} days, ${tone === 'win' ? 'up' : 'down'} from ${prev.waterDaysMet}.` });
  }

  const order = { win: 0, watch: 1, steady: 2 };
  return { insights: insights.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, MAX_INSIGHTS), compared: hasPrev };
};

// --- Patterns: what goes with weight change, how the plan goes, where calories come from ---

/** Fully logged days that make a week a logged week */
export const LOGGED_WEEK_DAYS = 5;
/** Weeks the logging-and-weight comparison looks back over */
export const LINK_WEEKS = 12;

export interface WeekGroup {
  weeks: number;
  /** Average change in trend weight per week, kg (negative = losing) */
  change: number;
}

export interface LoggingWeightLink {
  /** Weeks (Mon–Sun) with at least LOGGED_WEEK_DAYS fully logged days, and the rest */
  logged: WeekGroup;
  other: WeekGroup;
}

/** The Sunday that ended the last full week before `today` */
export const lastFullWeekEnd = (today = localDateString()) => addDays(today, -(parseLocalDate(today).getDay() || 7));

/**
 * How the trend weight moved in weeks you logged most days against the other weeks. `days` should
 * be whole Mon–Sun weeks (oldest first). A week counts when the trend covers both its ends in one
 * run of weigh-ins; each side needs two such weeks.
 */
export const loggingWeightLink = (days: AnalyticsDay[], history: WeightEntry[]): LoggingWeightLink | null => {
  const trend = new Map(weightTrend(history).map(p => [p.date, p]));
  const logged: number[] = [];
  const other: number[] = [];
  for (let i = 0; i + 7 <= days.length; i += 7) {
    const week = days.slice(i, i + 7);
    const end = trend.get(week[6].date);
    const start = trend.get(addDays(week[0].date, -1));
    if (!end || !start || end.run !== start.run) continue;
    (week.filter(d => d.complete).length >= LOGGED_WEEK_DAYS ? logged : other).push(end.trend - start.trend);
  }
  if (logged.length < 2 || other.length < 2) return null;
  return {
    logged: { weeks: logged.length, change: average(logged)! },
    other: { weeks: other.length, change: average(other)! },
  };
};

/** What the comparison says, in a sentence; better means closer to the goal (losing unless the goal is above) */
export const loggingWeightVerdict = (link: LoggingWeightLink, losing: boolean): Pick<Insight, 'tone' | 'text'> => {
  const gain = (losing ? -1 : 1) * (link.logged.change - link.other.change);
  return gain >= 0.1 ? { tone: 'win', text: 'Weeks you log most days go better for your weight.' }
    : gain <= -0.1 ? { tone: 'steady', text: 'Your weight did as well in the weeks you logged less.' }
    : { tone: 'steady', text: 'Your weight moved about the same either way.' };
};

export interface SlotAdherence { slot: MealSlot; planned: number; eaten: number }

export interface PlanAdherence {
  planned: number;
  eaten: number;
  /** Planned meals by slot, in slot order (slots with nothing planned left out) */
  slots: SlotAdherence[];
}

/** Days with ticks needed before untouched meals read as skipped rather than as a habit of not ticking */
const MIN_TICKED_DAYS = 3;
const MIN_PLANNED = 5;

/**
 * How many planned meals were ticked as eaten, on days with food logged (a day you didn't open the
 * app says nothing about the plan). Needs some ticked days, so someone who logs without ticking
 * doesn't read as skipping every meal.
 */
export const planAdherence = (planned: Record<string, PlannedDayRecord>, days: AnalyticsDay[]): PlanAdherence | null => {
  const bySlot = new Map<MealSlot, SlotAdherence>();
  let tickedDays = 0;
  days.filter(d => d.logged).forEach(day => {
    const record = planned[day.date];
    if (!record?.meals.length) return;
    const done = new Set(record.completed);
    let ticked = false;
    record.meals.forEach(({ key, slot }) => {
      const entry = bySlot.get(slot) ?? { slot, planned: 0, eaten: 0 };
      entry.planned++;
      if (done.has(key)) { entry.eaten++; ticked = true; }
      bySlot.set(slot, entry);
    });
    if (ticked) tickedDays++;
  });
  const slots = MEAL_SLOTS.map(s => bySlot.get(s.slot)).filter((s): s is SlotAdherence => !!s);
  const total = slots.reduce((sum, s) => sum + s.planned, 0);
  if (tickedDays < MIN_TICKED_DAYS || total < MIN_PLANNED) return null;
  return { planned: total, eaten: slots.reduce((sum, s) => sum + s.eaten, 0), slots };
};

/** The slot most often skipped, when it's clearly behind the others (at least 3 planned) */
export const weakestSlot = (adherence: PlanAdherence): SlotAdherence | null => {
  const rate = (s: SlotAdherence) => s.eaten / s.planned;
  const candidates = adherence.slots.filter(s => s.planned >= 3);
  if (candidates.length < 2) return null;
  const weakest = candidates.reduce((a, b) => (rate(b) < rate(a) ? b : a));
  const rest = candidates.filter(s => s !== weakest);
  const restRate = rest.reduce((sum, s) => sum + s.eaten, 0) / rest.reduce((sum, s) => sum + s.planned, 0);
  return restRate - rate(weakest) >= 0.25 ? weakest : null;
};

export type TimeOfDay = 'morning' | 'midday' | 'evening' | 'late';

export const TIMES_OF_DAY: { id: TimeOfDay; label: string; from: number }[] = [
  { id: 'morning', label: 'Morning', from: 0 },
  { id: 'midday', label: 'Midday', from: 11 },
  { id: 'evening', label: 'Evening', from: 16 },
  { id: 'late', label: 'After 9 pm', from: 21 },
];

export interface FoodSource {
  name: string;
  calories: number;
  /** Times it was logged */
  count: number;
  /** Fraction of all calories in the period */
  share: number;
}

export interface CalorieSources {
  total: number;
  days: number;
  /** Foods logged more than once, most calories in total first */
  foods: FoodSource[];
  /** Fraction of all calories from foods logged more than once */
  repeatShare: number;
  /** Calories by time of day, from when entries were logged on their own day */
  times: { id: TimeOfDay; label: string; calories: number; share: number }[];
}

const TOP_FOODS = 5;

/**
 * The foods you keep coming back to that brought the most calories between `from` and `to`
 * (inclusive), grouped by name (one-offs say little about habits),
 * and how the day's calories split by time of day. Entries logged on another day than the one
 * they're for (filled in later) count for foods but not for the time of day.
 */
export const calorieSources = (logs: DailyLog[], from: string, to: string): CalorieSources | null => {
  const inRange = logs.filter(log => log.date >= from && log.date <= to && log.items?.length);
  const items = inRange.flatMap(log => log.items.filter(item => item.calories > 0).map(item => ({ item, date: log.date })));
  if (inRange.length < 3 || items.length < 10) return null;

  const total = items.reduce((sum, { item }) => sum + item.calories, 0);
  const byName = new Map<string, { name: string; calories: number; count: number; last: number }>();
  const byTime = new Map<TimeOfDay, number>();
  items.forEach(({ item, date }) => {
    const key = normalizeFoodName(item.name);
    if (key) {
      const entry = byName.get(key) ?? { name: item.name.trim(), calories: 0, count: 0, last: 0 };
      entry.calories += item.calories;
      entry.count++;
      if (item.timestamp > entry.last) Object.assign(entry, { name: item.name.trim(), last: item.timestamp });
      byName.set(key, entry);
    }
    const at = new Date(item.timestamp);
    if (item.timestamp && localDateString(at) === date) {
      const time = [...TIMES_OF_DAY].reverse().find(t => at.getHours() >= t.from)!.id;
      byTime.set(time, (byTime.get(time) ?? 0) + item.calories);
    }
  });
  const timed = [...byTime.values()].reduce((a, b) => a + b, 0);
  const repeats = [...byName.values()].filter(f => f.count >= 2);
  return {
    total,
    days: inRange.length,
    repeatShare: repeats.reduce((sum, f) => sum + f.calories, 0) / total,
    foods: repeats
      .sort((a, b) => b.calories - a.calories)
      .slice(0, TOP_FOODS)
      .map(({ name, calories, count }) => ({ name, calories, count, share: calories / total })),
    times: timed ? TIMES_OF_DAY.map(t => ({ id: t.id, label: t.label, calories: byTime.get(t.id) ?? 0, share: (byTime.get(t.id) ?? 0) / timed })) : [],
  };
};
