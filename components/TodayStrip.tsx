import React from 'react';
import { Activity, Check, Droplet, Egg, Plus, Scale, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';
import { useMoment } from '../hooks/useMoment';
import { fastingProgress, fmtDuration, FastingInput, waterPace } from '../utils/todayMetrics';

interface TodayStripProps {
    water: { liters: number; goal: number; onAdd: (amount: number) => void };
    protein: { eaten: number; target: number };
    weight: { kg: number | null; ratePerWeek: number | null; onUpdate: () => void; onOpen: () => void };
    workouts: { caloriesBurned: number; types: string[]; streak: number; onLog: () => void; onOpen: () => void };
    fasting: FastingInput & { onOpen: () => void };
}

/** Sign from the rounded value, so −0.04 reads ±0.0 rather than −0.0 */
const signed = (n: number) => {
    const r = Number(n.toFixed(1));
    return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toFixed(1)}`;
};

interface TileProps {
    label: string;
    icon: LucideIcon;
    /** tile-water, tile-weight, …: the metric's tint */
    tile: string;
    figure: React.ReactNode;
    caption?: string;
    /** Progress towards the day's goal, 0–1, as a thin bar in `meterColor` */
    meter?: number;
    meterColor?: string;
    /** Opens the metric's detail view */
    onOpen?: () => void;
    openLabel?: string;
    /** The quick action, a round button in the corner: + alone, or with a short amount */
    action?: { label?: string; spoken: string; onClick: () => void };
    /** Goal met: a check after the figure */
    done?: boolean;
    /** Something good just happened here: the figure pops once */
    moment?: boolean;
}

const Tile: React.FC<TileProps> = ({ label, icon: Icon, tile, figure, caption, meter, meterColor, onOpen, openLabel, action, done, moment }) => {
    const body = (
        <>
            <span className={`flex items-center gap-1.5 text-xs font-semibold min-h-5 ${action ? 'pr-12' : ''}`}>
                <Icon size={16} strokeWidth={2.25} aria-hidden="true" /> {label}
            </span>
            <span className={`mt-2 flex items-center gap-1.5 font-display font-extrabold text-[26px] leading-[30px] tracking-tight tabular-nums origin-left ${moment ? 'moment-pop' : ''}`}>
                <span>{figure}</span>
                {done && (
                    <span className="size-5 rounded-full grid place-items-center bg-surface text-main">
                        <Check size={13} strokeWidth={3.5} aria-label="Goal met" />
                    </span>
                )}
            </span>
            {caption && <span className="text-xs font-medium truncate mt-0.5">{caption}</span>}
            {meter !== undefined && (
                <span className="mt-auto pt-3 block" aria-hidden="true">
                    <span className="block h-1.5 rounded-full bg-current/15 overflow-hidden">
                        <span className="block h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.min(Math.max(meter, 0), 1) * 100}%`, background: meterColor }} />
                    </span>
                </span>
            )}
        </>
    );
    return (
        <div className={`tile ${tile} relative min-w-0 min-h-[118px] p-3.5`}>
            {onOpen ? (
                <button onClick={onOpen} aria-label={openLabel} className="flex flex-col flex-1 text-left rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
                    {body}
                </button>
            ) : (
                <div className="flex flex-col flex-1">{body}</div>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    aria-label={action.spoken}
                    className={`absolute top-2 right-2 h-10 ${action.label ? 'px-3 gap-0.5' : 'w-10'} rounded-full bg-surface text-main inline-flex items-center justify-center text-xs font-bold transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]`}
                >
                    <Plus size={action.label ? 14 : 18} strokeWidth={2.5} aria-hidden="true" />{action.label}
                </button>
            )}
        </div>
    );
};

/** Today's fast against its target, as a ring */
const FastRing: React.FC<{ share: number; done: boolean }> = ({ share, done }) => {
    const c = 2 * Math.PI * 21;
    return (
        <svg viewBox="0 0 52 52" className="size-[52px] shrink-0" aria-hidden="true">
            <circle cx="26" cy="26" r="21" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="7" />
            <circle cx="26" cy="26" r="21" fill="none" stroke="var(--fasting)" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={`${Math.min(Math.max(share, 0), 1) * c} ${c}`} transform="rotate(-90 26 26)"
                className="transition-[stroke-dasharray] duration-1000 motion-reduce:transition-none" />
            {done && <path d="M19 26.5l4.5 4.5 9-9.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
    );
};

/**
 * Water, protein, weight, workouts and fasting as tiles in their metric tints: a figure each,
 * with the quick action as a round + in the corner. On phones fasting is a wide tile with a ring
 * and the last seven days; from md up all five share one row. The charts stay on Analytics and
 * in the workout overview.
 */
export const TodayStrip: React.FC<TodayStripProps> = ({ water, protein, weight, workouts, fasting }) => {
    const pace = waterPace(water.liters, water.goal);
    const fast = fastingProgress(fasting);
    const fastFigure = fast.inWindow
        ? (fast.lastNight > 0 ? fmtDuration(fast.lastNight) : '–')
        : fasting.lastAteTime ? fmtDuration(fasting.elapsedHours) : '–';
    const fastHours = fast.inWindow ? fast.lastNight : fasting.lastAteTime ? fasting.elapsedHours : 0;
    const waterDone = water.goal > 0 && water.liters >= water.goal;
    // Today's fast reached its target: the one that ended at the first meal, or the one running now
    const fastDone = fast.inWindow ? fast.lastNight >= fasting.targetHours : !!fasting.lastAteTime && fasting.elapsedHours >= fasting.targetHours;
    const waterMoment = useMoment(waterDone);
    const fastMoment = useMoment(fastDone);
    const streakMoment = useMoment(workouts.streak);
    const fastCaption = fast.inWindow ? 'Last night' : fasting.lastAteTime ? `of ${fasting.targetHours} h` : 'After your next meal';
    const unit = (text: string) => <span className="font-sans text-xs font-semibold tracking-normal"> {text}</span>;

    return (
        <section aria-label="Today's numbers" className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Tile
                label="Water"
                icon={Droplet}
                tile="tile-water"
                figure={<><AnimatedNumber value={water.liters} format={n => String(parseFloat(n.toFixed(2)))} />{unit(`of ${water.goal} L`)}</>}
                caption={pace ?? undefined}
                meter={water.goal > 0 ? water.liters / water.goal : 0}
                meterColor="var(--water)"
                action={{ label: '250', spoken: 'Add 250 millilitres of water', onClick: () => water.onAdd(250) }}
                done={waterDone}
                moment={waterMoment}
            />
            <Tile
                label="Protein"
                icon={Egg}
                tile="tile-neutral"
                figure={<>{Math.round(protein.eaten)}{unit(`of ${protein.target} g`)}</>}
                meter={protein.target > 0 ? protein.eaten / protein.target : 0}
                meterColor="var(--ink)"
                done={protein.target > 0 && protein.eaten >= protein.target}
            />
            <Tile
                label="Weight"
                icon={Scale}
                tile="tile-weight"
                figure={weight.kg !== null ? <><AnimatedNumber value={weight.kg} format={n => n.toFixed(1)} />{unit('kg')}</> : '–'}
                caption={weight.ratePerWeek !== null ? `${signed(weight.ratePerWeek)} kg a week` : 'No trend yet'}
                onOpen={weight.onOpen}
                openLabel="Weight trends"
                action={{ spoken: 'Log weight', onClick: weight.onUpdate }}
            />
            <Tile
                label="Workouts"
                icon={Activity}
                tile="tile-workout"
                figure={<><AnimatedNumber value={workouts.caloriesBurned} format={n => String(Math.round(n))} />{unit('kcal')}</>}
                caption={[
                    workouts.types.length ? [...new Set(workouts.types)].join(', ') : 'Nothing logged yet',
                    ...(workouts.streak > 1 ? [`${workouts.streak}-day streak`] : []),
                ].join(' · ')}
                onOpen={workouts.onOpen}
                openLabel="Workout overview"
                action={{ spoken: 'Log a workout', onClick: workouts.onLog }}
                moment={streakMoment}
            />
            {/* Fasting: wide with a ring and the week on phones, a tile like the rest from md up */}
            <button
                onClick={fasting.onOpen}
                aria-label={`Fasting: ${fastFigure} ${fastCaption.toLowerCase()}. Target reached on ${fast.hits} of the last 7 days`}
                className="tile tile-fasting col-span-2 md:col-span-1 min-w-0 p-3.5 text-left flex flex-row md:flex-col items-center md:items-start gap-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
                <span className="md:hidden"><FastRing share={fasting.targetHours > 0 ? fastHours / fasting.targetHours : 0} done={fastDone} /></span>
                <span className="flex flex-col min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-semibold min-h-5"><Timer size={16} strokeWidth={2.25} aria-hidden="true" /> Fasting</span>
                    <span className={`mt-0.5 md:mt-2 flex items-center gap-1.5 font-display font-extrabold text-[26px] leading-[30px] tracking-tight tabular-nums origin-left ${fastMoment ? 'moment-pop' : ''}`}>
                        {fastFigure}
                        {fastDone && <span className="hidden md:grid size-5 rounded-full place-items-center bg-surface text-main"><Check size={13} strokeWidth={3.5} aria-hidden="true" /></span>}
                    </span>
                    <span className="text-xs font-medium mt-0.5">{fastCaption}<span className="hidden md:inline"> · {fast.hits} of 7 days</span></span>
                </span>
                <span className="md:hidden ml-auto flex flex-col items-end gap-1.5 shrink-0" aria-hidden="true">
                    <span className="flex gap-1">
                        {fast.week.map(d => <span key={d.date} className={`size-3.5 rounded-full ${d.hit ? 'bg-fasting' : 'bg-current/15'}`} />)}
                    </span>
                    <span className="text-xs font-medium">{fast.hits} of 7 days at {fasting.targetHours} h</span>
                </span>
            </button>
        </section>
    );
};
