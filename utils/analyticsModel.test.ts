import { describe, expect, it } from 'vitest';
import { AnalyticsDay, LINK_WEEKS, calorieSources, chartStart, goalDateAtPace, lastFullWeekEnd, loggingWeightLink, loggingWeightVerdict, planAdherence, summarize, weakestSlot, weightProgress } from './analyticsModel';
import { addDays } from './planUtils';
import { parseLocalDate } from './dateUtils';
import { DailyLog, FoodLogItem, PlannedDayRecord, WeightEntry } from '../types';

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

describe('lastFullWeekEnd', () => {
  it('is the Sunday before today, a week back on a Sunday', () => {
    expect(lastFullWeekEnd('2026-10-14')).toBe('2026-10-11');
    expect(lastFullWeekEnd('2026-10-11')).toBe('2026-10-04');
  });
});

describe('loggingWeightLink', () => {
  const end = lastFullWeekEnd(TODAY);
  const start = addDays(end, -(LINK_WEEKS * 7 - 1));
  // Six unlogged weeks at a steady weight, then six weeks logged every day losing 0.1 kg a day
  const days = Array.from({ length: LINK_WEEKS * 7 }, (_, i) => day(addDays(start, i), i >= 42 ? 1500 : 0));
  const history: WeightEntry[] = Array.from({ length: LINK_WEEKS * 7 + 1 }, (_, i) => ({
    date: addDays(start, i - 1),
    weight: 90 - Math.max(0, i - 43) * 0.1,
  }));

  it('splits weeks by how many days were fully logged', () => {
    const link = loggingWeightLink(days, history)!;
    expect(link.logged.weeks).toBe(6);
    expect(link.other.weeks).toBe(6);
    expect(link.other.change).toBeCloseTo(0, 5);
    expect(link.logged.change).toBeLessThan(-0.3);
    expect(loggingWeightVerdict(link, true).tone).toBe('win');
    // Aiming to gain, losing in logged weeks isn't the better side
    expect(loggingWeightVerdict(link, false).tone).toBe('steady');
  });

  it('needs two weeks on each side', () => {
    const allLogged = days.map(d => ({ ...d, complete: true }));
    expect(loggingWeightLink(allLogged, history)).toBeNull();
  });

  it('skips weeks the weigh-ins do not cover', () => {
    expect(loggingWeightLink(days, history.slice(50))).toBeNull();
  });
});

describe('planAdherence', () => {
  const dates = Array.from({ length: 4 }, (_, i) => addDays(TODAY, i - 4));
  const days = dates.map(date => day(date, 1500));
  const record = (completed: string[]): PlannedDayRecord => ({
    meals: [{ key: 'b', slot: 'breakfast' }, { key: 'l', slot: 'lunch' }, { key: 'd', slot: 'dinner' }],
    completed,
  });

  it('counts ticked meals by slot and finds the one that slips', () => {
    const planned = Object.fromEntries(dates.map(date => [date, record(['b', 'd'])]));
    planned[dates[0]] = record(['b', 'l', 'd']);
    const result = planAdherence(planned, days)!;
    expect(result).toMatchObject({ planned: 12, eaten: 9 });
    expect(result.slots.map(s => [s.slot, s.eaten])).toEqual([['breakfast', 4], ['lunch', 1], ['dinner', 4]]);
    expect(weakestSlot(result)?.slot).toBe('lunch');
  });

  it('says nothing for someone who never ticks meals', () => {
    expect(planAdherence(Object.fromEntries(dates.map(date => [date, record([])])), days)).toBeNull();
  });

  it('leaves out days with no food logged', () => {
    const planned = Object.fromEntries(dates.map(date => [date, record(['b', 'l', 'd'])]));
    const result = planAdherence(planned, [...days.slice(0, 3), day(dates[3], 0)])!;
    expect(result.planned).toBe(9);
  });
});

describe('calorieSources', () => {
  const at = (date: string, hour: number) => parseLocalDate(date).getTime() + hour * 3_600_000;
  const item = (name: string, calories: number, timestamp: number): FoodLogItem => ({ id: name + timestamp, name, calories, timestamp });
  const log = (date: string, items: FoodLogItem[]): DailyLog => ({ date, items, workouts: [], waterIntake: 0 });
  const dates = [addDays(TODAY, -2), addDays(TODAY, -1), TODAY];
  const logs = dates.map(date => log(date, [
    item('Porridge', 300, at(date, 8)),
    item('Chicken salad', 500, at(date, 12)),
    item('chicken  salad', 100, at(date, 13)),
    item('Pasta', 700, at(date, 19)),
    item('Crisps', 400, at(date, 22)),
  ]));

  it('groups foods by name and ranks them by calories', () => {
    const result = calorieSources(logs, dates[0], TODAY)!;
    expect(result.total).toBe(6000);
    expect(result.foods.map(f => [f.name, f.calories])).toEqual([['Pasta', 2100], ['chicken  salad', 1800], ['Crisps', 1200], ['Porridge', 900]]);
    expect(result.foods[1].count).toBe(6);
    expect(result.repeatShare).toBe(1);
    expect(result.times.map(t => [t.id, t.calories])).toEqual([['morning', 900], ['midday', 1800], ['evening', 2100], ['late', 1200]]);
  });

  it('leaves foods logged once out of the list, but not out of the total', () => {
    const withOneOff = [...logs.slice(0, 2), log(TODAY, [...logs[2].items, item('Wedding cake', 3000, at(TODAY, 15))])];
    const result = calorieSources(withOneOff, dates[0], TODAY)!;
    expect(result.foods.map(f => f.name)).not.toContain('Wedding cake');
    expect(result.repeatShare).toBe(6000 / 9000);
  });

  it('leaves entries filled in on another day out of the time of day', () => {
    const late = [...logs, log(addDays(TODAY, -3), Array.from({ length: 4 }, (_, i) => item(`Soup ${i}`, 250, at(TODAY, 9))))];
    const result = calorieSources(late, addDays(TODAY, -3), TODAY)!;
    expect(result.total).toBe(7000);
    expect(result.times.find(t => t.id === 'morning')!.calories).toBe(900);
  });

  it('needs a few days of food', () => {
    expect(calorieSources(logs.slice(0, 2), dates[0], TODAY)).toBeNull();
  });
});
