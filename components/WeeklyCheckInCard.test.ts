import { describe, expect, it } from 'vitest';
import { WeeklyCheckIn } from '../types';
import { checkInText } from './WeeklyCheckInCard';

const checkIn = (fields: Partial<WeeklyCheckIn>): WeeklyCheckIn => ({
  date: '2026-10-25', status: 'changed', previousTarget: 2100, target: 1950, expenditure: 2300, margin: 250, burnUsed: 2300,
  suggested: 1950, weeklyLoss: 0.5, weightChangePerWeek: -0.4, loggedDays: 20, weighIns: 20, createdAt: 1, ...fields,
});

describe('checkInText', () => {
  it('says what changed and why', () => {
    expect(checkInText(checkIn({}))).toEqual({
      title: 'Nourish days now 1,950 kcal',
      detail: 'Down from 2,100 kcal. You burn about 2,300 kcal (likely 2,050–2,550 kcal), so this aims for 0.5 kg a week.',
    });
  });

  it('mentions the weekly limit when the pace asks for more', () => {
    expect(checkInText(checkIn({ suggested: 1750 })).detail).toMatch(/Your pace calls for 1,750 kcal; it moves at most 150 kcal a week to get there\.$/);
  });

  it('says when the target stays and when there was too little data', () => {
    expect(checkInText(checkIn({ status: 'kept', target: 2100 })).title).toBe('Staying at 2,100 kcal');
    expect(checkInText(checkIn({ status: 'held', target: 2100, expenditure: null, margin: null, loggedDays: 9, weighIns: 5 }))).toEqual({
      title: 'Target held at 2,100 kcal',
      detail: 'Not enough data to judge this week: 9 of 14 fully logged days and 5 of 12 weigh-in days in the last four weeks.',
    });
  });
});
