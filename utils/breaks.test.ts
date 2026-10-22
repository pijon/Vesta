import { describe, expect, it } from 'vitest';
import { breaksAfterSwitch, onBreak, settling, stretchOf } from './breaks';

const breaks = [{ start: '2026-08-01', end: '2026-08-15' }, { start: '2026-10-20' }];

describe('breaks', () => {
  it('knows the days on a break, up to the day tracking resumed', () => {
    expect(onBreak(breaks, '2026-07-31')).toBe(false);
    expect(onBreak(breaks, '2026-08-01')).toBe(true);
    expect(onBreak(breaks, '2026-08-14')).toBe(true);
    expect(onBreak(breaks, '2026-08-15')).toBe(false);
    expect(onBreak(breaks, '2026-12-01')).toBe(true); // still open
    expect(onBreak(undefined, '2026-08-01')).toBe(false);
  });

  it('marks the three days after a break as settling', () => {
    expect(['2026-08-14', '2026-08-15', '2026-08-17', '2026-08-18'].map(d => settling(breaks, d))).toEqual([false, true, true, false]);
  });

  it('numbers the stretches of tracking between breaks', () => {
    expect(stretchOf(breaks, '2026-07-01')).toBe(0);
    expect(stretchOf(breaks, '2026-08-15')).toBe(1);
  });

  it('opens a break when switching to Plan meals and closes it when tracking again', () => {
    const opened = breaksAfterSwitch([], 'tracking', 'planning', '2026-10-01');
    expect(opened).toEqual([{ start: '2026-10-01' }]);
    expect(breaksAfterSwitch(opened, 'tracking', 'planning', '2026-10-02')).toEqual(opened); // already open
    expect(breaksAfterSwitch(opened, 'planning', 'tracking', '2026-10-10')).toEqual([{ start: '2026-10-01', end: '2026-10-10' }]);
  });

  it('drops a break opened and closed the same day', () => {
    expect(breaksAfterSwitch([{ start: '2026-10-01' }], 'planning', 'tracking', '2026-10-01')).toEqual([]);
  });

  it('changes nothing for other switches', () => {
    expect(breaksAfterSwitch(undefined, 'planning', 'tracking', '2026-10-01')).toEqual([]);
    expect(breaksAfterSwitch(breaks, 'tracking', 'tracking', '2026-10-01')).toEqual(breaks);
  });
});
