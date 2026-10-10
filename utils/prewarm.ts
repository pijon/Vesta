import { useEffect, useSyncExternalStore } from 'react';

/**
 * Background data for pages that aren't on screen yet. App starts each loader shortly after
 * sign-in; pages read the result with usePrewarmed, so a page pre-rendered in a hidden
 * Activity fills in with real data before it's shown (no "no data yet" or loading flash).
 */
export interface Prewarm<T> {
  key: string;
  load: () => Promise<T>;
  /** Re-fetch in the background when a page shows data older than this */
  maxAgeMs: number;
}

interface Entry { value?: unknown; at: number; inFlight?: Promise<unknown> }

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const defineWarm = <T,>(key: string, load: () => Promise<T>, maxAgeMs = 60_000): Prewarm<T> => ({ key, load, maxAgeMs });

/** Last loaded value, if any. */
export const peekWarm = <T,>(warm: Prewarm<T>): T | undefined => entries.get(warm.key)?.value as T | undefined;

/** Loads unless a fresh value or a load in progress exists; resolves with the newest value. */
export const ensureWarm = <T,>(warm: Prewarm<T>, force = false): Promise<T> => {
  const entry = entries.get(warm.key);
  if (entry?.inFlight) return entry.inFlight as Promise<T>;
  if (!force && entry && 'value' in entry && Date.now() - entry.at < warm.maxAgeMs) return Promise.resolve(entry.value as T);

  const inFlight = warm.load().then(
    value => {
      entries.set(warm.key, { value, at: Date.now() });
      notify();
      return value;
    },
    error => {
      const previous = entries.get(warm.key);
      entries.set(warm.key, { value: previous?.value, at: previous?.at ?? 0 });
      throw error;
    },
  );
  entries.set(warm.key, { ...entry, at: entry?.at ?? 0, inFlight });
  return inFlight;
};

/** Forget everything (sign-out). */
export const clearWarm = () => { entries.clear(); notify(); };

/**
 * The warm value for a page (undefined until first loaded). Each time the page is shown the
 * value is refreshed in the background if stale; the old value stays on screen meanwhile.
 */
export const usePrewarmed = <T,>(warm: Prewarm<T>): T | undefined => {
  const value = useSyncExternalStore(subscribe, () => peekWarm(warm));
  useEffect(() => {
    ensureWarm(warm).catch(e => console.error(`Failed to load ${warm.key}`, e));
  }, [warm]);
  return value;
};
