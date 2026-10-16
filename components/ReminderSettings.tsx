import React, { useEffect, useState } from 'react';
import { CircleAlert, BellOff, BellRing, Check, Loader2, Scale, Send, Share, Store, CookingPot } from 'lucide-react';
import { ReminderSettings as Settings } from '../types';
import {
  DEFAULT_REMINDERS, currentSubscription, disableReminders, enableReminders, getReminders, pushSupport, saveReminderSettings, sendTestReminder,
} from '../services/reminderService';

const WEEKDAYS: { day: number; short: string; label: string }[] = [
  { day: 1, short: 'M', label: 'Monday' }, { day: 2, short: 'T', label: 'Tuesday' }, { day: 3, short: 'W', label: 'Wednesday' },
  { day: 4, short: 'T', label: 'Thursday' }, { day: 5, short: 'F', label: 'Friday' }, { day: 6, short: 'S', label: 'Saturday' },
  { day: 0, short: 'S', label: 'Sunday' },
];

const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`relative shrink-0 w-11 h-7 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${checked ? 'bg-ink' : 'bg-border-control'}`}
  >
    <span className={`absolute top-1 left-1 size-5 rounded-full bg-surface shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
  </button>
);

/** Settings card for push reminders: what to be reminded of, and turning them on for this device. */
export const ReminderSettings: React.FC = () => {
  const support = pushSupport();
  const [settings, setSettings] = useState<Settings>(DEFAULT_REMINDERS);
  const [onThisDevice, setOnThisDevice] = useState(false);
  const [loading, setLoading] = useState(support === 'ready');
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (support !== 'ready') return;
    let cancelled = false;
    (async () => {
      try {
        const [{ settings: saved, enabled }, sub] = await Promise.all([getReminders(), currentSubscription()]);
        if (cancelled) return;
        setSettings(saved);
        setOnThisDevice(enabled && !!sub);
      } catch (e) {
        console.error('Loading reminders failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [support]);

  /** Updates a choice; saved straight away once reminders are on */
  const change = (next: Settings) => {
    setSettings(next);
    setMessage(null);
    if (onThisDevice) saveReminderSettings(next).catch(e => {
      console.error(e);
      setMessage({ tone: 'error', text: "Couldn't save that change. Check your connection." });
    });
  };

  const run = async (kind: 'enable' | 'disable' | 'test') => {
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'enable') {
        await enableReminders(settings);
        setOnThisDevice(true);
        setMessage({ tone: 'ok', text: 'Reminders are on for this device.' });
      } else if (kind === 'disable') {
        await disableReminders();
        setOnThisDevice(false);
        setMessage({ tone: 'ok', text: 'Reminders are off on this device.' });
      } else {
        const delivered = await sendTestReminder();
        setMessage(delivered
          ? { tone: 'ok', text: 'Test sent. It should arrive in a few seconds.' }
          : { tone: 'error', text: "The test couldn't be delivered. Turn reminders off and on again." });
      }
    } catch (e) {
      console.error(e);
      setMessage({ tone: 'error', text: e instanceof Error && e.message ? e.message : 'Something went wrong. Try again.' });
    } finally {
      setBusy(null);
    }
  };

  if (support === 'install') {
    return (
      <div className="rounded-[14px] bg-surface-sunken p-4 text-sm space-y-2">
        <p className="font-semibold">Add Vesta to your Home Screen first</p>
        <p className="text-muted">
          iPhone only allows reminders from apps on the Home Screen. In Safari, tap <Share size={14} className="inline -mt-0.5" aria-label="Share" /> then
          {' '}<span className="font-semibold text-main">Add to Home Screen</span>, open Vesta from there and come back to this page.
        </p>
      </div>
    );
  }
  if (support === 'unsupported') {
    return <p className="text-sm text-muted">This browser can't show reminders. Try Vesta on your phone's Home Screen, or in Chrome, Edge or Safari.</p>;
  }
  if (loading) {
    return <div className="h-32 rounded-[14px] bg-surface-sunken animate-pulse" aria-busy="true" aria-label="Loading reminders" />;
  }

  const timeInput = (value: string, onChange: (v: string) => void, label: string, disabled: boolean) => (
    <input
      type="time"
      value={value}
      onChange={e => e.target.value && onChange(e.target.value)}
      aria-label={label}
      disabled={disabled}
      className="input !min-h-10 !py-1.5 !px-3 w-[7.5rem] disabled:opacity-50"
    />
  );

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border rounded-[14px] border border-border">
        <li className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="icon-tile size-9 shrink-0 tile-calories flex items-center justify-center"><CookingPot size={18} aria-hidden="true" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Evening log reminder</p>
              <p className="text-sm text-muted">Only on days with nothing logged.</p>
            </div>
            <Switch checked={settings.log.enabled} onChange={v => change({ ...settings, log: { ...settings.log, enabled: v } })} label="Evening log reminder" />
          </div>
          <div className="pl-12">{timeInput(settings.log.time, v => change({ ...settings, log: { ...settings.log, time: v } }), 'Log reminder time', !settings.log.enabled)}</div>
        </li>
        <li className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="icon-tile size-9 shrink-0 tile-weight flex items-center justify-center"><Scale size={18} aria-hidden="true" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Weigh-in reminder</p>
              <p className="text-sm text-muted">Skipped if you've already weighed in.</p>
            </div>
            <Switch checked={settings.weighIn.enabled} onChange={v => change({ ...settings, weighIn: { ...settings.weighIn, enabled: v } })} label="Weigh-in reminder" />
          </div>
          <div className="pl-12 flex flex-wrap items-center gap-3">
            {timeInput(settings.weighIn.time, v => change({ ...settings, weighIn: { ...settings.weighIn, time: v } }), 'Weigh-in reminder time', !settings.weighIn.enabled)}
            <div className="flex gap-1" role="group" aria-label="Weigh-in days">
              {WEEKDAYS.map(({ day, short, label }) => {
                const on = settings.weighIn.days.includes(day);
                return (
                  <button
                    key={day}
                    aria-pressed={on}
                    aria-label={label}
                    disabled={!settings.weighIn.enabled}
                    onClick={() => {
                      const days = on ? settings.weighIn.days.filter(d => d !== day) : [...settings.weighIn.days, day];
                      if (days.length) change({ ...settings, weighIn: { ...settings.weighIn, days } });
                    }}
                    className={`size-8 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${on ? 'bg-ink text-on-ink' : 'bg-surface-sunken text-muted hover:text-main'}`}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </div>
        </li>
        <li className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="icon-tile size-9 shrink-0 tile-workout flex items-center justify-center"><Store size={18} aria-hidden="true" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Eating out check-in</p>
              <p className="text-sm text-muted">Asks what you had after a meal you planned out. Skipped once it's logged.</p>
            </div>
            <Switch checked={settings.eatingOut.enabled} onChange={v => change({ ...settings, eatingOut: { ...settings.eatingOut, enabled: v } })} label="Eating out check-in" />
          </div>
          <div className="pl-12 flex items-center gap-2">
            <label className="text-sm text-muted" htmlFor="eating-out-delay">After</label>
            <select
              id="eating-out-delay"
              value={settings.eatingOut.delayMinutes}
              disabled={!settings.eatingOut.enabled}
              onChange={e => change({ ...settings, eatingOut: { ...settings.eatingOut, delayMinutes: Number(e.target.value) } })}
              className="input !min-h-10 !py-1.5 !px-3 w-auto disabled:opacity-50"
            >
              {[60, 90, 120, 180].map(m => <option key={m} value={m}>{m / 60 >= 2 || m === 60 ? `${m / 60} h` : '1.5 h'}</option>)}
            </select>
            <span className="text-sm text-muted">after the meal's usual time</span>
          </div>
        </li>
      </ul>

      {message && (
        <p role={message.tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 text-sm ${message.tone === 'error' ? 'text-error' : ''}`}>
          {message.tone === 'error' ? <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> : <Check size={16} className="shrink-0 mt-0.5" aria-hidden="true" />}
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onThisDevice ? (
          <>
            <button onClick={() => run('test')} disabled={!!busy} className="btn-secondary btn-sm">
              {busy === 'test' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />} Send a test
            </button>
            <button onClick={() => run('disable')} disabled={!!busy} className="btn-ghost btn-sm">
              {busy === 'disable' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />} Turn off on this device
            </button>
          </>
        ) : (
          <button onClick={() => run('enable')} disabled={!!busy || (!settings.log.enabled && !settings.weighIn.enabled && !settings.eatingOut.enabled)} className="btn-secondary btn-sm">
            {busy === 'enable' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <BellRing size={16} aria-hidden="true" />} Turn on reminders
          </button>
        )}
      </div>
    </div>
  );
};
