import { describe, expect, it } from 'vitest';
import { checkInDateFor, weeklyCheckIn } from './checkIn';

const estimate = (expenditure: number | null, margin: number | null = 300) => ({
  expenditure, expenditureMargin: margin, weightChangePerWeek: -0.4, loggedDays: 20, weighIns: 20,
});
const suggestion = (nourish: number, fastDaysPerWeek = 0, limited = false) => ({ nourish, fastDaysPerWeek, limited, expectedLoss: 0.5 });
const SUNDAY = '2026-10-25';

describe('checkInDateFor', () => {
  it('is today on a Sunday and the Sunday before otherwise', () => {
    expect(checkInDateFor('2026-10-25')).toBe('2026-10-25');
    expect(checkInDateFor('2026-10-26')).toBe('2026-10-25');
    expect(checkInDateFor('2026-10-31')).toBe('2026-10-25');
  });
});

describe('weeklyCheckIn', () => {
  it('moves the target towards the pace by at most 150 kcal', () => {
    const down = weeklyCheckIn(estimate(2300), suggestion(1750), 2100, null, SUNDAY, 0.5, 1);
    expect(down).toMatchObject({ status: 'changed', previousTarget: 2100, target: 1950, suggested: 1750, burnUsed: 2300 });
    expect(weeklyCheckIn(estimate(2300), suggestion(2180), 2100, null, SUNDAY, 0.5).target).toBe(2180);
  });

  it('keeps the target when the gap is small', () => {
    expect(weeklyCheckIn(estimate(2300), suggestion(2130), 2100, null, SUNDAY, 0.5)).toMatchObject({ status: 'kept', target: 2100 });
  });

  it("uses last week's burn while this week's stays inside its range", () => {
    // Burn read 200 higher, inside last week's ±300: the target is worked out from 2,300 still
    const steady = weeklyCheckIn(estimate(2500), suggestion(2300), 2100, { burnUsed: 2300, margin: 300 }, SUNDAY, 0.5);
    expect(steady).toMatchObject({ status: 'kept', target: 2100, burnUsed: 2300, suggested: 2100, expenditure: 2500 });
    // Outside the range: the new burn counts
    const moved = weeklyCheckIn(estimate(2700), suggestion(2500), 2100, { burnUsed: 2300, margin: 300 }, SUNDAY, 0.5);
    expect(moved).toMatchObject({ status: 'changed', target: 2250, burnUsed: 2700 });
  });

  it('spreads a steady burn across nourish days when there are fast days', () => {
    // 2 fast days: 200 kcal of burn is 280 kcal on each of the 5 nourish days
    const est = weeklyCheckIn(estimate(2500), suggestion(2580, 2), 2300, { burnUsed: 2300, margin: 300 }, SUNDAY, 0.5);
    expect(est).toMatchObject({ suggested: 2300, status: 'kept' });
  });

  it('moves a 5:2 target held under the burn one for one with a steady burn', () => {
    const est = weeklyCheckIn(estimate(2500), suggestion(2200, 2, true), 1900, { burnUsed: 2300, margin: 300 }, SUNDAY, 0.5);
    expect(est).toMatchObject({ suggested: 2000, status: 'changed', target: 2000 });
  });

  it('records the pace the targets give', () => {
    expect(weeklyCheckIn(estimate(2300), { ...suggestion(1480, 2, true), expectedLoss: 0.396 }, 1480, null, SUNDAY, 0.5).weeklyLoss).toBe(0.4);
  });

  it('keeps converging on a steady burn after a capped step', () => {
    const next = weeklyCheckIn(estimate(2300), suggestion(1750), 1950, { burnUsed: 2300, margin: 300 }, SUNDAY, 0.5);
    expect(next).toMatchObject({ status: 'changed', target: 1800 });
  });

  it('holds the target without an estimate', () => {
    expect(weeklyCheckIn(estimate(null, null), null, 2100, { burnUsed: 2300, margin: 300 }, SUNDAY, 0.5))
      .toMatchObject({ status: 'held', target: 2100, burnUsed: 2300, suggested: null, weeklyLoss: 0.5 });
  });

  it('never goes below the floor', () => {
    expect(weeklyCheckIn(estimate(1500), suggestion(1200), 1250, null, SUNDAY, 0.5).target).toBe(1200);
  });
});
