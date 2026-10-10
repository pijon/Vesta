import React, { useLayoutEffect, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';

/**
 * ResponsiveContainer that knows its size before the first paint. Recharts measures in an
 * effect (after paint), so a page shown from a hidden Activity drew empty charts for a few
 * frames. Measuring here in a layout effect lets the chart render in the same frame.
 */
export const ChartContainer: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    if (size || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    if (width > 0 && height > 0) setSize({ width, height });
  });

  return (
    <div ref={ref} className="w-full h-full">
      {size && (
        <ResponsiveContainer width="100%" height="100%" initialDimension={size}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
};
