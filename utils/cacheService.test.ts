import { beforeEach, describe, expect, it } from 'vitest';
import type { UserSetupSnapshot } from '../types';
import { getCachedUserSetup, getUserCacheKey, saveCachedUserSetup } from './cacheService';

const setup: UserSetupSnapshot = {
  uid: 'user-a',
  preferences: { version: 1, experience: 'planning', profileSetupComplete: true, trackingSetupComplete: false },
  stats: { name: 'Ada' },
};

beforeEach(() => localStorage.clear());

describe('cached setup', () => {
  it('opens a returning user from the last confirmed setup', () => {
    saveCachedUserSetup(setup);
    expect(getCachedUserSetup('user-a')).toEqual(setup);
  });

  it('never hands one user another user\'s setup', () => {
    saveCachedUserSetup(setup);
    expect(getCachedUserSetup('user-b')).toBeNull();
    localStorage.setItem(getUserCacheKey('user-b', 'setup'), JSON.stringify(setup));
    expect(getCachedUserSetup('user-b')).toBeNull();
  });

  it('leaves an account that still needs setting up to the server', () => {
    saveCachedUserSetup({ ...setup, preferences: null });
    expect(getCachedUserSetup('user-a')).toBeNull();
  });

  it('ignores a cached setup it cannot read', () => {
    localStorage.setItem(getUserCacheKey('user-a', 'setup'), JSON.stringify({ ...setup, preferences: { experience: 'family' } }));
    expect(getCachedUserSetup('user-a')).toBeNull();
    localStorage.setItem(getUserCacheKey('user-a', 'setup'), '{not json');
    expect(getCachedUserSetup('user-a')).toBeNull();
  });
});
