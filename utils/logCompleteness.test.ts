import { describe, expect, it } from 'vitest';
import { completeDayFor, isCompleteDay } from './logCompleteness';

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
});
