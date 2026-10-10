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
 * instead of drawing logged days next to each other. Today uses the live log.
 */
export const buildDays = (
  periodDays: number,
  summaries: DailySummary[],
  dayTypes: Record<string, string>,
  stats: UserStats,
  todayLog: DailyLog,
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
  });

  const waterGoal = stats.dailyWaterGoal || 2000;
  const workoutGoal = stats.dailyWorkoutCountGoal || 1;

  return Array.from({ length: periodDays }, (_, i) => {
    const date = addDays(today, i - periodDays + 1);
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

/** Short, factual observations; only when there's enough data to say them. */
export const insightsFor = (days: AnalyticsDay[], summary: PeriodSummary, workoutTypes: string[]): string[] => {
  const insights: string[] = [];
  const total = days.length;
  if (summary.loggedDays < total) {
    insights.push(`You logged food on ${summary.loggedDays} of the last ${total} days. Charts only include logged days.`);
  }
  if (summary.loggedDays >= 3 && summary.daysOnTarget > 0) {
    insights.push(`${summary.daysOnTarget} of ${summary.loggedDays} logged days were within your calorie target.`);
  }
  if (summary.avgFastDayCalories !== null) {
    insights.push(`Fast days averaged ${Math.round(summary.avgFastDayCalories).toLocaleString()} kcal.`);
  }
  if (summary.fastCount >= 3 && summary.avgFast !== null) {
    insights.push(`Your fasts averaged ${summary.avgFast.toFixed(1)} hours; ${summary.fastsReachingTarget} of ${summary.fastCount} reached your target.`);
  }
  if (workoutTypes.length >= 3) {
    const counts = new Map<string, number>();
    workoutTypes.forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n >= 2) insights.push(`Your most common workout is ${top.toLowerCase()} (${n} of ${workoutTypes.length}).`);
  }
  const loggedWeekdays = days.filter(d => d.logged);
  if (loggedWeekdays.length >= 14) {
    const weekend = average(loggedWeekdays.filter(d => [0, 6].includes(parseLocalDate(d.date).getDay())).map(d => d.calories));
    const weekday = average(loggedWeekdays.filter(d => ![0, 6].includes(parseLocalDate(d.date).getDay())).map(d => d.calories));
    if (weekend !== null && weekday !== null && Math.abs(weekend - weekday) >= 200) {
      insights.push(`You eat about ${Math.round(Math.abs(weekend - weekday) / 10) * 10} kcal ${weekend > weekday ? 'more' : 'less'} a day at weekends.`);
    }
  }
  return insights;
};
