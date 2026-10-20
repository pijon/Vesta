import { beforeEach, describe, expect, it } from 'vitest';
import type { UserSetupSnapshot } from '../types';
import { claimCache, getCachedUserSetup, getUserCacheKey, isCacheOwner, releaseCacheUnlessOwner, saveCachedUserSetup } from './cacheService';

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

describe('cache owner', () => {
  it('belongs to nobody until a full load claims it', () => {
    expect(isCacheOwner('user-a')).toBe(false);
    claimCache('user-a');
    expect(isCacheOwner('user-a')).toBe(true);
  });

  it("stops another account's launch from reading it, then and after", () => {
    claimCache('user-a');
    releaseCacheUnlessOwner('user-b');
    // b may write its own data before claiming; a's next launch must not read it as a's
    expect(isCacheOwner('user-b')).toBe(false);
    expect(isCacheOwner('user-a')).toBe(false);
  });

  it("keeps the owner's mark", () => {
    claimCache('user-a');
    releaseCacheUnlessOwner('user-a');
    expect(isCacheOwner('user-a')).toBe(true);
  });
});
