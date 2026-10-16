import React from 'react';
import { Check } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { useMoment } from '../hooks/useMoment';
import { fastingProgress, fmtDuration, FastingInput, waterPace } from '../utils/todayMetrics';

interface TodayStripProps {
    water: { liters: number; goal: number; onAdd: (amount: number) => void };
    weight: { kg: number | null; ratePerWeek: number | null; onUpdate: () => void; onOpen: () => void };
    workouts: { caloriesBurned: number; types: string[]; streak: number; onLog: () => void; onOpen: () => void };
    fasting: FastingInput;
}

/** Sign from the rounded value, so −0.04 reads ±0.0 rather than −0.0 */
const signed = (n: number) => {
    const r = Number(n.toFixed(1));
    return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toFixed(1)}`;
};

const Cell: React.FC<{
    label: string;
    dot: string;
    figure: React.ReactNode;
    caption: string;
    /** Opens the metric's detail view */
    onOpen?: () => void;
    openLabel?: string;
    action?: { label: string; spoken?: string; onClick: () => void };
    /** Goal met: a check in the metric's colour after the figure */
    done?: boolean;
    /** Something good just happened here: the figure pops once */
    moment?: boolean;
}> = ({ label, dot, figure, caption, onOpen, openLabel, action, done, moment }) => {
    const body = (
        <>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <span className="size-2 rounded-full shrink-0" style={{ background: `var(--${dot})` }} aria-hidden="true" />
                {label}
            </span>
            <span className={`flex items-center gap-1.5 font-display font-extrabold text-[22px] leading-7 tracking-tight text-main tabular-nums origin-left ${moment ? 'moment-pop' : ''}`}>
                <span>{figure}</span>
                {done && (
                    <span className="size-5 rounded-full grid place-items-center" style={{ background: `var(--${dot}-bg)`, color: `var(--${dot}-text)` }}>
                        <Check size={13} strokeWidth={3.5} aria-label="Goal met" />
                    </span>
                )}
            </span>
            <span className="text-xs text-muted truncate">{caption}</span>
        </>
    );
    return (
        <div className="flex flex-col gap-2 min-w-0">
            {onOpen ? (
                <button onClick={onOpen} aria-label={openLabel} className="flex flex-col gap-0.5 text-left rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
                    {body}
                </button>
            ) : (
                <div className="flex flex-col gap-0.5">{body}</div>
            )}
            {action && (
                <button onClick={action.onClick} aria-label={action.spoken} className="chip hit-target self-start mt-auto px-3">
                    {action.label}
                </button>
            )}
        </div>
    );
};

/**
 * Water, weight, workouts and fasting as one quiet strip: a figure and a word each,
 * with the quick action under it. The charts stay on Analytics and in the workout overview.
 */
export const TodayStrip: React.FC<TodayStripProps> = ({ water, weight, workouts, fasting }) => {
    const pace = waterPace(water.liters, water.goal);
    const fast = fastingProgress(fasting);
    const fastFigure = fast.inWindow
        ? (fast.lastNight > 0 ? fmtDuration(fast.lastNight) : '–')
        : fasting.lastAteTime ? fmtDuration(fasting.elapsedHours) : '–';
    const waterDone = water.goal > 0 && water.liters >= water.goal;
    // Today's fast reached its target: the one that ended at the first meal, or the one running now
    const fastDone = fast.inWindow ? fast.lastNight >= fasting.targetHours : !!fasting.lastAteTime && fasting.elapsedHours >= fasting.targetHours;
    const waterMoment = useMoment(waterDone);
    const fastMoment = useMoment(fastDone);
    const streakMoment = useMoment(workouts.streak);
    const fastCaption = fast.inWindow ? 'Last night' : fasting.lastAteTime ? `of ${fasting.targetHours}h` : 'After your next meal';

    return (
        <section aria-label="Today's numbers" className="card p-4 md:p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">
                <Cell
                    label="Water"
                    dot="water"
                    figure={<><AnimatedNumber value={water.liters} format={n => String(parseFloat(n.toFixed(2)))} /><span className="text-sm font-semibold"> L</span></>}
                    caption={pace ? `${pace} · of ${water.goal} L` : `of ${water.goal} L`}
                    action={{ label: '+250 ml', spoken: 'Add 250 millilitres of water', onClick: () => water.onAdd(250) }}
                    done={waterDone}
                    moment={waterMoment}
                />
                <Cell
                    label="Weight"
                    dot="weight"
                    figure={weight.kg !== null ? <><AnimatedNumber value={weight.kg} format={n => n.toFixed(1)} /><span className="text-sm font-semibold"> kg</span></> : '–'}
                    caption={weight.ratePerWeek !== null ? `${signed(weight.ratePerWeek)} kg a week` : 'No trend yet'}
                    onOpen={weight.onOpen}
                    openLabel="Weight trends"
                    action={{ label: 'Update', spoken: 'Update weight', onClick: weight.onUpdate }}
                />
                <Cell
                    label={workouts.streak > 1 ? `Workouts · ${workouts.streak} days` : 'Workouts'}
                    dot="workout"
                    figure={workouts.types.length ? <><AnimatedNumber value={workouts.caloriesBurned} format={n => String(Math.round(n))} /><span className="text-sm font-semibold"> kcal</span></> : '–'}
                    caption={workouts.types.length ? [...new Set(workouts.types)].join(', ') : 'Nothing logged yet'}
                    onOpen={workouts.onOpen}
                    openLabel="Workout overview"
                    action={{ label: 'Log', spoken: 'Log a workout', onClick: workouts.onLog }}
                    moment={streakMoment}
                />
                <Cell
                    label="Fasting"
                    dot="fasting"
                    figure={fastFigure}
                    caption={`${fastCaption} · ${fast.hits} of 7`}
                    done={fastDone}
                    moment={fastMoment}
                />
            </div>
        </section>
    );
};
