import { describe, expect, it } from 'vitest';
import { legacyUserPreferences, parseUserPreferences } from './userPreferences';

const planning = { version: 1, experience: 'planning', profileSetupComplete: true, trackingSetupComplete: false };

describe('persisted user preferences', () => {
  it('reads a planning preference independently of weight history', () => {
    expect(parseUserPreferences(planning)).toEqual(planning);
  });

  it.each([null, {}, { ...planning, version: 2 }, { ...planning, experience: 'family' },
    { ...planning, trackingSetupComplete: 'false' }, { ...planning, profileSetupComplete: false, trackingSetupComplete: true }])(
    'rejects malformed or unsupported records without inventing a default', value => {
      expect(() => parseUserPreferences(value)).toThrow();
    },
  );
});

describe('legacy setup', () => {
  it('keeps confirmed absence distinct from an existing profile', () => {
    expect(legacyUserPreferences(null)).toBeNull();
    expect(legacyUserPreferences({})).toEqual({ version: 1, experience: 'tracking', profileSetupComplete: false, trackingSetupComplete: false });
  });

  it('grandfathers an established cloud tracker even without newer profile fields', () => {
    expect(legacyUserPreferences({ weightHistory: [{ date: '2026-10-18', weight: 82 }] })).toEqual({
      version: 1, experience: 'tracking', profileSetupComplete: true, trackingSetupComplete: true,
    });
  });

  it('does not treat default goals or a name as completed tracking', () => {
    expect(legacyUserPreferences({ name: ' Sam ', currentWeight: 0, dailyCalorieGoal: 800, weightHistory: [] })).toEqual({
      version: 1, experience: 'tracking', profileSetupComplete: true, trackingSetupComplete: false,
    });
  });

  it.each(['2026-02-30', '2026-1-01', 'not-a-date'])('rejects invalid history dates: %s', date => {
    expect(legacyUserPreferences({ weightHistory: [{ date, weight: 82 }] })?.trackingSetupComplete).toBe(false);
  });

  it('rejects zero or invalid history weights and overlong names', () => {
    expect(legacyUserPreferences({ name: 'x'.repeat(101), weightHistory: [{ date: '2026-10-18', weight: 0 }] })?.profileSetupComplete).toBe(false);
  });
});
