import { useEffect, useRef, useState } from 'react';

/** Fired on window whenever a moment starts, so the Vesta mark's flame can flare along with it. */
export const MOMENT_EVENT = 'vesta:moment';

/**
 * True for a moment after `value` goes up while mounted (a goal turning true, a streak growing),
 * never on first render, so a small celebration plays only when it happens in front of the user.
 */
export function useMoment(value: number | boolean, ms = 1200): boolean {
  const n = Number(value);
  const previous = useRef(n);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const rose = n > previous.current;
    previous.current = n;
    if (!rose) return;
    setOn(true);
    window.dispatchEvent(new Event(MOMENT_EVENT));
    const timer = setTimeout(() => setOn(false), ms);
    return () => { clearTimeout(timer); setOn(false); };
  }, [n, ms]);

  return on;
}

/** True for `ms` after any useMoment fires anywhere in the app. */
export function useAnyMoment(ms = 1000): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      clearTimeout(timer);
      setOn(true);
      timer = setTimeout(() => setOn(false), ms);
    };
    window.addEventListener(MOMENT_EVENT, start);
    return () => { window.removeEventListener(MOMENT_EVENT, start); clearTimeout(timer); };
  }, [ms]);

  return on;
}
