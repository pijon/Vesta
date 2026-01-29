import React from 'react';
import { motion } from 'framer-motion';

export const StreakFlame: React.FC<{
    className?: string;
    isActive?: boolean;
}> = ({ className = "w-6 h-6", isActive = false }) => {
    return (
        <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            animate={isActive ? {
                scale: [1, 1.1, 1],
                filter: [
                    "drop-shadow(0px 0px 2px rgba(224, 122, 95, 0.3))",
                    "drop-shadow(0px 0px 6px rgba(224, 122, 95, 0.6))",
                    "drop-shadow(0px 0px 2px rgba(224, 122, 95, 0.3))"
                ]
            } : {}}
            transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
            }}
        >
            <path
                d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.38-1.12-2.5-2.5-2.5a2.5 2.5 0 0 0-2.5 2.5z"
                fill={isActive ? "currentColor" : "none"}
                className={isActive ? "text-flame" : "text-charcoal/20 dark:text-stone-700"}
                stroke="none"
            />
            <path
                d="M12 2c0 0-6 5-6 11a6 6 0 1 0 12 0c0-6-6-11-6-11z"
                className={isActive ? "text-hearth" : "text-charcoal/20 dark:text-stone-700"}
                stroke={isActive ? "currentColor" : "currentColor"}
                fill={isActive ? "url(#flameGradient)" : "none"}
            />

            <defs>
                <linearGradient id="flameGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-flame)" />
                    <stop offset="100%" stopColor="var(--color-hearth)" />
                </linearGradient>
            </defs>
        </motion.svg>
    );
};
