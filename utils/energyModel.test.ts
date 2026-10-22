import { describe, expect, it } from 'vitest';
import { DailySummary, WeightEntry } from '../types';
import { addDays } from './planUtils';
import { burnRange, estimateEnergy, estimateEnergyFor, fastDaysPerWeek, MIN_BURN_MARGIN, MIN_NOURISH_TARGET, suggestTargets, weightTrend } from './energyModel';

const TODAY = '2026-10-14';

const summary = (date: string, caloriesConsumed: number, caloriesBurned = 0): DailySummary => ({
  date, caloriesConsumed, caloriesBurned, netCalories: caloriesConsumed - caloriesBurned,
  workoutCount: caloriesBurned ? 1 : 0, workoutTypes: [], waterIntake: 0, maxFastingHours: 0,
});

/** The 28 days of the estimate window (up to yesterday), oldest first */
const windowDays = Array.from({ length: 28 }, (_, i) => addDays(TODAY, i - 28));

/** Weigh-ins every `every` days over the window, losing `perWeek` kg a week from `start` */
const weighIns = (start: number, perWeek: number, every = 2): WeightEntry[] =>
  windowDays.filter((_, i) => i % every === 0).map(date => ({ date, weight: start + (perWeek / 7) * windowDays.indexOf(date) }));

describe('weightTrend', () => {
  it('fills the days between weigh-ins and smooths towards the scale', () => {
    const points = weightTrend([{ date: '2026-10-01', weight: 90 }, { date: '2026-10-05', weight: 88 }]);
    expect(points.map(p => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    expect(points.map(p => p.scale)).toEqual([90, null, null, null, 88]);
    expect(points[4].trend).toBeLessThan(90);
    expect(points[4].trend).toBeGreaterThan(88); // lags behind the scale
  });

  it('averages several weigh-ins on a day and skips zero readings', () => {
    const [point] = weightTrend([{ date: '2026-10-01', weight: 90 }, { date: '2026-10-01', weight: 91 }, { date: '2026-10-02', weight: 0 }]);
    expect(point.scale).toBe(90.5);
  });

  it('starts a new run after a break of more than three weeks', () => {
    const points = weightTrend([{ date: '2026-08-01', weight: 95 }, { date: '2026-10-01', weight: 90 }]);
    expect(points).toHaveLength(2);
    expect(points[1]).toMatchObject({ run: 1, trend: 90 });
  });
});

describe('estimateEnergy', () => {
  it('estimates burn as intake minus the energy in the weight lost', () => {
    const est = estimateEnergy(windowDays.map(d => summary(d, 1800)), weighIns(92, -0.5), TODAY);
    expect(est).toMatchObject({ from: windowDays[0], to: addDays(TODAY, -1), loggedDays: 28, ready: true, avgIntake: 1800 });
    expect(est.weightChangePerWeek).toBeCloseTo(-0.5, 5);
    expect(est.expenditure).toBeCloseTo(1800 + 550, 5); // 0.5 kg/week × 7,700 kcal ÷ 7 days
  });

  it('ignores today and days outside the window', () => {
    const est = estimateEnergy([summary(TODAY, 5000), summary(addDays(TODAY, -40), 5000), ...windowDays.map(d => summary(d, 1800))], weighIns(92, -0.5), TODAY);
    expect(est.avgIntake).toBe(1800);
  });

  it('counts only complete days towards intake', () => {
    const days = windowDays.map((d, i) => summary(d, i % 2 ? 300 : 2000));
    const est = estimateEnergy(days, weighIns(92, -0.5), TODAY, s => s.caloriesConsumed >= 800);
    expect(est).toMatchObject({ loggedDays: 14, avgIntake: 2000 });
  });

  it('weights fast and nourish days by how many of each the window held', () => {
    // 8 fast days (a 5:2 pattern) at 600 and 20 nourish days at 2,100; the fast days are logged every time,
    // the nourish days only on 14 of 20, so a plain average of logged days would over-weight the fast days
    const fast = new Set(windowDays.filter((_, i) => i % 7 === 2 || i % 7 === 5 || i === 27 || i === 26));
    const dayTypes = Object.fromEntries([...fast].map(d => [d, 'fast']));
    const nourish = windowDays.filter(d => !fast.has(d));
    const days = [...fast].map(d => summary(d, 600)).concat(nourish.slice(0, 14).map(d => summary(d, 2100)));
    const plain = estimateEnergy(days, weighIns(92, 0), TODAY);
    const weighted = estimateEnergy(days, weighIns(92, 0), TODAY, undefined, dayTypes);
    expect(weighted).toMatchObject({ fastDays: fast.size, fastAvgIntake: 600, nourishAvgIntake: 2100 });
    expect(weighted.avgIntake).toBeCloseTo((600 * fast.size + 2100 * (28 - fast.size)) / 28, 5);
    expect(weighted.avgIntake!).toBeGreaterThan(plain.avgIntake!);
  });

  it('falls back to the plain average without fast days or when one kind was never logged', () => {
    const days = windowDays.map(d => summary(d, 1800));
    expect(estimateEnergy(days, weighIns(92, 0), TODAY, undefined, {})).toMatchObject({ avgIntake: 1800, fastAvgIntake: null });
    const noFastDayLogged = estimateEnergy(days.slice(0, 14), weighIns(92, 0), TODAY, undefined, { [windowDays[20]]: 'fast' });
    expect(noFastDayLogged).toMatchObject({ avgIntake: 1800, fastAvgIntake: null, nourishAvgIntake: null });
  });

  it('waits for a few logged days of each kind before averaging them apart', () => {
    const fast = windowDays.filter((_, i) => i % 7 === 2 || i % 7 === 5);
    const dayTypes = Object.fromEntries(fast.map(d => [d, 'fast']));
    const nourish = windowDays.filter(d => !fast.includes(d)).map(d => summary(d, 2100));
    const twoFast = estimateEnergy([...nourish, ...fast.slice(0, 2).map(d => summary(d, 600))], weighIns(92, 0), TODAY, undefined, dayTypes);
    expect(twoFast.fastAvgIntake).toBeNull();
    const threeFast = estimateEnergy([...nourish, ...fast.slice(0, 3).map(d => summary(d, 600))], weighIns(92, 0), TODAY, undefined, dayTypes);
    expect(threeFast.fastAvgIntake).toBe(600);
  });

  it('counts several weigh-ins on one day once', () => {
    const doubled = weighIns(92, -0.5, 3).flatMap(e => [e, { ...e, weight: e.weight + 0.2 }]);
    const est = estimateEnergy(windowDays.map(d => summary(d, 1800)), doubled, TODAY);
    expect(est).toMatchObject({ weighIns: 10, ready: false });
    expect(est.weightChangePerWeek).toBeCloseTo(-0.5, 5);
  });

  it('gives a likely range that widens with noisy weigh-ins and never narrows below the floor', () => {
    const days = windowDays.map((d, i) => summary(d, i % 2 ? 1700 : 1900));
    const steady = estimateEnergy(days, weighIns(92, -0.5), TODAY);
    expect(steady.expenditureMargin).toBe(MIN_BURN_MARGIN);
    expect(burnRange(steady)).toEqual([Math.round((steady.expenditure! - 250) / 10) * 10, Math.round((steady.expenditure! + 250) / 10) * 10]);
    // ±0.8 kg of day-to-day water swing around the same line
    const noisy = weighIns(92, -0.5).map((e, i) => ({ ...e, weight: e.weight + (i % 2 ? 0.8 : -0.8) }));
    const est = estimateEnergy(days, noisy, TODAY);
    expect(est.expenditureMargin!).toBeGreaterThan(MIN_BURN_MARGIN);
    expect(burnRange({ expenditure: null, expenditureMargin: null })).toBeNull();
  });

  it('waits for enough logging and weigh-ins', () => {
    const fewLogs = estimateEnergy(windowDays.slice(0, 13).map(d => summary(d, 1800)), weighIns(92, -0.5), TODAY);
    expect(fewLogs).toMatchObject({ ready: false, expenditure: null });
    const fewWeighIns = estimateEnergy(windowDays.map(d => summary(d, 1800)), weighIns(92, -0.5, 10), TODAY);
    expect(fewWeighIns).toMatchObject({ weighIns: 3, ready: false, expenditure: null });
    const elevenWeighIns = estimateEnergy(windowDays.map(d => summary(d, 1800)), weighIns(92, -0.5).slice(0, 11), TODAY);
    expect(elevenWeighIns).toMatchObject({ weighIns: 11, ready: false, expenditure: null });
  });
});

describe('estimateEnergyFor', () => {
  it('leaves out days under 60% of their target and averages fast days apart', () => {
    const stats = { dailyCalorieGoal: 800, nonFastDayCalories: 2000, weightHistory: weighIns(92, 0) };
    const fast = windowDays.filter((_, i) => i % 7 === 2 || i % 7 === 5);
    const dayTypes = Object.fromEntries(fast.map(d => [d, 'fast']));
    const days = windowDays.map(d => (fast.includes(d) ? summary(d, 500) : summary(d, 2100)));
    days[0] = summary(windowDays[0], 1000); // nourish day at 50%: counts in averages, not the burn
    const est = estimateEnergyFor(stats, days, dayTypes, TODAY);
    expect(est).toMatchObject({ loggedDays: 27, fastAvgIntake: 500, nourishAvgIntake: 2100 });
  });
});

describe('suggestTargets', () => {
  const estimate = { ...estimateEnergy([], [], TODAY), expenditure: 2500, avgWorkoutBurn: 0 };
  const stats = { dailyCalorieGoal: 800, currentWeight: 90 };

  it('gives the nourish target that loses the chosen amount a week', () => {
    // 0.5 kg/week = 550 kcal/day below 2,500, with no fast days
    expect(suggestTargets(estimate, stats, 0, 0.5)).toMatchObject({ nourish: 1950, fast: 800, capped: false, floored: false });
  });

  it('spreads fast days across the week', () => {
    // (1950 × 7 − 2 × 800) / 5 = 2410
    expect(suggestTargets(estimate, stats, 2, 0.5)?.nourish).toBe(2410);
  });

  it('takes credited workout calories off first, so they are not counted twice', () => {
    const withWorkouts = { ...estimate, avgWorkoutBurn: 200 };
    expect(suggestTargets(withWorkouts, stats, 0, 0.5)?.nourish).toBe(1750);
    expect(suggestTargets(withWorkouts, { ...stats, workoutCalorieCredit: 0 }, 0, 0.5)?.nourish).toBe(1950);
  });

  it('caps the rate at 1% of body weight a week and never goes below the floor', () => {
    expect(suggestTargets(estimate, { ...stats, currentWeight: 60 }, 0, 1)).toMatchObject({ weeklyLoss: 0.6, capped: true });
    expect(suggestTargets({ ...estimate, expenditure: 1500 }, stats, 0, 1)).toMatchObject({ nourish: MIN_NOURISH_TARGET, floored: true });
  });

  it('gives nothing until there is an estimate', () => {
    expect(suggestTargets({ ...estimate, expenditure: null }, stats, 0, 0.5)).toBeNull();
  });
});

describe('fastDaysPerWeek', () => {
  it('counts fast days in the window, per week', () => {
    const types = Object.fromEntries([...windowDays.filter((_, i) => i % 7 < 2).map(d => [d, 'fast']), [TODAY, 'fast']]);
    expect(fastDaysPerWeek(types, { from: windowDays[0], to: windowDays[27] })).toBe(2);
  });
});
