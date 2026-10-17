import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { MealSlot } from '../types';
import { currentUid, db } from './firebase';
import { getGroup, getMyGroupId } from './groupService';
import { getCacheKey, getFromCache, saveToCache } from '../utils/cacheService';

// --- Family updates ---
// What family members did that the others might want to know: added a recipe, planned a family
// meal, said they aren't eating one, joined. Kept in groups/{groupId}/activity for 30 days, only
// while the family has two or more members. Each update has a stable id from what it's about, so
// undoing the thing (removing the meal, back in for it, deleting the recipe) removes the update.

export type FamilyUpdate = {
  id: string;
  /** Uid of the member who did it */
  by: string;
  /** When, in ms */
  at: number;
} & (
  | { type: 'recipe'; name: string; recipeId: string }
  | { type: 'planned' | 'notEating'; name: string; date: string; slot: MealSlot }
  | { type: 'joined' }
);

type NewUpdate = FamilyUpdate extends infer U ? U extends FamilyUpdate ? Omit<U, 'id' | 'by' | 'at'> : never : never;

export const UPDATES_KEPT_DAYS = 30;
const UPDATES_SHOWN = 50;

const updatesRef = (groupId: string) => collection(db, 'groups', groupId, 'activity');
const updateRef = (groupId: string, id: string) => doc(db, 'groups', groupId, 'activity', id);

/** The id an update gets from what it's about, so the same thing is only ever one update */
const updateId = (update: NewUpdate, by: string, key: string) =>
  update.type === 'joined' ? `joined-${by}` : `${update.type}-${update.type === 'notEating' ? `${by}-` : ''}${key}`;

/** Families of one keep no updates: there's nobody to tell */
const sharedGroupId = async () => {
  const groupId = await getMyGroupId();
  if (!groupId) return null;
  const group = await getGroup(groupId);
  return group && group.memberIds.length > 1 ? groupId : null;
};

/**
 * Records an update; `key` is what it's about (a meal's instanceId, a recipe's id). Never throws:
 * an update that didn't save only means the family hears less.
 */
export const recordFamilyUpdate = async (update: NewUpdate, key = '') => {
  try {
    const by = currentUid();
    const groupId = by && await sharedGroupId();
    if (!by || !groupId) return;
    const id = updateId(update, by, key);
    await setDoc(updateRef(groupId, id), { ...update, id, by, at: Date.now() });
  } catch (e) {
    console.warn('Could not record the family update', e);
  }
};

/**
 * Removes the update about something that was undone (see recordFamilyUpdate); with `date`, only
 * if the update is about that date (a meal moved to another day has a new one). Never throws.
 */
export const forgetFamilyUpdate = async (type: FamilyUpdate['type'], key: string, date?: string) => {
  try {
    const by = currentUid();
    const groupId = await getMyGroupId();
    if (!by || !groupId) return;
    const ref = updateRef(groupId, updateId({ type } as NewUpdate, by, key));
    if (date !== undefined) {
      const snap = await getDoc(ref);
      if (!snap.exists() || (snap.data() as { date?: string }).date !== date) return;
    }
    await deleteDoc(ref);
  } catch (e) {
    console.warn('Could not remove the family update', e);
  }
};

// Seen: when the user last looked at the updates, per device
const SEEN_KEY = getCacheKey('familyUpdatesSeen');
let seenAt = getFromCache<number>(SEEN_KEY) ?? 0;
const seenListeners = new Set<() => void>();

/** The user has seen every update so far (the Family page is showing them) */
export const markFamilyUpdatesSeen = () => {
  seenAt = Date.now();
  saveToCache(SEEN_KEY, seenAt);
  seenListeners.forEach(listener => listener());
};

/** Clears updates past the kept days. Any member may; fine to fail. */
const clearOldUpdates = async (groupId: string) => {
  const old = await getDocs(query(updatesRef(groupId), where('at', '<', Date.now() - UPDATES_KEPT_DAYS * 86_400_000), limit(100)));
  if (old.empty) return;
  const batch = writeBatch(db);
  old.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

/**
 * Keeps the family's recent updates live, newest first, with how many from other members the user
 * hasn't seen. Returns the unsubscribe function; nothing happens without a family.
 */
export const subscribeFamilyUpdates = (onUpdate: (updates: FamilyUpdate[], unseen: number) => void): (() => void) => {
  let stopped = false;
  let unsubscribe: (() => void) | undefined;
  let latest: FamilyUpdate[] = [];
  const emit = () => {
    const me = currentUid();
    if (!stopped) onUpdate(latest, latest.filter(u => u.by !== me && u.at > seenAt).length);
  };
  seenListeners.add(emit);

  getMyGroupId().then(groupId => {
    if (!groupId || stopped) return;
    clearOldUpdates(groupId).catch(e => console.warn('Could not clear old family updates', e));
    unsubscribe = onSnapshot(
      query(updatesRef(groupId), where('at', '>=', Date.now() - UPDATES_KEPT_DAYS * 86_400_000), orderBy('at', 'desc'), limit(UPDATES_SHOWN)),
      snapshot => {
        latest = snapshot.docs.map(d => d.data() as FamilyUpdate).sort((a, b) => b.at - a.at);
        emit();
      },
      e => console.warn('Live family updates stopped:', e),
    );
  }).catch(e => console.warn('Could not start live family updates:', e));

  return () => { stopped = true; seenListeners.delete(emit); unsubscribe?.(); };
};

/** Updates in a row from one member, of one kind, close together (shown as one line) */
export interface FamilyUpdateGroup {
  key: string;
  by: string;
  type: FamilyUpdate['type'];
  /** Newest first */
  updates: FamilyUpdate[];
  at: number;
}

const GROUP_WITHIN_MS = 60 * 60_000;

/** Groups a newest-first list: a member planning a week of meals is one line, not seven. */
export const groupFamilyUpdates = (updates: FamilyUpdate[]): FamilyUpdateGroup[] => {
  const groups: FamilyUpdateGroup[] = [];
  updates.forEach(update => {
    const last = groups[groups.length - 1];
    const oldest = last?.updates[last.updates.length - 1];
    if (last && update.type !== 'joined' && last.by === update.by && last.type === update.type && oldest.at - update.at <= GROUP_WITHIN_MS) {
      last.updates.push(update);
    } else {
      groups.push({ key: update.id, by: update.by, type: update.type, updates: [update], at: update.at });
    }
  });
  return groups;
};
