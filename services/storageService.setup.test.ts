import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_STATS } from '../constants';

const remote = vi.hoisted(() => ({ uid: 'a', afterStatsWrite: null as (() => void) | null }));
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: null }, currentUid: () => remote.uid }));
vi.mock('firebase/firestore', async () => {
  const { fakeFirestore: store } = await import('../test/fakeFirestore');
  return { ...store.api, setDoc: async (...args: Parameters<typeof store.api.setDoc>) => {
    await store.api.setDoc(...args);
    if (args[0].path.endsWith('/data/stats')) remote.afterStatsWrite?.();
  } };
});
const { fakeFirestore: store } = await import('../test/fakeFirestore');
const { getUserStats, saveUserStats } = await import('./storageService');
const { getCachedUserStats } = await import('../utils/cacheService');

beforeEach(() => { store.reset(); remote.uid = 'a'; remote.afterStatsWrite = null; });

describe('account-owned stats compatibility', () => {
  it('does not assign unowned legacy stats to a new account', async () => {
    localStorage.setItem('fast800_stats', JSON.stringify({ ...DEFAULT_USER_STATS, name: 'Someone else', currentWeight: 80 }));
    expect((await getUserStats()).name).toBe('');
  });

  it('normalizes a name-only profile in memory without persisting health defaults', async () => {
    store.docs.set('users/a/data/stats', { name: 'Sam' });
    expect(await getUserStats()).toMatchObject({ name: 'Sam', weightHistory: [], dailyCalorieGoal: 800 });
    expect(store.docs.get('users/a/data/stats')).toEqual({ name: 'Sam' });
  });

  it('keeps cached stats with their actual account', async () => {
    await saveUserStats({ ...DEFAULT_USER_STATS, name: 'Alex' });
    expect(getCachedUserStats('a')?.name).toBe('Alex');
    expect(getCachedUserStats('b')).toBeNull();
    expect(getCachedUserStats()).toBeNull();
  });

  it('rejects a stale account callback and never publishes into the next account', async () => {
    remote.uid = 'b';
    await expect(saveUserStats({ ...DEFAULT_USER_STATS, name: 'Alex' }, 'a')).rejects.toThrow();
    expect(store.writes).toEqual([]);
    remote.uid = 'a';
    remote.afterStatsWrite = () => { remote.uid = 'b'; };
    await saveUserStats({ ...DEFAULT_USER_STATS, name: 'Alex' }, 'a');
    expect(store.docs.has('users/b/profile/public')).toBe(false);
    expect(store.docs.has('users/b/data/stats')).toBe(false);
  });
});
