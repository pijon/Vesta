import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { dueEatingOutNudges, StoredDay } from './eatingOut.js';
import { reminderMode } from './reminderMode.js';
import webpush, { PushSubscription, WebPushError } from 'web-push';

const VAPID_PUBLIC_KEY = defineString('VAPID_PUBLIC_KEY');
const VAPID_SUBJECT = defineString('VAPID_SUBJECT');
const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');

const REGION = 'europe-west1';
/** A reminder still goes out this long after its time (covers a missed or late scheduler run) */
const GRACE_MINUTES = 120;

/** reminders/{uid}: written by the app (settings, subscriptions) and by this function (lastSent) */
interface ReminderDoc {
  enabled?: boolean;
  timeZone?: string;
  subscriptions?: PushSubscription[];
  log?: { enabled: boolean; time: string };
  weighIn?: { enabled: boolean; time: string; days: number[] };
  eatingOut?: { enabled: boolean; delayMinutes: number };
  lastSent?: { log?: string; weighIn?: string; eatingOut?: { date: string; ids: string[] } };
}

interface Payload { title: string; body: string; url: string; tag: string }

/** The date, weekday (0 = Sunday) and minutes since midnight in the user's time zone. */
const localNow = (timeZone: string, now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(now).map(p => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** Due when the time has passed (within the grace period) and it hasn't gone out today. */
const isDue = (time: string, nowMinutes: number, lastSent: string | undefined, today: string) => {
  const at = minutesOf(time);
  return lastSent !== today && nowMinutes >= at && nowMinutes < at + GRACE_MINUTES;
};

const configure = () => webpush.setVapidDetails(VAPID_SUBJECT.value(), VAPID_PUBLIC_KEY.value(), VAPID_PRIVATE_KEY.value());

/** Sends to every subscription; drops the ones the push service says are gone. Returns how many arrived. */
const sendToAll = async (uid: string, subscriptions: PushSubscription[], payload: Payload) => {
  const gone: PushSubscription[] = [];
  let delivered = 0;
  await Promise.all(subscriptions.map(async sub => {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 4, urgency: 'normal' });
      delivered++;
    } catch (e) {
      const status = e instanceof WebPushError ? e.statusCode : 0;
      if (status === 404 || status === 410) gone.push(sub);
      else logger.warn('Push failed', { uid, status, message: e instanceof Error ? e.message : String(e) });
    }
  }));
  if (gone.length) {
    await getFirestore().doc(`reminders/${uid}`).update({ subscriptions: FieldValue.arrayRemove(...gone) });
  }
  return delivered;
};

/**
 * Every 15 minutes: evening log reminders (only when nothing is logged that day), weigh-in
 * reminders on the chosen days (only when there's no weigh-in yet that day) and a check-in after
 * each eating-out meal that isn't logged. All three are about tracking: for someone on Plan meals
 * (see reminderMode) they're marked as handled when due but not sent.
 */
export const sendReminders = onSchedule(
  { schedule: 'every 15 minutes', region: REGION, secrets: [VAPID_PRIVATE_KEY], timeoutSeconds: 120, maxInstances: 1 },
  async () => {
    configure();
    const db = getFirestore();
    const snapshot = await db.collection('reminders').where('enabled', '==', true).get();

    for (const doc of snapshot.docs) {
      const uid = doc.id;
      const r = doc.data() as ReminderDoc;
      if (!r.subscriptions?.length) continue;
      let now;
      try {
        now = localNow(r.timeZone || 'Europe/Stockholm');
      } catch {
        now = localNow('Europe/Stockholm');
      }

      try {
        const preferences = await db.doc(`users/${uid}/data/preferences`).get();
        const mode = reminderMode(preferences.data());
        if (mode === 'skip') {
          logger.warn('Reminders skipped: unreadable experience preference', { uid });
          continue;
        }
        const sending = mode === 'send';

        if (r.log?.enabled && isDue(r.log.time, now.minutes, r.lastSent?.log, now.date)) {
          const log = sending ? await db.doc(`users/${uid}/logs/${now.date}`).get() : undefined;
          const items = (log?.data()?.items as unknown[] | undefined) ?? [];
          if (sending && items.length === 0) {
            await sendToAll(uid, r.subscriptions, {
              title: 'Nothing logged today',
              body: 'Add what you ate so today counts towards your personal target.',
              url: '/today',
              tag: 'log-reminder',
            });
          }
          // Checked for today either way, so it doesn't ask again after a later log
          await doc.ref.update({ 'lastSent.log': now.date });
        }

        if (r.weighIn?.enabled && r.weighIn.days?.includes(now.weekday) && isDue(r.weighIn.time, now.minutes, r.lastSent?.weighIn, now.date)) {
          const stats = sending ? await db.doc(`users/${uid}/data/stats`).get() : undefined;
          const history = (stats?.data()?.weightHistory as { date: string }[] | undefined) ?? [];
          if (sending && !history.some(e => e.date === now.date)) {
            await sendToAll(uid, r.subscriptions, {
              title: 'Time to weigh in',
              body: 'Before breakfast is best. Regular weigh-ins keep your trend accurate.',
              url: '/today?weigh=1',
              tag: 'weigh-in-reminder',
            });
          }
          await doc.ref.update({ 'lastSent.weighIn': now.date });
        }

        if (r.eatingOut?.enabled) {
          const sent = r.lastSent?.eatingOut?.date === now.date ? r.lastSent.eatingOut.ids : [];
          const delay = Math.min(Math.max(r.eatingOut.delayMinutes || 90, 30), 240);
          const dayDoc = await db.doc(`users/${uid}/days/${now.date}`).get();
          const due = dueEatingOutNudges(dayDoc.data() as StoredDay | undefined, now.minutes, delay, sent, GRACE_MINUTES);
          for (const nudge of sending ? due : []) {
            await sendToAll(uid, r.subscriptions, {
              title: nudge.title,
              body: nudge.body,
              url: `/today?eatout=${encodeURIComponent(nudge.instanceId)}`,
              tag: `eating-out-${nudge.instanceId}`,
            });
          }
          // Recorded even if the push didn't arrive (or, on Plan meals, wasn't sent), so a dead
          // subscription isn't retried every 15 minutes and a switch back doesn't send a backlog
          if (due.length) await doc.ref.update({ 'lastSent.eatingOut': { date: now.date, ids: [...sent, ...due.map(n => n.instanceId)] } });
        }
      } catch (e) {
        logger.error('Reminder check failed', { uid, message: e instanceof Error ? e.message : String(e) });
      }
    }
  },
);

/** Sends a test notification to the signed-in user's devices, to check the setup. */
export const sendTestReminder = onCall(
  { region: REGION, secrets: [VAPID_PRIVATE_KEY], maxInstances: 5 },
  async request => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
    configure();
    const doc = await getFirestore().doc(`reminders/${uid}`).get();
    const subscriptions = (doc.data() as ReminderDoc | undefined)?.subscriptions ?? [];
    if (!subscriptions.length) throw new HttpsError('failed-precondition', 'Turn on reminders on this device first.');
    const delivered = await sendToAll(uid, subscriptions, {
      title: 'Reminders are on',
      body: "This is how Vesta's reminders will look.",
      url: '/settings',
      tag: 'test-reminder',
    });
    return { delivered };
  },
);
