import { describe, expect, it } from 'vitest';
import { DailyProgress, UserStats } from '../types';
import { updateStreak } from './achievementService';

const TODAY = '2026-10-25';

const progress = (success: boolean): DailyProgress => ({
  calories: { current: 1500, target: 2000, status: success ? 'perfect' : 'over' },
  water: { current: success ? 2500 : 0, target: 2500, isMet: success },
  fasting: { hours: success ? 16 : 0, target: 16, isMet: success },
  isPerfectDay: success,
});

const statsKeptOn = (lastLogDate: string): UserStats => {
  const streak = { current: 5, best: 5, lastLogDate };
  return {
    startWeight: 90, currentWeight: 90, goalWeight: 80, dailyCalorieGoal: 2000, dailyWaterGoal: 2500, weightHistory: [],
    streaks: { currentStreak: 5, bestStreak: 5, lastLogDate, perfectDaysCount: 5, calories: { ...streak }, water: { ...streak }, fasting: { ...streak } },
  } as UserStats;
};

describe('updateStreak', () => {
  it('breaks a streak after a missed day', () => {
    const next = updateStreak(statsKeptOn('2026-10-22'), progress(false), TODAY);
    expect(next.streaks!.currentStreak).toBe(0);
    expect(next.streaks!.water!.current).toBe(0);
  });

  it('keeps a streak across days marked unwell, without counting them', () => {
    const unwell = new Set(['2026-10-23', '2026-10-24']);
    const paused = updateStreak(statsKeptOn('2026-10-22'), progress(false), TODAY, unwell);
    expect(paused.streaks!.currentStreak).toBe(5);
    expect(paused.streaks!.water!.current).toBe(5);
    const resumed = updateStreak(statsKeptOn('2026-10-22'), progress(true), TODAY, unwell);
    expect(resumed.streaks!.currentStreak).toBe(6);
  });

  it('still breaks when a day in the gap was not unwell', () => {
    const next = updateStreak(statsKeptOn('2026-10-21'), progress(false), TODAY, new Set(['2026-10-23', '2026-10-24']));
    expect(next.streaks!.currentStreak).toBe(0);
  });
});
