import { describe, expect, it } from 'vitest';
import { dueEatingOutNudges, StoredDay } from './eatingOut.js';

const dinnerOut = { type: 'custom', kind: 'out', name: 'Eating out', calories: 700, budget: true, slot: 'dinner', instanceId: 'a' };
const day = (extra: Partial<StoredDay> = {}): StoredDay => ({ meals: [dinnerOut], completedMealIds: [], ...extra });
// Dinner is at 18:30; with a 90 minute delay the nudge is due from 20:00 (1200)
const T = 20 * 60;

describe('dueEatingOutNudges', () => {
  it('nudges once the slot time plus the delay has passed', () => {
    expect(dueEatingOutNudges(day(), T - 1, 90, [], 120)).toEqual([]);
    const [nudge] = dueEatingOutNudges(day(), T, 90, [], 120);
    expect(nudge).toMatchObject({ instanceId: 'a', title: 'How was dinner out?' });
    expect(nudge.body).toContain('700 kcal');
  });

  it("doesn't quote a saved figure for a budget that follows the day", () => {
    const [nudge] = dueEatingOutNudges(day({ meals: [{ ...dinnerOut, autoBudget: true }] }), T, 90, [], 120);
    expect(nudge.body).not.toContain('700');
  });

  it('stops after the grace period', () => {
    expect(dueEatingOutNudges(day(), T + 120, 90, [], 120)).toEqual([]);
    expect(dueEatingOutNudges(day(), T + 119, 90, [], 120)).toHaveLength(1);
  });

  it('skips meals already eaten or already nudged', () => {
    expect(dueEatingOutNudges(day({ completedMealIds: ['a'] }), T, 90, [], 120)).toEqual([]);
    expect(dueEatingOutNudges(day(), T, 90, ['a'], 120)).toEqual([]);
  });

  it('asks to log a decided eating-out meal, naming the plan', () => {
    const decided = day({ meals: [{ ...dinnerOut, budget: undefined, name: 'Pad thai at Siam' }] });
    const [nudge] = dueEatingOutNudges(decided, T, 90, [], 120);
    expect(nudge).toMatchObject({ title: 'Log dinner out' });
    expect(nudge.body).toContain('Pad thai at Siam');
  });

  it('ignores home-cooked meals, recipe references and legacy meals without an instance id', () => {
    const meals = [
      { ...dinnerOut, instanceId: 'b', kind: 'home' },
      { type: 'reference', instanceId: 'c', slot: 'dinner' },
      { ...dinnerOut, instanceId: undefined },
    ];
    expect(dueEatingOutNudges({ meals, completedMealIds: [] }, T, 90, [], 120)).toEqual([]);
    expect(dueEatingOutNudges(undefined, T, 90, [], 120)).toEqual([]);
  });

  it('uses each slot\'s own time, and tags when the slot is missing', () => {
    const lunch = { ...dinnerOut, slot: 'lunch', instanceId: 'l' };
    // Lunch 12:30 + 90 min = 14:00
    expect(dueEatingOutNudges(day({ meals: [lunch] }), 14 * 60, 90, [], 120)).toHaveLength(1);
    expect(dueEatingOutNudges(day({ meals: [lunch] }), 13 * 60 + 59, 90, [], 120)).toEqual([]);
    const tagged = { ...dinnerOut, slot: undefined, tags: ['Lunch'], instanceId: 't' };
    expect(dueEatingOutNudges(day({ meals: [tagged] }), 14 * 60, 90, [], 120)).toHaveLength(1);
  });
});
