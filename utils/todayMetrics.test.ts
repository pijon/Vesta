import { describe, expect, it } from 'vitest';
import { waterPace } from './todayMetrics';

const at = (hours: number) => new Date(2026, 9, 17, hours, 0);

describe('waterPace', () => {
  it('says nothing about an empty glass early in the day', () => {
    expect(waterPace(0, 2, at(6))).toBeNull();
    expect(waterPace(0, 2, at(8))).toBeNull();
  });

  it('asks for a top-up once an empty glass is behind', () => {
    expect(waterPace(0, 2, at(14))).toBe('Top up');
  });

  it('is on track when keeping up with the day', () => {
    expect(waterPace(1, 2, at(14))).toBe('On track');
  });

  it('reaches the goal', () => {
    expect(waterPace(2, 2, at(9))).toBe('Goal reached');
  });
});
