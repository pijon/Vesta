import { describe, expect, it } from 'vitest';
import { localDateString, parseLocalDate } from './dateUtils';

// vitest.config.ts runs these in America/Los_Angeles (UTC−8/−7).

describe('localDateString', () => {
  it('gives the local date late in the evening, when UTC is already on the next day', () => {
    expect(localDateString(new Date(2026, 9, 14, 23, 30))).toBe('2026-10-14');
  });

  it('pads month and day', () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseLocalDate', () => {
  it('parses as local midnight, not UTC midnight (the previous evening here)', () => {
    const d = parseLocalDate('2026-03-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 2, 1, 0]);
  });

  it('round-trips every day of a year, daylight-saving switches included', () => {
    const d = new Date(2026, 0, 1);
    while (d.getFullYear() === 2026) {
      const s = localDateString(d);
      expect(localDateString(parseLocalDate(s))).toBe(s);
      d.setDate(d.getDate() + 1);
    }
  });
});
