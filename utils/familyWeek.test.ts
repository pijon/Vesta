import { describe, expect, it } from 'vitest';
import { Recipe } from '../types';
import { groupFamilyDinners } from './familyWeek';

const meal = (fields: Partial<Recipe>): Recipe => ({ id: 'r1', name: 'Pasta', calories: 600, ...fields }) as Recipe;
const names = new Map([['u2', 'Sam']]);

describe('groupFamilyDinners', () => {
  it('returns every requested date in order, empty days included', () => {
    const days = groupFamilyDinners({ '2026-10-17': [meal({})] }, names, 'u1', ['2026-10-15', '2026-10-16', '2026-10-17']);
    expect(days.map(d => d.date)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17']);
    expect(days.map(d => d.dinners.length)).toEqual([0, 0, 1]);
  });

  it('labels who added a dinner: You, a member by first name, or nobody', () => {
    const [day] = groupFamilyDinners({
      '2026-10-15': [meal({ instanceId: 'a', addedBy: 'u1' }), meal({ instanceId: 'b', addedBy: 'u2' }), meal({ instanceId: 'c', addedBy: 'gone' }), meal({ instanceId: 'd' })],
    }, names, 'u1', ['2026-10-15']);
    expect(day.dinners.map(d => d.addedBy)).toEqual(['You', 'Sam', undefined, undefined]);
  });

  it('counts sides in the calories and ignores dates outside the window', () => {
    const days = groupFamilyDinners({
      '2026-10-15': [meal({ calories: 500, sides: [{ name: 'Salad', calories: 80 }] as Recipe['sides'] })],
      '2026-12-01': [meal({})],
    }, names, null, ['2026-10-15']);
    expect(days).toHaveLength(1);
    expect(days[0].dinners[0].calories).toBe(580);
  });
});
