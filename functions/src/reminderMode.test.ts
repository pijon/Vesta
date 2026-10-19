import { describe, expect, it } from 'vitest';
import { reminderMode } from './reminderMode.js';

const saved = (experience: string, trackingSetupComplete = true) =>
  ({ version: 1, experience, profileSetupComplete: true, trackingSetupComplete });

describe('reminderMode', () => {
  it('sends to trackers, and to accounts from before the choice existed', () => {
    expect(reminderMode(saved('tracking'))).toBe('send');
    expect(reminderMode(undefined)).toBe('send');
    expect(reminderMode(null)).toBe('send');
  });

  it('keeps Plan meals quiet, and tracking whose setup is unfinished', () => {
    expect(reminderMode(saved('planning', false))).toBe('quiet');
    expect(reminderMode(saved('planning', true))).toBe('quiet');
    expect(reminderMode(saved('tracking', false))).toBe('quiet');
  });

  it('neither sends nor marks when the saved choice is unreadable', () => {
    for (const value of ['planning', [], { ...saved('planning'), version: 2 }, { ...saved('family') }, { version: 1, experience: 'tracking' }]) {
      expect(reminderMode(value)).toBe('skip');
    }
  });
});
