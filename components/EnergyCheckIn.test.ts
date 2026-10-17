import { describe, expect, it } from 'vitest';
import { EnergyEstimate } from '../utils/energyModel';
import { stillNeeded } from './EnergyCheckIn';

const estimate = (loggedDays: number, weighIns: number, weighSpanDays: number): EnergyEstimate => ({
  from: '2026-09-19', to: '2026-10-16', loggedDays, weighIns, weighSpanDays, ready: false,
  avgIntake: null, weightChangePerWeek: null, expenditure: null, avgWorkoutBurn: 0,
});

describe('stillNeeded', () => {
  it('says how many logged days are missing', () => {
    expect(stillNeeded(estimate(10, 4, 20))).toBe('4 more fully logged days');
    expect(stillNeeded(estimate(13, 4, 20))).toBe('1 more fully logged day');
  });

  it('adds missing weigh-ins', () => {
    expect(stillNeeded(estimate(10, 3, 20))).toBe('4 more fully logged days and 1 more weigh-in');
  });

  it('asks for weigh-ins spread over two weeks once there are enough of them', () => {
    expect(stillNeeded(estimate(14, 4, 6))).toBe('weigh-ins spread over two weeks');
  });
});
