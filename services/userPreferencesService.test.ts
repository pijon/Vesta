import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserPreferences, UserSetupSubmission } from '../types';

const remote = vi.hoisted(() => ({
  uid: 'a', failRead: false, failCommit: false, retry: false, competing: null as UserPreferences | null,
}));

vi.mock('./firebase', () => ({ db: {}, auth: { get currentUser() { return remote.uid ? { uid: remote.uid } : null; } } }));
vi.mock('firebase/firestore', async () => {
  const { fakeFirestore: store } = await import('../test/fakeFirestore');
  type Ref = { path: string };
  type Write = { ref: Ref; data: Record<string, unknown>; options?: { merge?: boolean } };
  return {
    ...store.api,
    getDocFromServer: async (ref: Ref) => {
      if (remote.failRead) throw new Error('offline');
      return store.api.getDoc(ref);
    },
    runTransaction: async (_db: unknown, body: (tx: {
      get: (ref: Ref) => ReturnType<typeof store.api.getDoc>;
      set: (ref: Ref, data: Record<string, unknown>, options?: { merge?: boolean }) => void;
    }) => Promise<unknown>) => {
      if (remote.competing) {
        store.docs.set('users/a/data/preferences', { ...remote.competing });
        remote.competing = null;
      }
      let writes: Write[] = [];
      const tx = { get: store.api.getDoc, set: (ref: Ref, data: Record<string, unknown>, options?: { merge?: boolean }) => { writes.push({ ref, data, options }); } };
      if (remote.retry) { await body(tx); writes = []; }
      const result = await body(tx);
      if (remote.failCommit) throw new Error('commit failed');
      for (const write of writes) await store.api.setDoc(write.ref, write.data, write.options);
      return result;
    },
  };
});

const { fakeFirestore: store } = await import('../test/fakeFirestore');
const { getUserSetup, completeUserSetup, saveUserExperience, saveUserProfileName, saveUserProfileAvatar, UserSetupRequiredError } = await import('./userPreferencesService');
const planning: UserPreferences = { version: 1, experience: 'planning', profileSetupComplete: true, trackingSetupComplete: false };

beforeEach(() => {
  store.reset();
  Object.assign(remote, { uid: 'a', failRead: false, failCommit: false, retry: false, competing: null });
});

describe('authoritative setup loading', () => {
  it('returns confirmed absence without copying unowned local data', async () => {
    localStorage.setItem('fast800_stats', JSON.stringify({ name: 'Another person', currentWeight: 80 }));
    expect(await getUserSetup('a')).toEqual({ uid: 'a', preferences: null, stats: null });
    expect(store.writes).toEqual([]);
  });

  it('propagates read errors without initializing preferences', async () => {
    remote.failRead = true;
    await expect(getUserSetup('a')).rejects.toThrow('offline');
    expect(store.writes).toEqual([]);
  });

  it('migrates a cloud tracker once and respects a competing choice', async () => {
    store.docs.set('users/a/data/stats', { weightHistory: [{ date: '2026-10-18', weight: 82 }] });
    remote.competing = planning;
    expect((await getUserSetup('a')).preferences).toEqual(planning);
    expect(store.writes).toEqual([]);
  });

  it('records explicit completion from actual cloud history', async () => {
    store.docs.set('users/a/data/stats', { weightHistory: [{ date: '2026-10-18', weight: 82 }] });
    expect((await getUserSetup('a')).preferences?.trackingSetupComplete).toBe(true);
    await getUserSetup('a');
    expect(store.writes).toEqual(['users/a/data/preferences']);
  });

  it('does not repair unsupported preferences with defaults', async () => {
    store.docs.set('users/a/data/preferences', { version: 99 });
    await expect(getUserSetup('a')).rejects.toThrow();
    expect(store.writes).toEqual([]);
  });

  it('rejects remembered or mismatched identity', async () => {
    await expect(getUserSetup('b')).rejects.toThrow();
    remote.uid = '';
    await expect(getUserSetup('a')).rejects.toThrow();
    expect(store.writes).toEqual([]);
  });
});

describe('committed setup and experience changes', () => {
  const tracking: UserSetupSubmission = {
    experience: 'tracking', name: 'Alex', currentWeight: 82, goalWeight: 75,
    dailyCalorieGoal: 1800, nonFastDayCalories: 2100, dailyWaterGoal: 2000,
  };

  it('completes planning with a name only, preserving the public avatar', async () => {
    store.docs.set('users/a/profile/public', { name: 'Old', avatar: { seed: 'alex', tint: 'water' } });
    const result = await completeUserSetup('a', { experience: 'planning', name: ' Sam ' }, '2026-10-18');
    expect(result.preferences).toEqual(planning);
    expect(store.docs.get('users/a/data/stats')).toEqual({ name: 'Sam' });
    expect(store.docs.get('users/a/profile/public')).toEqual({ name: 'Sam', avatar: { seed: 'alex', tint: 'water' } });
    expect(store.writes.sort()).toEqual(['users/a/data/preferences', 'users/a/data/stats', 'users/a/profile/public']);
  });

  it('publishes no partial setup after a failed transaction', async () => {
    remote.failCommit = true;
    await expect(completeUserSetup('a', { experience: 'planning', name: 'Sam' }, '2026-10-18')).rejects.toThrow('commit failed');
    expect(store.docs.size).toBe(0);
    expect(store.writes).toEqual([]);
  });

  it('preserves existing history and records one same-day weigh-in when retried', async () => {
    store.docs.set('users/a/data/stats', { name: 'Alex', startWeight: 90, weightHistory: [{ date: '2026-10-17', weight: 84 }, { date: '2026-10-18', weight: 83 }], dailyProteinGoal: 100 });
    remote.retry = true;
    const result = await completeUserSetup('a', tracking, '2026-10-18');
    expect(result.stats?.weightHistory).toEqual([{ date: '2026-10-17', weight: 84 }, { date: '2026-10-18', weight: 82 }]);
    expect(result.stats).toMatchObject({ startWeight: 90, dailyProteinGoal: 100 });
    expect(result.preferences).toEqual({ version: 1, experience: 'tracking', profileSetupComplete: true, trackingSetupComplete: true });
  });

  it('retains health history when switching to planning and back', async () => {
    await completeUserSetup('a', tracking, '2026-10-18');
    const original = structuredClone(store.docs.get('users/a/data/stats'));
    expect((await saveUserExperience('a', 'planning')).preferences?.trackingSetupComplete).toBe(true);
    expect((await saveUserExperience('a', 'tracking')).preferences?.experience).toBe('tracking');
    expect(store.docs.get('users/a/data/stats')).toEqual(original);
  });

  it('records a break from tracking while in Plan meals, apart from stats', async () => {
    await completeUserSetup('a', tracking, '2026-10-18');
    const original = structuredClone(store.docs.get('users/a/data/stats'));
    await saveUserExperience('a', 'planning', '2026-10-20');
    expect(store.docs.get('users/a/data/breaks')).toEqual({ list: [{ start: '2026-10-20' }] });
    await saveUserExperience('a', 'tracking', '2026-11-03');
    expect(store.docs.get('users/a/data/breaks')).toEqual({ list: [{ start: '2026-10-20', end: '2026-11-03' }] });
    expect(store.docs.get('users/a/data/stats')).toEqual(original);
  });

  it('records no break for someone who never tracked', async () => {
    await completeUserSetup('a', { experience: 'planning', name: 'Sam' }, '2026-10-18');
    await expect(saveUserExperience('a', 'tracking', '2026-10-20')).rejects.toBeInstanceOf(UserSetupRequiredError);
    expect(store.docs.has('users/a/data/breaks')).toBe(false);
  });

  it('requires actual health setup before enabling tracking', async () => {
    await completeUserSetup('a', { experience: 'planning', name: 'Sam' }, '2026-10-18');
    await expect(saveUserExperience('a', 'tracking')).rejects.toBeInstanceOf(UserSetupRequiredError);
    expect(store.docs.get('users/a/data/preferences')).toEqual(planning);
    expect(store.docs.get('users/a/data/stats')).toEqual({ name: 'Sam' });
  });

  it('changes a name without changing mode or adding health defaults', async () => {
    await completeUserSetup('a', { experience: 'planning', name: 'Sam' }, '2026-10-18');
    const result = await saveUserProfileName('a', 'Robin');
    expect(result.preferences).toEqual(planning);
    expect(store.docs.get('users/a/data/stats')).toEqual({ name: 'Robin' });
  });

  it('lets a planning member change their family avatar without health defaults', async () => {
    await completeUserSetup('a', { experience: 'planning', name: 'Sam' }, '2026-10-18');
    await saveUserProfileAvatar('a', { seed: 'sam', tint: 'water' });
    expect(store.docs.get('users/a/data/stats')).toEqual({ name: 'Sam', avatar: { seed: 'sam', tint: 'water' } });
    expect(store.docs.get('users/a/profile/public')).toEqual({ name: 'Sam', avatar: { seed: 'sam', tint: 'water' } });
    expect(store.docs.get('users/a/data/preferences')).toEqual(planning);
  });

  it.each(['', 'x'.repeat(101)])('rejects invalid names without writes', async name => {
    await expect(completeUserSetup('a', { experience: 'planning', name }, '2026-10-18')).rejects.toThrow();
    expect(store.writes).toEqual([]);
  });

  it('rejects invalid dates and health targets before any write', async () => {
    await expect(completeUserSetup('a', tracking, '2026-02-30')).rejects.toThrow();
    await expect(completeUserSetup('a', { ...tracking, dailyCalorieGoal: NaN }, '2026-10-18')).rejects.toThrow();
    expect(store.writes).toEqual([]);
  });

  it('rejects an account change before profile or mode writes', async () => {
    remote.uid = 'b';
    await expect(saveUserProfileName('a', 'Robin')).rejects.toThrow();
    await expect(saveUserExperience('a', 'planning')).rejects.toThrow();
    expect(store.writes).toEqual([]);
  });
});
