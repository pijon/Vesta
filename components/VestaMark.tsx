import React from 'react';
import { useAnyMoment } from '../hooks/useMoment';

/** The Vesta mark: the hearth as two shapes, a butter flame over a cream bowl, on a tomato tile.
 *  The flame lights and then flickers (`.vesta-flame` in index.css), and flares when a goal is
 *  hit (`.vesta-flare`, on a wrapper so the flicker keeps running underneath). */
export const VestaMark: React.FC<{ className?: string }> = ({ className = 'size-9' }) => {
  const flaring = useAnyMoment();
  return (
    <svg viewBox="0 0 100 100" className={`shrink-0 ${flaring ? 'is-flaring' : ''} ${className}`} aria-hidden="true">
      <rect width="100" height="100" rx="30" fill="#FF5533" />
      <g className="vesta-flare">
        <path d="M50 13 C61 26 69 34 69 46 C69 55 61 60 50 60 C39 60 31 55 31 46 C31 38 35 33 41 27 C42 35 45 39 48 40 C46 31 47 22 50 13 Z" fill="#FFD23F" className="vesta-flame" />
      </g>
      <path d="M19 55 H81 C81 74 67 85 50 85 C33 85 19 74 19 55 Z" fill="#FFF1D6" />
    </svg>
  );
};
