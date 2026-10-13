import React from 'react';
import { DailySummary } from '../types';
import { StreakFlame } from './StreakFlame';

// --- Today metric tiles (direction C) ---
// Each tile is a tint (tile-*) with its metric's *-text colour, a big figure,
// a caption, an optional mini ring and one quick action.

type TileSize = 'sm' | 'md';

const MiniRing: React.FC<{ percent: number; color: string; label: string }> = ({ percent, color, label }) => {
    const size = 40;
    const stroke = 5;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.min(Math.max(percent, 0), 100);
    return (
        <svg width={size} height={size} className="shrink-0 -rotate-90" role="img" aria-label={label}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} stroke="var(--surface)" />
            <circle
                cx={size / 2} cy={size / 2} r={radius}
                fill="none" strokeWidth={stroke} strokeLinecap="round"
                stroke={color}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - clamped / 100)}
                style={{ '--ring-empty': circumference } as React.CSSProperties}
                className="ring-fill transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
            />
        </svg>
    );
};

const QuickAction: React.FC<{ onClick: () => void; children: React.ReactNode; label?: string }> = ({ onClick, children, label }) => (
    <button
        onClick={onClick}
        aria-label={label}
        className="relative z-[1] min-h-9 px-3 rounded-full bg-surface text-sm font-bold whitespace-nowrap active:scale-[0.98] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    >
        {children}
    </button>
);

/** Makes a whole tile open its detail view. A full-size button under the content, since the tile already holds a quick action button. */
const TileLink: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        onClick={onClick}
        aria-label={label}
        className="absolute inset-0 rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    />
);

const tileHeight = (size: string) => (size === 'sm' ? 'min-h-[144px]' : 'min-h-[176px]');

export const ActivityCard: React.FC<{ caloriesBurned: number; workoutsCompleted: number; workoutsGoal: number; history?: DailySummary[]; onAddWorkout: () => void; onClick?: () => void; size?: TileSize; streak?: number }> = ({
    caloriesBurned, workoutsCompleted, workoutsGoal, onAddWorkout, onClick, size = 'md', streak = 0
}) => {
    const isActive = workoutsCompleted > 0;
    return (
        <div className={`tile tile-workout gap-1 relative ${tileHeight(size)}`}>
            {onClick && <TileLink onClick={onClick} label="Workout overview" />}
            <div className="flex justify-between items-start gap-2">
                <h3 className="font-sans text-sm font-semibold text-workout-text">Workouts</h3>
                {streak > 0 && (
                    <span className="badge badge-fasting whitespace-nowrap" aria-label={`${streak}-day streak`}>
                        <StreakFlame className="w-3.5 h-3.5" isActive={isActive} />
                        {streak} {streak === 1 ? 'day' : 'days'}
                    </span>
                )}
            </div>
            <p className="text-2xl font-display font-extrabold leading-7">
                {workoutsCompleted}
                <span className="text-sm font-semibold">
                    {workoutsCompleted > workoutsGoal ? ` workout${workoutsCompleted === 1 ? '' : 's'}` : ` of ${workoutsGoal}`}
                </span>
            </p>
            <p className="text-xs font-semibold">
                {caloriesBurned > 0 ? `${caloriesBurned} kcal burned` : 'No activity yet'}
            </p>
            <div className="mt-auto pt-2">
                <QuickAction onClick={onAddWorkout}>Log</QuickAction>
            </div>
        </div>
    );
};

/** Time since the last meal against the fasting target, and when the target is reached. */
export const FastingCard: React.FC<{ elapsedHours: number; targetHours: number; lastAteTime: number | null; size?: TileSize }> = ({
    elapsedHours, targetHours, lastAteTime, size = 'md'
}) => {
    const fmtDuration = (hours: number) => `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
    const reached = !!lastAteTime && elapsedHours >= targetHours;
    const doneAt = lastAteTime
        ? new Date(lastAteTime + targetHours * 3_600_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;
    const percent = targetHours > 0 ? Math.min((elapsedHours / targetHours) * 100, 100) : 0;
    return (
        <div className={`tile tile-fasting gap-1 ${tileHeight(size)}`}>
            <div className="flex justify-between items-start gap-2">
                <h3 className="font-sans text-sm font-semibold text-fasting-text">Fasting</h3>
                {lastAteTime && <MiniRing percent={percent} color="var(--fasting)" label={`${Math.round(percent)}% of ${targetHours}-hour fast`} />}
            </div>
            <p className="text-2xl font-display font-extrabold leading-7">
                {lastAteTime ? fmtDuration(elapsedHours) : '–'}
                {lastAteTime && <span className="text-sm font-semibold"> of {targetHours}h</span>}
            </p>
            <p className="text-xs font-semibold">
                {!lastAteTime ? 'Starts after your next meal' : reached ? 'Target reached' : `Done at ${doneAt}`}
            </p>
        </div>
    );
};

export const HydrationCard: React.FC<{ liters: number; onAddWater: (amount: number) => void; goal?: number; size?: TileSize }> = ({
    liters, onAddWater, goal = 2.5, size = 'md'
}) => {
    const percent = goal > 0 ? (liters / goal) * 100 : 0;
    return (
        <div className={`tile tile-water gap-1 ${tileHeight(size)}`}>
            <div className="flex justify-between items-start gap-2">
                <h3 className="font-sans text-sm font-semibold text-water-text">Water</h3>
                <MiniRing percent={percent} color="var(--water)" label={`${Math.round(percent)}% of water goal`} />
            </div>
            <p className="text-2xl font-display font-extrabold leading-7">
                {parseFloat(liters.toFixed(2))}<span className="text-sm font-semibold"> L</span>
            </p>
            <p className="text-xs font-semibold">of {goal} L</p>
            <div className="mt-auto pt-2 flex gap-1.5">
                <QuickAction onClick={() => onAddWater(250)} label="Add 250 millilitres">+250 ml</QuickAction>
                {size !== 'sm' && (
                    <span className="hidden md:block">
                        <QuickAction onClick={() => onAddWater(500)} label="Add 500 millilitres">+500 ml</QuickAction>
                    </span>
                )}
            </div>
        </div>
    );
};

/** Latest weight with the same trend as Analytics, the change since the previous weigh-in and a sparkline. */
export const WeightCard: React.FC<{
    /** Smoothed trend weight (falls back to the latest weigh-in) */
    weight: number | null;
    /** kg per week over the last month, when there are enough weigh-ins */
    ratePerWeek: number | null;
    /** Latest scale reading and its date */
    scale: number | null;
    lastDate: string | null;
    /** Daily trend values for the sparkline, oldest first */
    trend: number[];
    onAddWeight: () => void;
    onClick?: () => void;
    size?: TileSize;
}> = ({ weight, ratePerWeek, scale, lastDate, trend, onAddWeight, onClick, size = 'md' }) => {
    const dataPoints = trend.map(weight => ({ weight }));
    // Sign from the rounded value, so −0.04 reads ±0.0 rather than −0.0
    const signed = (n: number, digits = 1) => {
        const r = Number(n.toFixed(digits));
        return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toFixed(digits)}`;
    };

    // Sparkline
    const WIDTH = 100;
    const HEIGHT = 28;
    const PADDING = 3;
    let pathD = `M 0 ${HEIGHT / 2} L ${WIDTH} ${HEIGHT / 2}`;
    if (dataPoints.length > 1) {
        const min = Math.min(...dataPoints.map(d => d.weight)) - 0.5;
        const max = Math.max(...dataPoints.map(d => d.weight)) + 0.5;
        const points = dataPoints.map((d, i) => ({
            x: (i / (dataPoints.length - 1)) * WIDTH,
            y: HEIGHT - (((d.weight - min) / (max - min)) * (HEIGHT - PADDING * 2) + PADDING)
        }));
        pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }

    const lastLabel = lastDate ? new Date(lastDate + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;

    return (
        <div className={`tile tile-weight gap-1 relative ${tileHeight(size)}`}>
            {onClick && <TileLink onClick={onClick} label="Weight trends" />}
            <div className="flex justify-between items-start gap-2">
                <h3 className="font-sans text-sm font-semibold text-weight-text">Weight</h3>
                {ratePerWeek !== null && (
                    <span className="text-xs font-semibold whitespace-nowrap" title="Trend over the last month">{signed(ratePerWeek)} kg/wk</span>
                )}
            </div>
            <p className="text-2xl font-display font-extrabold leading-7">
                {weight !== null ? weight.toFixed(1) : '–'}<span className="text-sm font-semibold"> kg</span>
            </p>
            <p className="text-xs font-semibold" title={scale !== null && lastLabel ? `Last weigh-in ${scale.toFixed(1)} kg on ${lastLabel}. The trend smooths out day-to-day water changes.` : undefined}>
                {weight === null ? 'No weigh-ins yet'
                    : scale !== null ? `Trend · scale ${scale.toFixed(1)}`
                    : `Weighed ${lastLabel}`}
            </p>
            {size !== 'sm' && (
                <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-7 mt-1" preserveAspectRatio="none" aria-hidden="true">
                    <path d={pathD} fill="none" stroke="var(--weight)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
            )}
            <div className="mt-auto pt-2">
                <QuickAction onClick={onAddWeight}>Update</QuickAction>
            </div>
        </div>
    );
};
