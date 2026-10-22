import { describe, expect, it } from 'vitest';
import { EnergyEstimate } from '../utils/energyModel';
import { rangeAdvice, stillNeeded } from './EnergyCheckIn';

const estimate = (loggedDays: number, weighIns: number, weighSpanDays: number): EnergyEstimate => ({
  from: '2026-09-19', to: '2026-10-16', loggedDays, weighIns, weighSpanDays, ready: false,
  avgIntake: null, fastAvgIntake: null, nourishAvgIntake: null, fastDays: 0, weightChangePerWeek: null, expenditure: null, expenditureMargin: null, weightMargin: null, intakeMargin: null, avgWorkoutBurn: 0,
});

describe('stillNeeded', () => {
  it('says how many logged days are missing', () => {
    expect(stillNeeded(estimate(10, 12, 20))).toBe('4 more fully logged days');
    expect(stillNeeded(estimate(13, 12, 20))).toBe('1 more fully logged day');
  });

  it('adds missing weigh-ins', () => {
    expect(stillNeeded(estimate(10, 11, 20))).toBe('4 more fully logged days and 1 more weigh-in');
    expect(stillNeeded(estimate(14, 4, 20))).toBe('8 more weigh-ins');
  });

  it('asks for weigh-ins spread over two weeks once there are enough of them', () => {
    expect(stillNeeded(estimate(14, 12, 6))).toBe('weigh-ins spread over two weeks');
  });
});

describe('rangeAdvice', () => {
  const ready = { ...estimate(20, 12, 27), ready: true, expenditure: 1900, expenditureMargin: 500 };

  it('names the weigh-ins and how narrow daily ones would make it', () => {
    expect(rangeAdvice({ ...ready, weightMargin: 480, intakeMargin: 140 })).toMatch(/^The range is mostly down to the weigh-ins \(12 days in four weeks\)\. Weighing in every day would narrow it to about ±\d{3}\.$/);
  });

  it('names logging when that is the bigger part', () => {
    expect(rangeAdvice({ ...ready, weightMargin: 200, intakeMargin: 450 })).toMatch(/with 20 of 28 counted\. Logging every day fully would narrow it/);
  });

  it('says so when the range is already as narrow as it gets', () => {
    expect(rangeAdvice({ ...ready, expenditureMargin: 250, weightMargin: 150, intakeMargin: 100 })).toBe('That range is as narrow as this kind of estimate gets.');
  });
});
