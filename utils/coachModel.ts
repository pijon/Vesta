import { CoachReadState, DailyLog, DailySummary, UserStats } from '../types';
import { localDateString } from './dateUtils';
import { addDays, proteinTarget, weekStart } from './planUtils';
import { completeDayFor } from './logCompleteness';

/**
 * Logging thresholds, in fully logged days out of 14. Logging on most days is what predicts weight
 * loss; in the SMART trial people logging 30–59% of days did as well at 18 months as those logging
 * more. So about 9 of 14 is praised, and only fewer than 5 is the thing to fix.
 */
const LOGGING_GOOD = 9;
const LOGGING_LOW = 5;
/** Fully logged days that make a week count towards the steady-logging streak */
const STEADY_WEEK_DAYS = 4;
import { EnergyEstimate, TargetSuggestion, burnRange, estimateEnergyFor, planFastDays, suggestTargets, weightTrend, DEFAULT_LOSS_RATE } from './energyModel';

/**
 * The numbers guidance is based on. Everything here is measured from the user's own logs, so the
 * advice never rests on made-up figures.
 */
export interface CoachFacts {
  today: string;
  /** Days with food logged, out of the last 14 and 28 (yesterday back) */
  loggedDays14: number;
  loggedDays28: number;
  /** Weeks in a row with at least STEADY_WEEK_DAYS fully logged days */
  steadyWeeks: number;
  /** Average calories on the days that were logged (last 28) */
  avgLoggedIntake: number | null;
  /** Average calorie target on those same days (nourish or fast) */
  avgLoggedTarget: number | null;
  weighIns14: number;
  weighIns28: number;
  /** Trend weight now, and its change over the last 14 and 56 days (null without data then) */
  trendNow: number | null;
  trendChange14: number | null;
  trendChange56: number | null;
  /** Change between the first weigh-in of the last 90 days and the latest one (at least four weeks apart) */
  longChange: { from: string; kg: number } | null;
  /** Latest scale reading and when */
  lastWeighIn: { date: string; weight: number } | null;
  goalWeight: number;
  nourishTarget: number;
  fastTarget: number;
  /** Fast days marked in the planner over the last 28 days */
  fastDays28: number;
  workoutCredit: number;
  /** Average workout calories a day over the last 28 days */
  avgWorkoutBurn: number;
  proteinTarget: number;
  /** Average protein on days it was tracked (last 14), and on how many days */
  avgProtein: number | null;
  proteinDays: number;
  /** Today so far */
  todayEaten: number;
  todayProtein: number;
  estimate: EnergyEstimate;
  suggestion: TargetSuggestion | null;
  weeklyLossGoal: number;
}

export const buildCoachFacts = (
  stats: UserStats,
  summaries: DailySummary[],
  dayTypes: Record<string, string>,
  todayLog: DailyLog,
  today = localDateString(),
): CoachFacts => {
  const yesterday = addDays(today, -1);
  const since = (days: number) => addDays(yesterday, -(days - 1));
  const inLast = (days: number) => summaries.filter(s => s.date >= since(days) && s.date <= yesterday);
  // Only fully logged days count; a day with just breakfast logged would read as a very low intake
  const isComplete = completeDayFor(stats, dayTypes);
  const logged = (list: DailySummary[]) => list.filter(isComplete);

  const logged28 = logged(inLast(28));
  const targetFor = (date: string) => (dayTypes[date] === 'fast' ? stats.dailyCalorieGoal : (stats.nonFastDayCalories || 2000));
  const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const history = (stats.weightHistory || []).filter(e => e.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
  const weighInsSince = (days: number) => history.filter(e => e.date >= since(days) && e.date <= today).length;

  // Trend change: compare the latest trend with the trend on the day N days earlier, within the same run
  const trend = weightTrend(history);
  const latest = trend[trend.length - 1];
  const trendChange = (days: number) => {
    if (!latest) return null;
    const from = trend.find(p => p.date === addDays(latest.date, -days) && p.run === latest.run);
    return from ? Math.round((latest.trend - from.trend) * 10) / 10 : null;
  };

  const protein14 = logged(inLast(14)).filter(s => typeof s.proteinConsumed === 'number');
  // The same estimate as the Analytics pace panel, so both show one burn
  const estimate = estimateEnergyFor(stats, summaries, dayTypes, today);

  // Weeks in a row (Monday to Sunday) with at least STEADY_WEEK_DAYS fully logged days, counting
  // back from last week; this week joins in once it has reached that too
  const completeDates = new Set(summaries.filter(isComplete).map(s => s.date));
  const weekLogged = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter(d => d <= yesterday && completeDates.has(d)).length;
  const thisMonday = weekStart(today);
  let steadyWeeks = weekLogged(thisMonday) >= STEADY_WEEK_DAYS ? 1 : 0;
  for (let monday = addDays(thisMonday, -7); weekLogged(monday) >= STEADY_WEEK_DAYS; monday = addDays(monday, -7)) steadyWeeks++;
  const weeklyLossGoal = stats.weeklyLossGoal ?? DEFAULT_LOSS_RATE;
  const last = history[history.length - 1];
  const first90 = history.find(e => e.date >= addDays(today, -90));
  const longChange = first90 && last && first90 !== last && addDays(first90.date, 28) <= last.date
    ? { from: first90.date, kg: Math.round((last.weight - first90.weight) * 10) / 10 }
    : null;

  return {
    today,
    loggedDays14: logged(inLast(14)).length,
    loggedDays28: logged28.length,
    steadyWeeks,
    avgLoggedIntake: average(logged28.map(s => s.caloriesConsumed)),
    avgLoggedTarget: average(logged28.map(s => targetFor(s.date))),
    weighIns14: weighInsSince(14),
    weighIns28: weighInsSince(28),
    trendNow: latest ? Math.round(latest.trend * 10) / 10 : null,
    trendChange14: trendChange(14),
    trendChange56: trendChange(56),
    longChange,
    lastWeighIn: last ? { date: last.date, weight: last.weight } : null,
    goalWeight: stats.goalWeight,
    nourishTarget: stats.nonFastDayCalories || 2000,
    fastTarget: stats.dailyCalorieGoal,
    fastDays28: Object.entries(dayTypes).filter(([d, t]) => t === 'fast' && d >= since(28) && d <= yesterday).length,
    workoutCredit: stats.workoutCalorieCredit ?? 1,
    avgWorkoutBurn: inLast(28).reduce((a, s) => a + (s.caloriesBurned || 0), 0) / 28,
    proteinTarget: proteinTarget(stats),
    avgProtein: average(protein14.map(s => s.proteinConsumed!)),
    proteinDays: protein14.length,
    todayEaten: (todayLog.items || []).reduce((a, i) => a + (i.calories || 0), 0),
    todayProtein: (todayLog.items || []).reduce((a, i) => a + (i.protein || 0), 0),
    estimate,
    suggestion: suggestTargets(estimate, stats, planFastDays(stats, estimate), weeklyLossGoal),
    weeklyLossGoal,
  };
};

/** Something the app can do for the user straight from a piece of guidance */
export type CoachAction =
  | { kind: 'setWorkoutCredit'; label: string; credit: 0.5 }
  | { kind: 'logFood'; label: string }
  | { kind: 'logWeight'; label: string }
  | { kind: 'openPlanner'; label: string }
  | { kind: 'openReminders'; label: string };

export interface Finding {
  id: string;
  /** good = keep going, focus = the thing most worth changing, tip = smaller gains */
  tone: 'good' | 'focus' | 'tip';
  title: string;
  detail: string;
  action?: CoachAction;
}

const kcal = (n: number) => `${(Math.round(n / 10) * 10).toLocaleString()} kcal`;
/** "1,910 kcal (likely 1,660–2,160)" */
const burn = (estimate: EnergyEstimate) => {
  const range = burnRange(estimate);
  return `${kcal(estimate.expenditure!)}${range ? ` (likely ${range[0].toLocaleString()}–${range[1].toLocaleString()})` : ''}`;
};
const shortDate = (date: string) => new Date(`${date}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
/** "Since 10 Aug you're down 2.8 kg", when the longer view shows real progress */
const longerView = (f: CoachFacts) => {
  if (f.trendChange56 !== null && f.trendChange56 < -0.5) return ` Over eight weeks your trend is down ${kg(f.trendChange56)}, so you're likely still moving.`;
  if (f.longChange && f.longChange.kg < -0.5) return ` Since ${shortDate(f.longChange.from)} you're down ${kg(f.longChange.kg)}, so you're likely still moving.`;
  return '';
};

const kg = (n: number) => `${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`;

/**
 * Guidance in order of how much it matters: first whether there's enough data to judge progress,
 * then the biggest lever (complete logging), then the smaller ones. Each piece says what it's based on.
 */
export const coachFindings = (f: CoachFacts): Finding[] => {
  const findings: Finding[] = [];
  const losing = f.trendChange14 !== null && f.trendChange14 <= -0.3;
  const flat = f.trendChange14 !== null && f.trendChange14 > -0.15;

  // 1. Progress, and whether there's enough data to call it
  if (f.weighIns14 < 3) {
    findings.push({
      id: 'weigh-ins',
      tone: 'focus',
      title: f.weighIns14 === 0 ? 'No weigh-ins in two weeks' : `Only ${f.weighIns14} weigh-in${f.weighIns14 === 1 ? '' : 's'} in two weeks`,
      detail: `Weight swings 1–2 kg day to day with water and salt, so a few readings can't show whether you're losing or stuck.${longerView(f)} Weighing in most mornings gives a trend you can trust within a week or two.`,
      action: { kind: 'openReminders', label: 'Set weigh-in reminders' },
    });
  } else if (losing) {
    const perWeek = -f.trendChange14! / 2;
    // The pace the targets give (on 5:2 it can be slower than the one chosen, or set by the fast days alone)
    const goal = f.suggestion ? Math.round(f.suggestion.expectedLoss * 20) / 20 : f.weeklyLossGoal;
    const onPace = goal <= 0 ? ''
      : perWeek >= goal * 1.1 ? ` That's ahead of your ${kg(goal)} a week pace.`
      : perWeek >= goal * 0.9 ? ` That's right on your ${kg(goal)} a week pace.`
      : '';
    const toGo = f.goalWeight > 0 && f.trendNow !== null && f.trendNow > f.goalWeight ? f.trendNow - f.goalWeight : 0;
    const weeksToGo = toGo > 0 ? Math.ceil(toGo / perWeek) : 0;
    const sinceStart = f.longChange && f.longChange.kg < -0.5 ? ` Since ${shortDate(f.longChange.from)} you're down ${kg(f.longChange.kg)}.` : '';
    findings.push({
      id: 'progress',
      tone: 'good',
      title: `Good job: you're losing ${kg(perWeek)} a week`,
      detail: `Your trend is down ${kg(f.trendChange14!)} in two weeks.${onPace}${sinceStart}`
        + (toGo > 0
          ? ` ${kg(toGo)} to your goal${weeksToGo <= 104 ? `, about ${weeksToGo} week${weeksToGo === 1 ? '' : 's'} at this pace` : ''}.`
          : f.goalWeight > 0 ? ' You\'ve reached your goal weight.' : '')
        + ' Keep doing what you\'re doing.',
    });
  } else if (flat && f.loggedDays14 >= 10 && f.suggestion) {
    findings.push({
      id: 'plateau',
      tone: 'focus',
      title: 'A real plateau: flat for two weeks on complete logs',
      detail: `You've fully logged most days and the trend hasn't moved, so your current intake is close to what you burn (about ${burn(f.estimate)} a day). Nourish days at ${kcal(f.suggestion.nourish)} would get you back to about ${kg(Math.round(f.suggestion.expectedLoss * 20) / 20)} a week, and Sunday's check-in moves your target towards it, at most 150 kcal a week.`,
    });
  } else if (flat) {
    findings.push({
      id: 'stall',
      tone: 'tip',
      title: 'Your trend has flattened',
      detail: `Your trend moved ${f.trendChange14! > 0 ? '+' : '−'}${kg(f.trendChange14!)} in two weeks.${longerView(f)} The points below are the likely reasons, most important first.`,
    });
  }

  // 2. Logging: the biggest lever, and what the logged days say. Most days is enough.
  const streak = f.steadyWeeks >= 2 ? `${f.steadyWeeks} weeks in a row of steady logging. ` : '';
  const unlock = f.estimate.ready ? '' : ` It also unlocks your personal target, which needs 14 fully logged days in four weeks (you have ${f.estimate.loggedDays}).`;
  if (f.loggedDays14 < LOGGING_LOW) {
    const underTarget = f.avgLoggedIntake !== null && f.avgLoggedTarget !== null && f.avgLoggedIntake < f.avgLoggedTarget * 0.85;
    findings.push({
      id: 'logging',
      tone: 'focus',
      title: `Food logged on ${f.loggedDays14} of the last 14 days`,
      detail: (underTarget && !losing
        ? `On the days you logged you averaged ${kcal(f.avgLoggedIntake!)}, under your target. If that were every day you'd be losing steadily, so the extra calories are most likely on unlogged days (often weekends and evenings) or in things that slip through: cooking oil, drinks, tastes. `
        : 'Unlogged days are where calories usually hide, and they make it hard to tell what\'s working. ')
        + `You don't need every day: logging most days, about ${LOGGING_GOOD} of 14, is enough.${unlock}`,
      action: { kind: 'logFood', label: 'Log food' },
    });
  } else if (f.loggedDays14 < LOGGING_GOOD) {
    findings.push({
      id: 'logging-most',
      tone: 'tip',
      title: `${f.loggedDays14} of 14 days logged, nearly there`,
      detail: `${streak}Most days is enough: about ${LOGGING_GOOD} of 14 makes your averages and trend reliable. The days from Thursday to Sunday are the ones most people skip.${unlock}`,
      action: { kind: 'logFood', label: 'Log food' },
    });
  } else {
    findings.push({
      id: 'logging-good',
      tone: 'good',
      title: `Logged ${f.loggedDays14} of the last 14 days`,
      detail: `${streak}That's enough for everything here to be reliable. Remember drinks and cooking fat.`,
    });
  }

  // A better target needs no finding of its own: Sunday's check-in applies it (utils/checkIn.ts)

  // 3. Workout calories eaten back
  if (f.workoutCredit === 1 && f.avgWorkoutBurn >= 100) {
    findings.push({
      id: 'workout-credit',
      tone: 'tip',
      title: 'Workout calories may be overestimated',
      detail: `Workouts add about ${kcal(f.avgWorkoutBurn)} a day to your budget on average. Watches and machines often overestimate burn, so eating all of it back can cancel much of your deficit. Counting half is a safer middle ground.`,
      action: { kind: 'setWorkoutCredit', label: 'Count half', credit: 0.5 },
    });
  }

  // 4. Fast days: how many were actually planned
  if (f.fastDays28 > 0 && f.fastDays28 < 6) {
    const gap = f.nourishTarget - f.fastTarget;
    findings.push({
      id: 'fast-days',
      tone: 'tip',
      title: `${f.fastDays28} fast day${f.fastDays28 === 1 ? '' : 's'} in four weeks`,
      detail: `That's about ${(f.fastDays28 / 4).toLocaleString(undefined, { maximumFractionDigits: 1 })} a week. If you're aiming for two, each one skipped adds about ${kcal(gap)} to your week. If you fast without marking the day in the planner, mark it so your targets match.`,
      action: { kind: 'openPlanner', label: 'Plan fast days' },
    });
  }

  // 5. Protein
  if (f.avgProtein !== null && f.proteinDays >= 3 && f.avgProtein < f.proteinTarget * 0.8) {
    findings.push({
      id: 'protein',
      tone: 'tip',
      title: `Protein averages ${Math.round(f.avgProtein)} g of ${f.proteinTarget} g`,
      detail: 'More protein keeps you fuller on the same calories and protects muscle while you lose. Easy wins: kesella or Greek yoghurt, eggs, chicken, lentils, tuna.',
    });
  }

  // 6. Losing faster than is comfortable to sustain
  if (f.trendChange14 !== null && f.trendNow !== null && f.trendChange14 < -(f.trendNow * 0.02)) {
    findings.push({
      id: 'too-fast',
      tone: 'tip',
      title: 'You\'re losing quickly',
      detail: `${kg(f.trendChange14)} in two weeks is more than 1% of your weight a week. Early weeks often include water, but if it continues, eating a little more makes it easier to keep going.`,
    });
  }

  // Progress leads, so the news about how it's going comes before what to change
  const order = { focus: 0, good: 1, tip: 2 };
  const rank = (x: Finding) => (x.id === 'progress' ? -1 : order[x.tone]);
  return findings.sort((a, b) => rank(a) - rank(b));
};

/** A read tip comes back after this long if it still applies, so a lasting problem isn't hidden for good */
export const COACH_READ_DAYS = 30;

export const isFindingRead = (read: CoachReadState, id: string, today = localDateString()) =>
  !!read[id] && read[id] > addDays(today, -COACH_READ_DAYS);
