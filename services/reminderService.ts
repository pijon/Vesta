import { arrayRemove, arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { currentUid, db, functions } from './firebase';
import { ReminderSettings } from '../types';
import { VAPID_PUBLIC_KEY } from '../constants';

export const DEFAULT_REMINDERS: ReminderSettings = {
  log: { enabled: true, time: '20:00' },
  weighIn: { enabled: true, time: '07:30', days: [1, 3, 5] },
  eatingOut: { enabled: true, delayMinutes: 90 },
};

/**
 * Whether this device can get push reminders:
 * - 'ready': supported here
 * - 'install': an iPhone or iPad in Safari; push only works once Vesta is added to the Home Screen
 * - 'unsupported': this browser can't receive web push
 */
export type PushSupport = 'ready' | 'install' | 'unsupported';

export const pushSupport = (): PushSupport => {
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIos && !standalone) return 'install';
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'ready' : 'unsupported';
};

const reminderDoc = () => {
  const uid = currentUid();
  if (!uid) throw new Error('Not signed in');
  return doc(db, 'reminders', uid);
};

const keyBytes = (base64Url: string) => {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
};

const registration = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('The app needs to finish installing first. Reload and try again.');
  return reg;
};

/** This device's current push subscription, if any. */
export const currentSubscription = async () => {
  if (pushSupport() !== 'ready') return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
};

export const getReminders = async (): Promise<{ settings: ReminderSettings; enabled: boolean }> => {
  const snap = await getDoc(reminderDoc());
  const data = snap.data() as (Partial<ReminderSettings> & { enabled?: boolean }) | undefined;
  return {
    settings: {
      log: { ...DEFAULT_REMINDERS.log, ...data?.log },
      weighIn: { ...DEFAULT_REMINDERS.weighIn, ...data?.weighIn },
      eatingOut: { ...DEFAULT_REMINDERS.eatingOut, ...data?.eatingOut },
    },
    enabled: !!data?.enabled,
  };
};

/** Asks for permission (call from a tap), subscribes this device and saves the settings. */
export const enableReminders = async (settings: ReminderSettings) => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for Vesta. Allow them in Settings → Notifications → Vesta, then try again.'
      : 'Notifications weren\'t allowed.');
  }
  const reg = await registration();
  const subscription = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  await setDoc(reminderDoc(), {
    ...settings,
    enabled: true,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    subscriptions: arrayUnion(subscription.toJSON()),
  }, { merge: true });
};

export const saveReminderSettings = (settings: ReminderSettings) =>
  setDoc(reminderDoc(), { ...settings, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, { merge: true });

/** Stops reminders on this device; other devices keep theirs. */
export const disableReminders = async () => {
  const subscription = await currentSubscription();
  const ref = reminderDoc();
  if (subscription) {
    const json = subscription.toJSON();
    await subscription.unsubscribe();
    // Remove by endpoint: the stored copy is the same object the device gave us
    const snap = await getDoc(ref);
    const stored = ((snap.data()?.subscriptions as PushSubscriptionJSON[] | undefined) ?? []).filter(s => s.endpoint === json.endpoint);
    if (stored.length) await setDoc(ref, { subscriptions: arrayRemove(...stored) }, { merge: true });
  }
  const after = await getDoc(ref);
  const left = (after.data()?.subscriptions as unknown[] | undefined)?.length ?? 0;
  if (!left) await setDoc(ref, { enabled: false }, { merge: true });
};

const sendTestCallable = httpsCallable<void, { delivered: number }>(functions, 'sendTestReminder');

export const sendTestReminder = async () => (await sendTestCallable()).data.delivered;
