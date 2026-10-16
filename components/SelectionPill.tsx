import React, { useLayoutEffect, useRef } from 'react';

/** Where each control's pill was last seen, so the next one can slide from there */
const lastRects = new Map<string, DOMRect>();

/**
 * The ink pill behind the selected item of a tab bar, sidebar or segmented control. Render it inside
 * the selected item only, with one `group` per control (`useId()` when the control can appear more
 * than once), and give the control `pill-group`: the pill then glides from item to item.
 *
 * The slide is a Web Animation on transform, so it runs off the main thread and keeps moving while
 * the newly selected page renders (a JS-driven animation would stall and jump).
 */
export const SelectionPill: React.FC<{ group: string }> = ({ group }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const to = el.getBoundingClientRect();
    const from = lastRects.get(group);
    lastRects.set(group, to);
    // Measured again on the way out, in case the page scrolled since
    const remember = () => lastRects.set(group, el.getBoundingClientRect());
    if (!from || !from.width || !to.width || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return remember;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return remember;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})` },
        { transform: 'none' },
      ],
      { duration: 360, easing: 'cubic-bezier(0.3, 1.15, 0.4, 1)' },
    );
    return remember;
  }, [group]);

  return <span ref={ref} aria-hidden="true" className="selection-pill" />;
};
