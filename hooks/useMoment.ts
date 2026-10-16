import { useEffect, useRef, useState } from 'react';

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
    const timer = setTimeout(() => setOn(false), ms);
    return () => { clearTimeout(timer); setOn(false); };
  }, [n, ms]);

  return on;
}
