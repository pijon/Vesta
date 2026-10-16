import React, { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString();

/**
 * A figure that counts to its new value when it changes (it shows the value as is on first render).
 * Screen readers get only the final value.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, format = defaultFormat }) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (reduce || current.current === value) {
      current.current = value;
      setShown(value);
      return;
    }
    const controls = animate(current.current, value, {
      duration: 0.6,
      ease: [0.22, 0.8, 0.3, 1],
      onUpdate: v => { current.current = v; setShown(v); },
    });
    return () => controls.stop();
  }, [value, reduce]);

  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
};
