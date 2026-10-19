import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { Avatar, UserExperience, UserPreferences, UserSetupSnapshot, UserSetupSubmission, UserStats } from '../types';
import { isCalendarDate, legacyUserPreferences, parseUserPreferences } from '../utils/userPreferences';

const assertUser = (uid: string) => {
  if (!uid || auth.currentUser?.uid !== uid) throw new Error('Your account changed. Reload and try again.');
};

const refsFor = (uid: string) => ({
  preferences: doc(db, 'users', uid, 'data', 'preferences'),
  stats: doc(db, 'users', uid, 'data', 'stats'),
  profile: doc(db, 'users', uid, 'profile', 'public'),
});

const statsFrom = (snapshot: DocumentSnapshot): Partial<UserStats> | null => {
  if (!snapshot.exists()) return null;
  const value: unknown = snapshot.data();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Your profile could not be read. Try again.');
  return value as Partial<UserStats>;
};

const preferencesFrom = (snapshot: DocumentSnapshot): UserPreferences | null =>
  snapshot.exists() ? parseUserPreferences(snapshot.data()) : null;

/** Server failures never mean a new account. All references retain the confirmed uid. */
export const getUserSetup = async (uid: string): Promise<UserSetupSnapshot> => {
  assertUser(uid);
  const refs = refsFor(uid);
  const [preferenceDoc, statsDoc] = await Promise.all([
    getDocFromServer(refs.preferences), getDocFromServer(refs.stats),
  ]);
  assertUser(uid);
  const preferences = preferencesFrom(preferenceDoc);
  const stats = statsFrom(statsDoc);
  if (preferences || !statsDoc.exists()) return { uid, preferences, stats };

  const result = await runTransaction(db, async transaction => {
    const [latestPreferences, latestStats] = await Promise.all([
      transaction.get(refs.preferences), transaction.get(refs.stats),
    ]);
    assertUser(uid);
    const currentStats = statsFrom(latestStats);
    const currentPreferences = preferencesFrom(latestPreferences) ?? legacyUserPreferences(currentStats);
    if (!latestPreferences.exists() && currentPreferences) transaction.set(refs.preferences, currentPreferences);
    return { uid, preferences: currentPreferences, stats: currentStats };
  });
  assertUser(uid);
  return result;
};

export class UserSetupRequiredError extends Error {
  constructor(public readonly experience: UserExperience) {
    super('Complete your setup to use this experience.');
    this.name = 'UserSetupRequiredError';
  }
}

interface SetupChange {
  preferences: UserPreferences;
  statsPatch?: Partial<UserStats>;
  name?: string;
  avatar?: Avatar;
}

/** No UI/cache side effects here: Firestore may repeat the callback. */
const changeSetup = async (uid: string, change: (current: UserSetupSnapshot) => SetupChange): Promise<UserSetupSnapshot> => {
  assertUser(uid);
  const refs = refsFor(uid);
  const result = await runTransaction(db, async transaction => {
    const [preferenceDoc, statsDoc] = await Promise.all([
      transaction.get(refs.preferences), transaction.get(refs.stats),
    ]);
    assertUser(uid);
    const stats = statsFrom(statsDoc);
    const preferences = preferencesFrom(preferenceDoc) ?? legacyUserPreferences(stats);
    const next = change({ uid, preferences, stats });
    transaction.set(refs.preferences, next.preferences);
    if (next.statsPatch) transaction.set(refs.stats, next.statsPatch, { merge: true });
    if (next.name !== undefined || next.avatar) transaction.set(refs.profile, {
      ...(next.name !== undefined ? { name: next.name } : {}), ...(next.avatar ? { avatar: next.avatar } : {}),
    }, { merge: true });
    return { uid, preferences: next.preferences, stats: next.statsPatch ? { ...stats, ...next.statsPatch } : stats };
  });
  assertUser(uid);
  return result;
};

const validName = (name: string): string => {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('Enter a name from 1 to 100 characters.');
  return name.trim();
};

export const completeUserSetup = async (uid: string, submission: UserSetupSubmission, date: string): Promise<UserSetupSnapshot> => {
  const name = validName(submission.name);
  if (!isCalendarDate(date)) throw new Error('A valid local calendar date is required.');
  if (submission.experience !== 'planning' && submission.experience !== 'tracking') throw new Error('Choose how you want to use Vesta.');
  if (submission.experience === 'tracking') {
    const values = [submission.currentWeight, submission.goalWeight, submission.dailyCalorieGoal, submission.nonFastDayCalories, submission.dailyWaterGoal];
    if (values.some(value => !Number.isFinite(value) || value <= 0) || submission.currentWeight >= 500 || submission.goalWeight >= 500) {
      throw new Error('Enter valid positive weights and daily targets.');
    }
  }
  return changeSetup(uid, current => {
    const preferences: UserPreferences = {
      version: 1, experience: submission.experience, profileSetupComplete: true,
      trackingSetupComplete: current.preferences?.trackingSetupComplete ?? false,
    };
    if (submission.experience === 'planning') return { preferences, statsPatch: { name }, name };

    const existing = current.stats?.weightHistory;
    if (existing !== undefined && (!Array.isArray(existing) || existing.some(entry =>
      !entry || !isCalendarDate(entry.date) || !Number.isFinite(entry.weight) || entry.weight <= 0))) {
      throw new Error('Your weight history could not be updated safely. Try again.');
    }
    const history = [...(existing ?? []).filter(entry => entry.date !== date), { date, weight: submission.currentWeight }]
      .sort((a, b) => a.date.localeCompare(b.date));
    const { experience: _experience, ...answers } = submission;
    return {
      preferences: { ...preferences, trackingSetupComplete: true }, name,
      statsPatch: {
        ...answers, name, weightHistory: history,
        startWeight: existing?.length ? current.stats?.startWeight ?? history[0].weight : submission.currentWeight,
      },
    };
  });
};

export const saveUserExperience = async (uid: string, experience: UserExperience): Promise<UserSetupSnapshot> => {
  if (experience !== 'planning' && experience !== 'tracking') throw new Error('Choose how you want to use Vesta.');
  return changeSetup(uid, current => {
    if (!current.preferences?.profileSetupComplete || (experience === 'tracking' && !current.preferences.trackingSetupComplete)) {
      throw new UserSetupRequiredError(experience);
    }
    return { preferences: { ...current.preferences, experience } };
  });
};

export const saveUserProfileName = async (uid: string, value: string): Promise<UserSetupSnapshot> => {
  const name = validName(value);
  return changeSetup(uid, current => {
    if (!current.preferences) throw new Error('Complete your setup first.');
    return { preferences: current.preferences, statsPatch: { name }, name };
  });
};

/** Family avatar editing must not create a full default health profile. */
export const saveUserProfileAvatar = async (uid: string, avatar: Avatar): Promise<UserSetupSnapshot> => {
  if (!avatar || typeof avatar.seed !== 'string' || !avatar.seed.length || avatar.seed.length > 64
    || !['calories', 'water', 'weight', 'workout', 'fasting'].includes(avatar.tint)) throw new Error('Choose a valid avatar.');
  return changeSetup(uid, current => {
    if (!current.preferences) throw new Error('Complete your setup first.');
    return { preferences: current.preferences, statsPatch: { avatar }, name: current.stats?.name?.trim() ?? '', avatar };
  });
};
