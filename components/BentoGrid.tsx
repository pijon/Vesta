import React from 'react';
import { DailySummary } from '../types';
import { StreakFlame } from './StreakFlame';
import { addDays } from '../utils/planUtils';
import { MAX_PLAUSIBLE_FAST_HOURS } from '../constants';

// --- Today metric tiles (direction C) ---
// Each tile is a tint (tile-*) with its metric's *-text colour, a big figure,
// a caption, an optional small chart and one quick action.

type TileSize = 'sm' | 'md';

const QuickAction: React.FC<{ onClick: () => void; children: React.ReactNode; label?: string }> = ({ onClick, children, label }) => (
    <button
        onClick={onClick}
        aria-label={label}
        className="hit-target z-[1] min-h-9 px-3 rounded-full bg-surface text-sm font-bold whitespace-nowrap active:scale-[0.98] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
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

/** The last seven days, oldest first, ending today. Days with no summary are null. */
const lastSevenDays = (history: DailySummary[], today: string) => {
    const byDate = new Map(history.map(s => [s.date, s]));
    return Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i - 6);
        return { date, summary: byDate.get(date) ?? null };
    });
};

const weekdayName = (date: string) => new Date(date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short' });

/** Today's calories burned and what you did, with the last week as bars */
export const ActivityCard: React.FC<{ caloriesBurned: number; workoutTypes: string[]; history?: DailySummary[]; today: string; onAddWorkout: () => void; onClick?: () => void; size?: TileSize; streak?: number }> = ({
    caloriesBurned, workoutTypes, history = [], today, onAddWorkout, onClick, size = 'md', streak = 0
}) => {
    const isActive = workoutTypes.length > 0;
    const week = lastSevenDays(history, today);
    const peak = Math.max(...week.map(d => d.summary?.caloriesBurned ?? 0), 1);
    const activeDays = week.filter(d => (d.summary?.workoutCount ?? 0) > 0).length;
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
                {isActive ? <>{caloriesBurned}<span className="text-sm font-semibold"> kcal</span></> : '–'}
            </p>
            <p className="text-xs font-semibold truncate">
                {isActive ? [...new Set(workoutTypes)].join(', ') : 'Nothing logged yet'}
            </p>
            {size !== 'sm' && (
                <div className="mt-2 flex items-end gap-1 h-9" role="img" aria-label={`Active ${activeDays} of the last 7 days`}>
                    {week.map(({ date, summary }) => {
                        const kcal = summary?.caloriesBurned ?? 0;
                        const moved = (summary?.workoutCount ?? 0) > 0;
                        const isToday = date === today;
                        return (
                            <div
                                key={date}
                                title={`${weekdayName(date)}: ${moved ? `${summary!.workoutCount} workout${summary!.workoutCount === 1 ? '' : 's'}, ${kcal} kcal` : 'rest day'}`}
                                className="flex-1 rounded-[4px] transition-[height] duration-700 ease-out motion-reduce:transition-none"
                                style={{
                                    height: moved ? `${Math.max(30, (kcal / peak) * 100)}%` : '4px',
                                    background: moved ? (isToday ? 'currentColor' : 'var(--workout)') : 'var(--surface)',
                                }}
                            />
                        );
                    })}
                </div>
            )}
            <div className="mt-auto pt-2">
                <QuickAction onClick={onAddWorkout}>Log</QuickAction>
            </div>
        </div>
    );
};

/** Where the current fast is, in words */
const fastingStage = (hours: number, target: number) => {
    if (hours >= target) return 'Target reached';
    if (hours < 4) return 'Digesting';
    if (hours >= target - 2) return 'Almost there';
    return 'Going strong';
};

/** A progress bar with a marker at the current point and one line under it */
const TimelineTrack: React.FC<{ percent: number; done: boolean; caption: string; label: string }> = ({ percent, done, caption, label }) => {
    const at = `${Math.max(Math.min(percent, 100), 4)}%`;
    return (
        <div className="mt-1.5" role="img" aria-label={label}>
            <div className="relative h-2.5 rounded-full bg-surface">
                <div
                    className="ring-fill absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                    style={{ width: at, background: 'var(--fasting)' }}
                />
                {!done && (
                    <div
                        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-surface"
                        style={{ left: at, borderColor: 'var(--fasting)' }}
                        aria-hidden="true"
                    />
                )}
            </div>
            <p className="mt-1.5 text-xs font-semibold" aria-hidden="true">{caption}</p>
        </div>
    );
};

/**
 * The overnight fast. Before the first meal of the day it counts the fast live. Once you've eaten, the
 * timer would only restart at every meal, so until the eating window closes it shows last night's fast
 * and the window instead: from the first meal to the time to stop eating to reach the target by the
 * same time tomorrow. After that the live timer takes over again.
 */
export const FastingCard: React.FC<{
    elapsedHours: number;
    targetHours: number;
    lastAteTime: number | null;
    /** When today's first meal (one that breaks a fast) was logged, or null if none yet */
    firstMealTime: number | null;
    history?: DailySummary[];
    today: string;
    size?: TileSize;
}> = ({ elapsedHours, targetHours, lastAteTime, firstMealTime, history = [], today, size = 'md' }) => {
    const fmtDuration = (hours: number) => `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
    const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Skip gaps too long to be a real fast (usually days nothing was logged), as Analytics does
    const plausible = (h: number) => (h <= MAX_PLAUSIBLE_FAST_HOURS ? h : 0);

    // Today's fast is the one that ended at the first meal; before that, the one still running
    const week = lastSevenDays(history, today).map(({ date, summary }) => {
        const live = date === today && lastAteTime && firstMealTime === null ? plausible(elapsedHours) : 0;
        const hours = Math.max(plausible(summary?.maxFastingHours ?? 0), live);
        return { date, hours, hit: hours >= targetHours };
    });
    const hits = week.filter(d => d.hit).length;
    const lastNight = week[week.length - 1].hours;

    const windowHours = 24 - targetHours;
    const closesAt = firstMealTime !== null && windowHours > 0 ? firstMealTime + windowHours * 3_600_000 : null;
    const inWindow = closesAt !== null && Date.now() < closesAt;

    let stage: string | null = null;
    let figure: React.ReactNode = '–';
    let body: React.ReactNode = <p className="text-xs font-semibold">Starts after your next meal</p>;
    if (inWindow) {
        stage = 'Last night';
        figure = lastNight > 0 ? fmtDuration(lastNight) : '–';
        body = (
            <TimelineTrack
                percent={((Date.now() - firstMealTime!) / (windowHours * 3_600_000)) * 100}
                done={false}
                caption={`Eat until ${fmtTime(closesAt!)}`}
                label={`Fasted ${fmtDuration(lastNight)} last night. Eating window from ${fmtTime(firstMealTime!)}; stop eating by ${fmtTime(closesAt!)} to fast ${targetHours} hours by the same time tomorrow.`}
            />
        );
    } else if (lastAteTime) {
        const reached = elapsedHours >= targetHours;
        const doneAt = fmtTime(lastAteTime + targetHours * 3_600_000);
        const percent = targetHours > 0 ? (elapsedHours / targetHours) * 100 : 0;
        stage = fastingStage(elapsedHours, targetHours);
        figure = <>{fmtDuration(elapsedHours)}<span className="text-sm font-semibold"> of {targetHours}h</span></>;
        body = (
            <TimelineTrack
                percent={percent}
                done={reached}
                caption={reached ? `Since ${fmtTime(lastAteTime)}` : `Done at ${doneAt}`}
                label={`${Math.round(Math.min(percent, 100))}% of ${targetHours}-hour fast${reached ? '' : `, done at ${doneAt}`}`}
            />
        );
    }

    return (
        <div className={`tile tile-fasting gap-1 ${tileHeight(size)}`}>
            <div className="flex justify-between items-baseline gap-2">
                <h3 className="font-sans text-sm font-semibold text-fasting-text">Fasting</h3>
                {stage && <span className="text-xs font-semibold whitespace-nowrap">{stage}</span>}
            </div>
            <p className="text-2xl font-display font-extrabold leading-7">{figure}</p>
            {body}
            {size !== 'sm' && (
                <div className="mt-auto pt-2 flex items-center gap-2">
                    <div className="flex gap-1" role="img" aria-label={`Target reached ${hits} of the last 7 days`}>
                        {week.map(({ date, hit }) => (
                            <span
                                key={date}
                                title={`${weekdayName(date)}: ${hit ? 'target reached' : 'not reached'}`}
                                className="size-2.5 rounded-full"
                                style={{ background: hit ? 'var(--fasting)' : 'var(--surface)' }}
                            />
                        ))}
                    </div>
                    <span className="text-xs font-semibold whitespace-nowrap">{hits} of 7</span>
                </div>
            )}
        </div>
    );
};

/**
 * A water bottle filled to `fill` (0 to 1), with a notch outside it at every half litre. The level rises from empty
 * each time the page is shown and moves when water is added; the surface sloshes once on each change.
 */
const WaterBottle: React.FC<{ fill: number; goal: number }> = ({ fill, goal }) => {
    const clipId = `bottle-${React.useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const body = 'M15 8 H25 V12 C25 15 36 16 36 24 V84 Q36 90 30 90 H10 Q4 90 4 84 V24 C4 16 15 15 15 12 Z';
    // The water runs from the base (y 88) to the shoulder (y 20)
    const levelAt = (share: number) => 88 - 68 * Math.min(Math.max(share, 0), 1);
    const marks = Array.from({ length: Math.max(Math.ceil(goal / 0.5) - 1, 0) }, (_, i) => levelAt(((i + 1) * 0.5) / goal));
    return (
        <svg viewBox="0 0 40 92" className="w-[38px] h-[88px] shrink-0 mr-1 overflow-visible" aria-hidden="true">
            <defs>
                <clipPath id={clipId}><path d={body} /></clipPath>
            </defs>
            <rect x="14" y="1" width="12" height="6" rx="1.5" fill="var(--water)" />
            <path d={body} fill="var(--surface)" />
            <g clipPath={`url(#${clipId})`}>
                <g
                    className="water-level"
                    style={{ transform: `translateY(${levelAt(fill)}px)`, '--water-empty': '90px' } as React.CSSProperties}
                >
                    {/* Two wave periods wider than the bottle, so a one-period slide reads as a slosh */}
                    <path
                        key={fill}
                        className="water-slosh"
                        d="M-20 0 q5 -2.5 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 V80 H-20 Z"
                        fill="var(--water)"
                    />
                </g>
            </g>
            {marks.map(y => <line key={y} x1="38.5" x2="42" y1={y} y2={y} stroke="var(--water)" strokeWidth="1.5" strokeLinecap="round" />)}
            <line x1="9" x2="9" y1="30" y2="70" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" />
            <path d={body} fill="none" stroke="var(--water)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
    );
};

/** How today's water compares with the goal spread evenly over 7:00 to 21:00, or null early on with nothing drunk */
const waterPace = (liters: number, goal: number, now = new Date()) => {
    if (liters >= goal) return 'Goal reached';
    const dayShare = Math.min(Math.max((now.getHours() + now.getMinutes() / 60 - 7) / 14, 0), 1);
    if (dayShare === 0 && liters === 0) return null;
    return liters >= goal * dayShare - 0.25 ? 'On track' : 'Top up';
};

/** Today's water as glasses filling up, with the pace against the time of day */
export const HydrationCard: React.FC<{ liters: number; onAddWater: (amount: number) => void; goal?: number; size?: TileSize }> = ({
    liters, onAddWater, goal = 2.5, size = 'md'
}) => {
    const pace = waterPace(liters, goal);
    const left = parseFloat((goal - liters).toFixed(2));
    return (
        <div className={`tile tile-water gap-1 ${tileHeight(size)}`}>
            <div className="flex justify-between items-baseline gap-2">
                <h3 className="font-sans text-sm font-semibold text-water-text">Water</h3>
                {pace && <span className="text-xs font-semibold whitespace-nowrap">{pace}</span>}
            </div>
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <p className="text-2xl font-display font-extrabold leading-7">
                        {parseFloat(liters.toFixed(2))}<span className="text-sm font-semibold"> of {goal} L</span>
                    </p>
                    {left > 0 && <p className="text-xs font-semibold mt-1">{left} L to go</p>}
                </div>
                {size !== 'sm' && <WaterBottle fill={goal > 0 ? liters / goal : 0} goal={goal} />}
            </div>
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

/**
 * Latest trend weight (as on Analytics), how far it is to the goal, and the last month as a chart:
 * the trend line, each weigh-in as a dot, today marked, and a dashed week ahead at the current pace.
 */
export const WeightCard: React.FC<{
    /** Smoothed trend weight (falls back to the latest weigh-in) */
    weight: number | null;
    /** kg per week over the last month, when there are enough weigh-ins */
    ratePerWeek: number | null;
    /** Latest scale reading and its date */
    scale: number | null;
    lastDate: string | null;
    /** Daily trend values for the chart, oldest first */
    trend: { date: string; weight: number }[];
    /** Scale readings over the same days */
    readings: { date: string; weight: number }[];
    goalWeight: number;
    today: string;
    onAddWeight: () => void;
    onClick?: () => void;
    size?: TileSize;
}> = ({ weight, ratePerWeek, scale, lastDate, trend, readings, goalWeight, today, onAddWeight, onClick, size = 'md' }) => {
    // Sign from the rounded value, so −0.04 reads ±0.0 rather than −0.0
    const signed = (n: number, digits = 1) => {
        const r = Number(n.toFixed(digits));
        return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toFixed(digits)}`;
    };
    const lastLabel = lastDate ? new Date(lastDate + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : null;
    const toGoal = weight !== null && goalWeight > 0 ? weight - goalWeight : null;
    const caption = weight === null ? 'No weigh-ins yet'
        : toGoal === null ? `Weighed ${lastLabel}`
        : Math.abs(toGoal) < 0.25 ? 'At your goal'
        : `${Math.abs(toGoal).toFixed(1)} kg to go`;

    // Chart: 30 days back to 7 ahead. Days run along x; dots are zero-length round-capped lines, so they
    // stay round while the chart stretches to the tile's width.
    const WIDTH = 100, HEIGHT = 32, PAD = 4, BACK = 30, AHEAD = 7;
    const dayOf = (date: string) => (new Date(date + 'T00:00').getTime() - new Date(today + 'T00:00').getTime()) / 86_400_000;
    const last = trend[trend.length - 1];
    const ahead = last && ratePerWeek !== null ? { day: dayOf(last.date) + AHEAD, weight: last.weight + ratePerWeek } : null;
    const values = [...trend, ...readings].map(p => p.weight).concat(ahead ? [ahead.weight] : []);
    const min = Math.min(...values) - 0.3, max = Math.max(...values) + 0.3;
    const x = (day: number) => ((day + BACK) / (BACK + AHEAD)) * WIDTH;
    const y = (w: number) => HEIGHT - PAD - ((w - min) / (max - min)) * (HEIGHT - PAD * 2);
    const line = trend.map((p, i) => `${i ? 'L' : 'M'} ${x(dayOf(p.date))} ${y(p.weight)}`).join(' ');

    return (
        <div className={`tile tile-weight gap-1 relative ${tileHeight(size)}`}>
            {onClick && <TileLink onClick={onClick} label="Weight trends" />}
            <div className="flex justify-between items-baseline gap-2">
                <h3 className="font-sans text-sm font-semibold text-weight-text">Weight</h3>
                {ratePerWeek !== null && (
                    <span className="text-xs font-semibold whitespace-nowrap" title="Trend over the last month">{signed(ratePerWeek)} kg/wk</span>
                )}
            </div>
            <p className="text-2xl font-display font-extrabold leading-7">
                {weight !== null ? weight.toFixed(1) : '–'}<span className="text-sm font-semibold"> kg</span>
            </p>
            <p className="text-xs font-semibold" title={scale !== null && lastLabel ? `Last weigh-in ${scale.toFixed(1)} kg on ${lastLabel}. The figure is the trend, which smooths out day-to-day water changes.` : undefined}>
                {caption}
            </p>
            {size !== 'sm' && trend.length > 1 && (
                <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-8 mt-1 overflow-visible" preserveAspectRatio="none" aria-hidden="true">
                    {readings.map(r => (
                        <path key={r.date} d={`M ${x(dayOf(r.date))} ${y(r.weight)} h 0`} stroke="var(--weight)" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    ))}
                    {ahead && (
                        <path d={`M ${x(dayOf(last.date))} ${y(last.weight)} L ${x(ahead.day)} ${y(ahead.weight)}`} fill="none" stroke="var(--weight)" strokeWidth="2" strokeDasharray="2 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    )}
                    <path d={line} fill="none" stroke="var(--weight)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    <path d={`M ${x(dayOf(last.date))} ${y(last.weight)} h 0`} stroke="var(--surface)" strokeWidth="9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                    <path d={`M ${x(dayOf(last.date))} ${y(last.weight)} h 0`} stroke="var(--weight)" strokeWidth="6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
            )}
            <div className="mt-auto pt-2">
                <QuickAction onClick={onAddWeight}>Update</QuickAction>
            </div>
        </div>
    );
};
