import React from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
    progress: number; // 0 to 100 (can go over 100 for some logic, but visualized as max 100 typically)
    size?: number;
    strokeWidth?: number;
    icon?: React.ReactNode;
    label?: string;
    subLabel?: string;
    gradientId: string;
    gradientColors: [string, string]; // [startColor, endColor]
    trackColor?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
    progress,
    size = 120,
    strokeWidth = 10,
    icon,
    label,
    subLabel,
    gradientId,
    gradientColors,
    trackColor = "var(--border)"
}) => {
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;

    // Cap progress visual at 100 for the main ring, unless we want to show overage.
    // Usually rings just fill up.
    const normalizedProgress = Math.min(100, Math.max(0, progress));
    const offset = circumference - (normalizedProgress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>

            {/* SVG Container */}
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="rotate-[-90deg]" // Start from top
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={gradientColors[0]} />
                        <stop offset="100%" stopColor={gradientColors[1]} />
                    </linearGradient>
                </defs>

                {/* Background Track */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />

                {/* Progress Circle (Animated) */}
                <motion.circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
            </svg>

            {/* Center Content (Absolute) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                {icon && <div className="mb-1 text-slate-700 dark:text-slate-200">{icon}</div>}
                {label && <div className="text-xl font-bold leading-none font-serif text-slate-800 dark:text-white">{label}</div>}
                {subLabel && <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">{subLabel}</div>}
            </div>
        </div>
    );
};
