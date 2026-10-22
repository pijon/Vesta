import { describe, expect, it } from 'vitest';
import { DailySummary } from '../types';
import { addDays } from './planUtils';
import { completeDayFor, ENERGY_COMPLETE_DAY_SHARE, isCompleteDay, looksLight, usualIntake } from './logCompleteness';

describe('isCompleteDay', () => {
  it('counts a day from 40% of its target', () => {
    expect(isCompleteDay(800, 2000)).toBe(true);
    expect(isCompleteDay(799, 2000)).toBe(false);
    expect(isCompleteDay(0, 0)).toBe(false);
  });

  it("lets the user's own mark win either way", () => {
    expect(isCompleteDay(0, 2000, 'complete')).toBe(true);
    expect(isCompleteDay(3000, 2000, 'incomplete')).toBe(false);
  });
});

describe('completeDayFor', () => {
  const isComplete = completeDayFor({ dailyCalorieGoal: 800, nonFastDayCalories: 2000 }, { '2026-10-13': 'fast' });

  it("uses each day's own target", () => {
    expect(isComplete({ date: '2026-10-13', caloriesConsumed: 400 })).toBe(true); // fast day: 40% of 800
    expect(isComplete({ date: '2026-10-14', caloriesConsumed: 400 })).toBe(false); // nourish day: 40% of 2000
  });

  it('can take a stricter share, as the burn estimate does', () => {
    const strict = completeDayFor({ dailyCalorieGoal: 800, nonFastDayCalories: 2000 }, {}, ENERGY_COMPLETE_DAY_SHARE);
    expect(strict({ date: '2026-10-14', caloriesConsumed: 1000 })).toBe(false); // 50% of 2000
    expect(strict({ date: '2026-10-14', caloriesConsumed: 1200 })).toBe(true); // 60%
    expect(strict({ date: '2026-10-14', caloriesConsumed: 1000, status: 'complete' })).toBe(true);
  });
});

describe('usualIntake', () => {
  const TODAY = '2026-10-22';
  const stats = { dailyCalorieGoal: 800, nonFastDayCalories: 2000 };
  const day = (back: number, caloriesConsumed: number): DailySummary => ({
    date: addDays(TODAY, -back), caloriesConsumed, caloriesBurned: 0, netCalories: caloriesConsumed,
    workoutCount: 0, workoutTypes: [], waterIntake: 0, maxFastingHours: 0,
  });
  const fastDays = { [addDays(TODAY, -2)]: 'fast', [addDays(TODAY, -5)]: 'fast' };

  it('is the median of fully logged days of the same kind in the last four weeks', () => {
    const days = [day(1, 1900), day(3, 2100), day(4, 2300), day(6, 2000), day(7, 2200), day(2, 700), day(5, 600)];
    expect(usualIntake(days, fastDays, stats, false, TODAY)).toBe(2100);
    expect(usualIntake(days, fastDays, stats, true, TODAY)).toBeNull(); // only two fast days
  });

  it('leaves out today, older days and days not fully logged', () => {
    const days = [day(0, 5000), day(40, 5000), day(8, 500), day(1, 1900), day(3, 2100), day(4, 2300), day(6, 2000), day(7, 2200)];
    expect(usualIntake(days, {}, stats, false, TODAY)).toBe(2100);
  });

  it('needs five days', () => {
    expect(usualIntake([day(1, 1900), day(3, 2100), day(4, 2300), day(6, 2000)], {}, stats, false, TODAY)).toBeNull();
  });
});

describe('looksLight', () => {
  it('flags a day under 70% of your usual, unless you have already said', () => {
    expect(looksLight(1400, 2100, undefined)).toBe(true);
    expect(looksLight(1500, 2100, undefined)).toBe(false);
    expect(looksLight(1400, 2100, 'complete')).toBe(false);
    expect(looksLight(1400, null, undefined)).toBe(false);
    expect(looksLight(0, 2100, undefined)).toBe(false);
  });
});
