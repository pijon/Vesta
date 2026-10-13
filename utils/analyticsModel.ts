import { DailyLog, DailySummary, UserStats, WeightEntry } from '../types';
import { MAX_PLAUSIBLE_FAST_HOURS } from '../constants';
import { localDateString, parseLocalDate } from './dateUtils';
import { addDays } from './planUtils';

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
  });

  const waterGoal = stats.dailyWaterGoal || 2000;
  const workoutGoal = stats.dailyWorkoutCountGoal || 1;

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
        movement: workouts >= workoutGoal,
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
  const logged = days.filter(d => d.logged);
  const fasts = days.map(d => d.fastHours).filter((h): h is number => h !== null);
  const fastDaysLogged = logged.filter(d => d.isFastDay);
  const waterDays = days.filter(d => d.water > 0);
  return {
    loggedDays: logged.length,
    avgCalories: average(logged.map(d => d.calories)),
    avgTarget: average(logged.map(d => d.calorieTarget)),
    daysOnTarget: logged.filter(d => d.goals.calories).length,
    fastDays: days.filter(d => d.isFastDay).length,
    avgFastDayCalories: average(fastDaysLogged.map(d => d.calories)),
    avgFast: average(fasts),
    longestFast: fasts.length ? Math.max(...fasts) : null,
    fastsReachingTarget: fasts.filter(h => h >= targetFastHours).length,
    fastCount: fasts.length,
    workouts: days.reduce((sum, d) => sum + d.workouts, 0),
    burned: days.reduce((sum, d) => sum + d.burned, 0),
    avgWater: average(waterDays.map(d => d.water)),
    avgProtein: average(days.filter(d => d.protein !== null && d.logged).map(d => d.protein!)),
    proteinDays: days.filter(d => d.protein !== null && d.logged).length,
    waterDaysMet: days.filter(d => d.goals.water).length,
    waterDaysLogged: waterDays.length,
  };
};

export interface WeightPoint { date: string; time: number; weight: number }

export interface WeightSummary {
  /** Weigh-ins shown on the chart */
  points: WeightPoint[];
  /** True when the period had fewer than two weigh-ins and the latest ones are shown instead */
  fallback: boolean;
  /** Weigh-ins within the period */
  inPeriod: number;
  current: number | null;
  /** Change over the shown points */
  change: number | null;
  toGoal: number | null;
  /** kg per week from a least-squares fit over the shown points (negative = losing) */
  ratePerWeek: number | null;
  /** When the goal would be reached at that rate, if heading towards it within two years */
  goalDate: string | null;
}

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

  const current = all.length ? all[all.length - 1].weight : null;
  const change = points.length >= 2 ? points[points.length - 1].weight - points[0].weight : null;

  let ratePerWeek: number | null = null;
  let goalDate: string | null = null;
  if (points.length >= 2) {
    const days = points.map(p => (p.time - points[0].time) / 86_400_000);
    const span = days[days.length - 1];
    if (span >= 3) {
      const mx = average(days)!;
      const my = average(points.map(p => p.weight))!;
      const slope = days.reduce((sum, x, i) => sum + (x - mx) * (points[i].weight - my), 0) /
        days.reduce((sum, x) => sum + (x - mx) ** 2, 0);
      ratePerWeek = slope * 7;
      if (current !== null && goal > 0 && slope !== 0 && Math.sign(goal - current) === Math.sign(slope)) {
        const daysToGoal = (goal - current) / slope;
        if (daysToGoal > 0 && daysToGoal < 730) goalDate = addDays(localDateString(), Math.round(daysToGoal));
      }
    }
  }

  return { points, fallback, inPeriod, current, change, toGoal: current !== null && goal > 0 ? current - goal : null, ratePerWeek, goalDate };
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
const weekendGap = (days: AnalyticsDay[]) => {
  const logged = days.filter(d => d.logged);
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
  const fastDays = current.filter(d => d.logged && d.isFastDay).length;
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
