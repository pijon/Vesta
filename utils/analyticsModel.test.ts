import { describe, expect, it } from 'vitest';
import { AnalyticsDay, chartStart, goalDateAtPace, summarize, weightProgress } from './analyticsModel';
import { addDays } from './planUtils';

const TODAY = '2026-10-14';

/** A day in the period; logged days count as fully logged */
const day = (date: string, calories: number, opts: Partial<AnalyticsDay> = {}): AnalyticsDay => {
  const calorieTarget = opts.isFastDay ? 1000 : 1800;
  return {
    date, time: 0, isFastDay: false, logged: calories > 0, complete: calories > 0, calories, protein: null,
    calorieTarget, burned: 0, workouts: 0, water: 0, fastHours: null,
    goals: { calories: calories > 0 && calories <= calorieTarget, water: false, movement: false },
    ...opts,
  };
};

/** `n` days ending today, logged where `logged(i)` says so */
const period = (n: number, logged: (i: number) => boolean) =>
  Array.from({ length: n }, (_, i) => day(addDays(TODAY, i - n + 1), logged(i) ? 1500 : 0));

describe('summarize', () => {
  it('counts nourish days on target and fast days kept separately', () => {
    const s = summarize([
      day('2026-10-01', 1700),
      day('2026-10-02', 2100),
      day('2026-10-03', 900, { isFastDay: true }),
      day('2026-10-04', 1300, { isFastDay: true }),
      day('2026-10-05', 0, { isFastDay: true }),
    ], 16);
    expect(s).toMatchObject({ nourishLogged: 2, nourishOnTarget: 1, fastDaysLogged: 2, fastDaysKept: 1 });
  });
});

describe('chartStart', () => {
  it('skips a stray early day before a long break', () => {
    // Day 0 logged, then nothing until day 40, then most days
    const days = period(90, i => i === 0 || i >= 40);
    expect(chartStart(days)).toBe(40);
  });

  it('starts at the first active day when there is no long break', () => {
    const days = period(30, i => i >= 5 && i % 3 === 0);
    expect(chartStart(days)).toBe(6);
  });

  it('keeps at least two weeks on the chart', () => {
    const days = period(90, i => i === 0 || i >= 85);
    expect(chartStart(days)).toBe(76);
  });

  it('starts at the beginning when nothing is logged', () => {
    expect(chartStart(period(30, () => false))).toBe(0);
  });
});

describe('weightProgress', () => {
  // Weigh-ins every other day for six weeks, losing 0.5 kg a week from 92 kg
  const history = Array.from({ length: 22 }, (_, i) => ({ date: addDays(TODAY, -42 + i * 2), weight: 92 - (0.5 / 7) * i * 2 }));

  it('reads the trend, its pace and what is left to the goal', () => {
    const p = weightProgress(history, 80, TODAY)!;
    expect(p.since).toBe(addDays(TODAY, -42));
    expect(p.change).toBeLessThan(-2);
    expect(p.ratePerWeek).toBeCloseTo(-0.5, 1);
    expect(p.toGoal).toBeCloseTo(p.current - 80, 5);
    expect(p.projection).not.toBeNull();
    expect(p.line.length).toBeGreaterThan(30);
  });

  it('has no pace or goal without enough weigh-ins or a goal', () => {
    const p = weightProgress(history.slice(-2), 0, TODAY)!;
    expect(p.ratePerWeek).toBeNull();
    expect(p.toGoal).toBeNull();
  });

  it('is null with no weigh-ins', () => {
    expect(weightProgress([], 80, TODAY)).toBeNull();
  });
});

describe('goalDateAtPace', () => {
  it('counts the weeks to the goal at the chosen pace', () => {
    // 10 kg at 0.5 kg a week is 20 weeks
    expect(goalDateAtPace(90, 80, 0.5, TODAY)).toBe(addDays(TODAY, 140));
  });

  it('works when the goal is to gain', () => {
    expect(goalDateAtPace(60, 62, 0.25, TODAY)).toBe(addDays(TODAY, 56));
  });

  it('has no date at the goal, without one, or without a pace', () => {
    expect(goalDateAtPace(80, 80, 0.5, TODAY)).toBeNull();
    expect(goalDateAtPace(90, 0, 0.5, TODAY)).toBeNull();
    expect(goalDateAtPace(90, 80, 0, TODAY)).toBeNull();
  });
});
