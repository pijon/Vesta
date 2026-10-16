import { useCallback, useEffect, useRef, useState } from 'react';

/** How long `.is-closing` takes on `.modal-backdrop` / `.modal-panel` (index.css) */
const CLOSE_MS = 200;

/**
 * Lets a sheet play its exit animation before it unmounts: `close` sets `closing` (add
 * `is-closing` to the backdrop and panel) and calls `onClose` once the animation is over.
 */
export function useAnimatedClose(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const close = useCallback(() => {
    if (timer.current) return;
    setClosing(true);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => onCloseRef.current(), reduced ? 120 : CLOSE_MS);
  }, []);

  return { closing, close };
}
