import React from 'react';
import { DailySummary, WeightEntry } from '../types';
import { TrophyIcon } from './TrophyIcon';
import { StreakFlame } from './StreakFlame';

// --- Sub-components for Bento Grid ---

export const ActivityCard: React.FC<{ caloriesBurned: number; workoutsCompleted: number; workoutsGoal: number; history?: DailySummary[]; onAddWorkout: () => void; size?: 'sm' | 'md' }> = ({
    caloriesBurned, workoutsCompleted, workoutsGoal, history = [], onAddWorkout, size = 'md'
}) => {
    // Calculate Streak (Mock or from props if available - reusing history for now to infer simple streak)
    // Ideally this comes from stats, but for this widget we might need to pass it down.
    // For now, I'll infer "active today" based on caloriesBurned > 0.
    const isActive = caloriesBurned > 0;

    // We'll calculate a simple streak from history for display, or default to 0 if not provided
    // In a real app, 'streak' should be a prop. I'll assume 3 for demo or calculate from history.
    let currentStreak = 0;
    const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    // Simple mock logic for visualization if prop missing
    currentStreak = sortedHistory.length > 0 ? sortedHistory.length : 0;

    // Design System Tokens
    const TrophyClass = isActive ? "text-flame drop-shadow-md" : "text-charcoal/10 dark:text-white/5";

    return (
        <div className={`glass-card p-5 md:p-6 rounded-3xl flex flex-col justify-between ${size === 'sm' ? 'min-h-[160px]' : 'h-56'} group cursor-pointer hover:scale-[1.01] hover:shadow-xl dark:hover:border-white/20 transition-all duration-300 relative overflow-hidden`}>
            {/* Gradient Defs */}
            <svg width="0" height="0" className="absolute">
                <defs>
                    <linearGradient id="trophyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-flame)" />
                        <stop offset="100%" stopColor="var(--color-hearth)" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Header: Standard Bento Grid Header */}
            <div className="relative z-10 flex justify-between items-start w-full shrink-0">
                <h3 className="text-[10px] font-black text-charcoal/40 dark:text-stone-400 uppercase tracking-widest">Activity</h3>
                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddWorkout(); }}
                        className="bg-white/50 dark:bg-white/10 p-1.5 rounded-full text-hearth dark:text-hearth/90 hover:bg-white dark:hover:bg-white/20 hover:shadow-sm transition-all"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="3" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content Body: Trophy & Stats */}
            <div className="flex flex-row items-center justify-between flex-1 w-full relative z-0">
                {/* Left: Trophy Case */}
                <div className="flex-1 flex items-center justify-center h-full">
                    <div className={`relative transition-all duration-500 ${isActive ? 'scale-110' : 'scale-100 grayscale opacity-50'}`}>
                        <TrophyIcon className={`w-24 h-24 md:w-28 md:h-28 ${TrophyClass} transition-all duration-500`} />
                        {/* Glow effect for active state */}
                        {isActive && (
                            <div className="absolute inset-0 bg-hearth/20 blur-3xl rounded-full -z-10 animate-pulse"></div>
                        )}
                    </div>
                </div>

                {/* Right: Stats & Streak */}
                <div className="flex flex-col justify-center items-end h-full gap-4 pl-2 z-10">

                    {/* Streak Badge */}
                    <div className="flex items-center gap-1.5 bg-white/50 dark:bg-white/5 px-2.5 py-1 rounded-full border border-charcoal/5 dark:border-white/5 backdrop-blur-sm">
                        <StreakFlame className="w-3.5 h-3.5 text-flame" isActive={isActive} />
                        <span className="font-sans font-bold text-[10px] md:text-xs uppercase tracking-widest text-charcoal dark:text-stone-200">
                            {currentStreak} Day Streak
                        </span>
                    </div>

                    {/* Main Stats */}
                    <div className="text-right">
                        <div className="flex flex-col">
                            <span className="font-serif text-4xl md:text-5xl text-charcoal dark:text-stone-200 leading-none">
                                {caloriesBurned}
                            </span>
                            <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-charcoal/60 dark:text-stone-400 mt-0.5">
                                Active Kcal
                            </span>
                        </div>
                    </div>

                    {/* Secondary Stat */}
                    <div className="text-right opacity-80">
                        <p className="font-serif text-sm text-charcoal dark:text-stone-300">
                            {workoutsCompleted}/{workoutsGoal} <span className="text-[10px] font-sans text-charcoal/60 dark:text-stone-500 uppercase">Sessions</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const FastingCard: React.FC<{ elapsedString: string; startTime: string; progressPercent: number; isFasting: boolean; size?: 'sm' | 'md' }> = ({
    elapsedString, startTime, isFasting, size = 'md'
}) => {
    return (
        <div className={`glass-card p-4 md:p-6 rounded-3xl flex flex-col justify-between ${size === 'sm' ? 'min-h-[160px]' : 'h-56'} relative overflow-hidden group hover:scale-[1.02] hover:shadow-lg dark:hover:border-white/20 transition-all duration-300`}>
            <div className="relative z-10 w-full flex justify-between items-start">
                <h3 className="text-[10px] font-black text-charcoal/40 dark:text-stone-400 uppercase tracking-widest">Fasting</h3>
                {isFasting && (
                    <div className="flex items-center gap-1.5 bg-hearth/10 dark:bg-hearth/20 px-2 py-1 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-hearth animate-pulse"></div>
                        <span className="text-[10px] font-bold text-hearth">Active</span>
                    </div>
                )}
            </div>

            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center">
                <p className={`font-serif ${size === 'sm' ? 'text-3xl' : 'text-5xl'} text-charcoal dark:text-stone-100 transition-colors`}>
                    {elapsedString}
                </p>
                <p className="text-xs font-bold text-charcoal/40 dark:text-stone-500 uppercase tracking-wide mt-1">
                    {isFasting ? `Started ${startTime}` : 'Eating Window'}
                </p>
            </div>
        </div>
    );
};

export const CaloriesRemainingCard: React.FC<{
    caloriesRemaining: number;
    caloriesGoal: number;
    size?: 'sm' | 'md';
    onLogFood: () => void;
}> = ({ caloriesRemaining, caloriesGoal, size = 'md', onLogFood }) => {
    // Determine color based on remaining
    // If negative (over limit), show warning color
    const isOver = caloriesRemaining < 0;
    const absRemaining = Math.abs(caloriesRemaining);

    // Calculate consumed percentage for the glow height
    // If remaining is 500/2000, consumed is 1500 (75%)
    // If remaining is -200/2000, consumed is 2200 (110%)
    const consumed = caloriesGoal - caloriesRemaining;
    const percentConsumed = Math.min(100, (consumed / caloriesGoal) * 100);

    return (
        <div className={`glass-card p-4 md:p-6 rounded-3xl flex flex-col justify-between ${size === 'sm' ? 'min-h-[160px]' : 'h-56'} group cursor-pointer hover:scale-[1.02] hover:shadow-lg dark:hover:border-white/20 transition-all duration-300 relative overflow-hidden`}>
            {/* Ember Glow Background */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-0 transition-all duration-1000 ease-out bg-gradient-to-t ${isOver ? 'from-red-500/20 via-red-500/5 to-transparent' : 'from-hearth/30 via-hearth/5 to-transparent'}`}
                style={{ height: `${percentConsumed}%` }}
            ></div>

            <div className="relative z-10 flex justify-between items-start">
                <h3 className="text-[10px] font-black text-charcoal/40 dark:text-stone-400 uppercase tracking-widest">
                    {isOver ? 'Over Limit' : 'Remaining'}
                </h3>
                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onLogFood(); }}
                        className="bg-white/50 dark:bg-white/10 p-1.5 rounded-full text-hearth dark:text-hearth/90 hover:bg-white dark:hover:bg-white/20 hover:shadow-sm transition-all"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="3" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center pointer-events-none">
                <p className={`font-serif ${size === 'sm' ? 'text-2xl' : 'text-3xl'} ${isOver ? 'text-red-500' : 'text-charcoal dark:text-stone-200'} transition-colors`}>
                    {absRemaining}
                    <span className="text-xs font-sans font-normal opacity-40 dark:opacity-60 uppercase ml-1">kcal</span>
                </p>
                <p className="text-[10px] font-bold text-charcoal/40 dark:text-stone-500 mt-1">
                    Goal: {caloriesGoal}
                </p>
            </div>

            {/* Spacer to maintain flex layout structure if needed, though with absolute center it might not be strictly necessary, 
                but let's keep the flex behavior consistent or just remove the progress bar as requested. 
                The Header is at top. Consumed glow is background. Text is centered. 
                We don't need the bottom bar anymore. */}
        </div>
    );
};

export const HydrationCard: React.FC<{ liters: number; onAddWater: (amount: number) => void; goal?: number; size?: 'sm' | 'md' }> = ({
    liters, onAddWater, goal, size = 'md'
}) => {
    return (
        <div className={`relative glass-card rounded-3xl flex flex-col justify-between ${size === 'sm' ? 'min-h-[160px]' : 'h-56'} overflow-hidden group`}>
            {/* Liquid Fill Background */}
            <div
                className="absolute bottom-0 left-0 right-0 bg-ocean/20 dark:bg-ocean/30 transition-all duration-1000 ease-in-out z-0"
                style={{ height: `${Math.min((liters / (goal || 2.5)) * 100, 100)}%` }}
            >
                {/* Wave effect top border */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-ocean/40 to-transparent opacity-50"></div>
            </div>

            <div className={`relative z-10 p-4 md:p-6 flex flex-col justify-between h-full`}>
                <div className="flex justify-between items-start">
                    <h3 className="text-[10px] font-black text-charcoal/40 dark:text-stone-400 uppercase tracking-widest">Hydration</h3>
                </div>

                <div className="text-center py-2">
                    <p className={`font-serif ${size === 'sm' ? 'text-3xl' : 'text-4xl'} text-charcoal dark:text-stone-200`}>{parseFloat(liters.toFixed(2))}<span className="text-2xl opacity-60">L</span></p>
                </div>

                <div className="flex justify-between text-[10px] font-bold text-charcoal/60 dark:text-stone-400">
                    <button onClick={() => onAddWater(250)} className="hover:text-ocean transition-colors">+250ml</button>
                    <button onClick={() => onAddWater(500)} className="hover:text-ocean transition-colors">+500ml</button>
                </div>
            </div>
        </div>
    );
};

export const WeightCard: React.FC<{ weight: number; change: number; history: WeightEntry[]; daysToGoal?: number | null; onAddWeight: () => void; size?: 'sm' | 'md' }> = ({ weight, change, history, daysToGoal, onAddWeight, size = 'md' }) => {
    // Sort history by date ascending
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Take last 7 days or more if available, ensure at least 2 points
    const dataPoints = sortedHistory.slice(-14); // Last 14 entries

    // Graph Dimensions
    const WIDTH = 100;
    const HEIGHT = 40;
    const PADDING = 5;

    let pathD = "";
    let endPoint = { x: 0, y: 0 };

    if (dataPoints.length > 1) {
        const minWeight = Math.min(...dataPoints.map(d => d.weight)) - 0.5;
        const maxWeight = Math.max(...dataPoints.map(d => d.weight)) + 0.5;
        const weightRange = maxWeight - minWeight;

        const points = dataPoints.map((d, index) => {
            const x = (index / (dataPoints.length - 1)) * WIDTH;
            const normalizedY = (d.weight - minWeight) / weightRange;
            const y = HEIGHT - (normalizedY * (HEIGHT - PADDING * 2) + PADDING); // Invert Y
            return { x, y };
        });

        // Generate smooth curve (Catmull-Rom or simple line for now)
        // Using simple quadratic bezier smoothing or just straight lines
        // For sparkline aesthetic, simple bezier curve is nice
        pathD = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            pathD += ` Q ${points[i].x} ${points[i].y}, ${midX} ${midY}`;
        }
        pathD += ` T ${points[points.length - 1].x} ${points[points.length - 1].y}`;

        endPoint = points[points.length - 1];

    } else {
        // Fallback for single point
        pathD = `M 0 ${HEIGHT / 2} L ${WIDTH} ${HEIGHT / 2}`;
        endPoint = { x: WIDTH, y: HEIGHT / 2 };
    }

    return (
        <div className={`glass-card p-4 md:p-6 rounded-3xl ${size === 'sm' ? 'min-h-[160px]' : 'h-56'} group cursor-pointer hover:scale-[1.02] hover:shadow-lg dark:hover:border-white/20 transition-all duration-300 relative overflow-hidden`}>
            <div className="relative z-10 flex justify-between items-center mb-2">
                <h3 className="text-[10px] font-black text-charcoal/40 dark:text-stone-400 uppercase tracking-widest">Weight</h3>
                <div className="flex gap-2 items-center">
                    <span className={`text-[10px] font-bold ${change <= 0 ? 'text-sage' : 'text-flame'}`}>
                        {change > 0 ? '+' : ''}{change}/week
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddWeight(); }}
                        className="bg-white/50 dark:bg-white/10 p-1.5 rounded-full text-sage dark:text-sage/90 hover:bg-white dark:hover:bg-white/20 hover:shadow-sm transition-all"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeWidth="3" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="absolute inset-0 z-0 flex flex-col items-center justify-center text-center">
                <p className={`font-serif ${size === 'sm' ? 'text-2xl' : 'text-3xl'} text-charcoal dark:text-stone-200`}>{weight} <span className="text-xs font-sans font-normal opacity-40 dark:opacity-60 uppercase">kg</span></p>
                {daysToGoal !== undefined && daysToGoal !== null ? (
                    <p className="text-[10px] font-bold text-sage mt-0.5">{daysToGoal} days to goal</p>
                ) : null}
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-32 w-full opacity-80 pointer-events-none">
                <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    {/* Gradient Definition */}
                    <defs>
                        <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {/* Fill Area (Path + bottom lines for closing) */}
                    <path d={`${pathD} V ${HEIGHT} H 0 Z`} fill="url(#weightGrad)" stroke="none" />

                    {/* The Line */}
                    <path d={pathD} fill="none" stroke="var(--color-sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Endpoint Dot */}
                    <circle cx={endPoint.x} cy={endPoint.y} r="2" fill="var(--color-sage)" className="animate-pulse" />
                </svg>
            </div>
        </div>
    );
};
