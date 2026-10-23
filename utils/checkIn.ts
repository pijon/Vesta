import { WeeklyCheckIn } from '../types';
import { parseLocalDate } from './dateUtils';
import { addDays } from './planUtils';
import { EnergyEstimate, MIN_NOURISH_TARGET, TargetSuggestion } from './energyModel';

/** The first Sunday with a check-in; earlier Sundays (before the feature) are never run late */
export const FIRST_CHECK_IN = '2026-10-25';
/** The target moves at most this much in one week, so one odd week can't swing it far */
export const MAX_WEEKLY_STEP = 150;
/** A smaller gap between the target and what the pace calls for isn't worth a change */
export const MIN_WEEKLY_CHANGE = 50;

/** The Sunday a check-in run today belongs to: today on a Sunday, otherwise the one before */
export const checkInDateFor = (today: string) => addDays(today, -parseLocalDate(today).getDay());

const round10 = (n: number) => Math.round(n / 10) * 10;

/**
 * Sunday's check-in. While the burn stays inside last week's likely range it's taken as unchanged, so
 * the target doesn't follow noise; once it moves outside, the new burn is used. The target then moves
 * towards what the chosen pace calls for, by at most MAX_WEEKLY_STEP, and only when that's at least
 * MIN_WEEKLY_CHANGE away. There's no catch-up: a slower week doesn't cut deeper the next.
 */
export const weeklyCheckIn = (
  estimate: Pick<EnergyEstimate, 'expenditure' | 'expenditureMargin' | 'weightChangePerWeek' | 'loggedDays' | 'weighIns'>,
  suggestion: Pick<TargetSuggestion, 'nourish' | 'fastDaysPerWeek' | 'limited' | 'expectedLoss'> | null,
  currentTarget: number,
  last: Pick<WeeklyCheckIn, 'burnUsed' | 'margin'> | null,
  date: string,
  weeklyLoss: number,
  now = Date.now(),
): WeeklyCheckIn => {
  const base = {
    date,
    previousTarget: currentTarget,
    expenditure: estimate.expenditure,
    margin: estimate.expenditureMargin,
    weightChangePerWeek: estimate.weightChangePerWeek,
    loggedDays: estimate.loggedDays,
    weighIns: estimate.weighIns,
    // The pace the targets give, which on 5:2 can be slower than asked (see suggestTargets' `limited`)
    weeklyLoss: suggestion ? Math.round(suggestion.expectedLoss * 20) / 20 : weeklyLoss,
    createdAt: now,
  };
  if (estimate.expenditure === null || !suggestion) {
    return { ...base, status: 'held', target: currentTarget, burnUsed: last?.burnUsed ?? null, suggested: null };
  }

  const steady = last?.burnUsed != null && last.margin != null && Math.abs(estimate.expenditure - last.burnUsed) <= last.margin;
  const burnUsed = steady ? last!.burnUsed! : estimate.expenditure;
  // The nourish target moves 7 / (nourish days) kcal for each kcal of burn, as suggestTargets spreads it;
  // held at its 5:2 limit under the burn, it moves one for one
  const perKcal = suggestion.limited ? 1 : 7 / (7 - suggestion.fastDaysPerWeek);
  const suggested = Math.max(MIN_NOURISH_TARGET, round10(suggestion.nourish - (estimate.expenditure - burnUsed) * perKcal));

  const gap = suggested - currentTarget;
  if (Math.abs(gap) < MIN_WEEKLY_CHANGE) return { ...base, status: 'kept', target: currentTarget, burnUsed, suggested };
  const target = Math.max(MIN_NOURISH_TARGET, round10(currentTarget + Math.sign(gap) * Math.min(Math.abs(gap), MAX_WEEKLY_STEP)));
  return { ...base, status: target === currentTarget ? 'kept' : 'changed', target, burnUsed, suggested };
};
