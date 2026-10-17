import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, CalendarCheck, CircleAlert, CookingPot, Droplet, Egg, Equal, Flag, Flame, Gauge, NotebookPen, Scale, ThumbsUp, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppView, DayPlan, DailyLog, FastingState, UserStats, CoachReadState } from '../types';
import { analyticsDayTypesData, analyticsSummariesData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { AnalyticsDay, AnalyticsPeriod, Insight, PERIODS, buildDays, chartStart, insightsFor, summarize, weightProgress, weightSummary } from '../utils/analyticsModel';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { addDays, proteinTarget } from '../utils/planUtils';
import { ChartContainer } from './analytics/ChartContainer';
import { BurnUnlock, EnergyPanel, useEnergy } from './EnergyCheckIn';
import { CoachPanel } from './CoachPanel';
import { weightTrend } from '../utils/energyModel';
import { useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import { SelectionPill } from './SelectionPill';

interface TrackAnalyticsProps {
    todayPlan: DayPlan;
    stats: UserStats;
    dailyLog: DailyLog;
    fastingState: FastingState;
    onUpdateStats: (stats: UserStats) => void;
    onOpenFoodModal: () => void;
    onOpenWeightModal: () => void;
    onNavigate: (view: AppView) => void;
    coachRead: CoachReadState;
    onSetCoachRead: (id: string, read: boolean) => void;
}

const PERIOD_KEY = 'vesta_analytics_period';
const AXIS = { fontSize: 12, fill: 'var(--text-muted)' };
/** Fully round bar ends; Recharts clamps the radius to the bar */
const ROUND: [number, number, number, number] = [999, 999, 999, 999];

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const monthYear = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
const longDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmt = (n: number) => Math.round(n).toLocaleString();
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

/** Card with a round tinted icon, a heading, an optional subtitle and an optional control on the right */
const Panel: React.FC<{ title: string; icon: LucideIcon; tile: string; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, icon: Icon, tile, subtitle, action, children, className = '' }) => (
    <section className={`card p-4 md:p-6 ${className}`} aria-label={title}>
        <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
                <span className={`icon-tile ${tile} size-10 shrink-0 flex items-center justify-center`}><Icon size={18} strokeWidth={2.25} aria-hidden="true" /></span>
                <div className="min-w-0">
                    <h2 className="heading-3 pt-2">{title}</h2>
                    {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
        {children}
    </section>
);

/** A habit or metric figure on its tint */
const Stat: React.FC<{ label: string; icon: LucideIcon; tile: string; value: React.ReactNode; unit?: string; sub?: string }> = ({ label, icon: Icon, tile, value, unit, sub }) => (
    <div className={`tile ${tile} min-w-0`}>
        <p className="flex items-center gap-1.5 text-xs font-semibold"><Icon size={16} strokeWidth={2.25} aria-hidden="true" /> {label}</p>
        <p className="mt-1.5 font-display font-extrabold text-[24px] leading-7 tracking-tight">
            {value}{unit && <span className="font-sans text-xs font-semibold tracking-normal"> {unit}</span>}
        </p>
        {sub && <p className="text-xs font-medium mt-0.5">{sub}</p>}
    </div>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="h-40 flex items-center justify-center rounded-[20px] bg-surface-sunken text-sm text-muted text-center px-6">{children}</div>
);

const INSIGHT_TONE: Record<Insight['tone'], { Icon: typeof ThumbsUp; className: string; label: string }> = {
    win: { Icon: ThumbsUp, className: 'tile-weight', label: 'Better' },
    watch: { Icon: CircleAlert, className: 'bg-warning-bg text-warning', label: 'Worth a look' },
    steady: { Icon: Equal, className: 'tile-neutral', label: 'Steady' },
};

/** Tooltip in the app's card style */
const ChartTip: React.FC<{ active?: boolean; label?: string | number; lines: (label: string | number) => React.ReactNode }> = ({ active, label, lines }) =>
    active && label !== undefined ? (
        <div className="rounded-[16px] border border-border bg-surface px-3 py-2 text-sm shadow-[var(--elev-md)]">{lines(label)}</div>
    ) : null;

/** The trend as a small ink line in the hero, with the goal as a dashed line when it's in view */
const Sparkline: React.FC<{ line: { time: number; trend: number }[]; goal: number }> = ({ line, goal }) => {
    if (line.length < 2) return null;
    const ys = line.map(p => p.trend);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const span = Math.max(hi - lo, 0.5);
    // Show the goal only when it's close enough not to flatten the line
    const showGoal = goal > 0 && goal >= lo - span * 1.5 && goal <= hi + span * 1.5;
    if (showGoal) { lo = Math.min(lo, goal); hi = Math.max(hi, goal); }
    const t0 = line[0].time, t1 = line[line.length - 1].time;
    const x = (t: number) => ((t - t0) / Math.max(t1 - t0, 1)) * 296 + 2;
    const y = (v: number) => 6 + (1 - (v - lo) / Math.max(hi - lo, 0.01)) * 52;
    const last = line[line.length - 1];
    return (
        <svg viewBox="0 0 300 64" preserveAspectRatio="none" className="block w-full h-16 mt-3" aria-hidden="true">
            {showGoal && <line x1="0" x2="300" y1={y(goal)} y2={y(goal)} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
            <polyline points={line.map(p => `${x(p.time)},${y(p.trend)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={x(last.time)} cy={y(last.trend)} r="4.5" fill="currentColor" />
        </svg>
    );
};

export const TrackAnalytics: React.FC<TrackAnalyticsProps> = ({ stats, dailyLog, fastingState, onUpdateStats, onOpenFoodModal, onOpenWeightModal, onNavigate, coachRead, onSetCoachRead }) => {
    const summaries = usePrewarmed(analyticsSummariesData) ?? [];
    const dayTypes = usePrewarmed(analyticsDayTypesData) ?? {};
    const [period, setPeriod] = useState<AnalyticsPeriod>(() => {
        try { return (localStorage.getItem(PERIOD_KEY) as AnalyticsPeriod) || 'month'; } catch { return 'month'; }
    });
    // Charts are keyed by period, so switching remounts them and their bars and line grow in
    const reduceMotion = useReducedMotion();
    const chartMotion = { isAnimationActive: !reduceMotion, animationDuration: 550, animationEasing: 'ease-out' as const };
    const changePeriod = (next: AnalyticsPeriod) => {
        setPeriod(next);
        try { localStorage.setItem(PERIOD_KEY, next); } catch { /* per-device preference */ }
    };

    const periodDays = PERIODS.find(p => p.value === period)!.days;
    const periodName = period === 'quarter' ? '3 months' : period;
    const targetFast = fastingState.config.targetFastHours || 16;
    const days = useMemo(() => buildDays(periodDays, summaries, dayTypes, stats, dailyLog), [periodDays, summaries, dayTypes, stats, dailyLog]);
    const byDate = useMemo(() => new Map(days.map(d => [d.date, d])), [days]);
    const summary = useMemo(() => summarize(days, targetFast), [days, targetFast]);
    const weight = useMemo(() => weightSummary(stats.weightHistory, periodDays, stats.goalWeight), [stats.weightHistory, periodDays, stats.goalWeight]);
    // Progress and the burn estimate don't follow the period: they read the trend and the last four weeks
    const progress = useMemo(() => weightProgress(stats.weightHistory, stats.goalWeight), [stats.weightHistory, stats.goalWeight]);
    const energy = useEnergy(stats, summaries, dayTypes);
    // The period up to yesterday (today is still in progress) against the same length before it
    const { insights, compared } = useMemo(() => {
        const yesterday = addDays(localDateString(), -1);
        const current = buildDays(periodDays, summaries, dayTypes, stats, dailyLog, yesterday);
        const previous = buildDays(periodDays, summaries, dayTypes, stats, dailyLog, addDays(yesterday, -periodDays));
        return insightsFor(current, previous, targetFast, stats.dailyCalorieGoal);
    }, [periodDays, summaries, dayTypes, stats, dailyLog, targetFast]);

    const tickDate = (date: string) => period === 'week'
        ? parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' })
        : shortDate(date);
    // Charts start where the latest spell of logging does (two weeks at least), not at a stray
    // early day or a long empty stretch before you started
    const start = chartStart(days);
    const chartDays = days.slice(start);
    const trimmed = start > 0;
    const tickInterval = period === 'week' ? 0 : Math.max(1, Math.floor(chartDays.length / 6));

    // Calorie and fasting series: unlogged days stay empty so they show as gaps
    const calorieData = chartDays.map(d => ({ ...d, eaten: d.logged ? d.calories : null }));
    const fastData = chartDays.map(d => ({ ...d, fast: d.fastHours }));
    // Round steps on the calorie axis: 500s, or 1000s above 3000
    const calorieMax = Math.max(...chartDays.map(d => Math.max(d.calories, d.calorieTarget)), 500);
    const calorieStep = calorieMax > 3000 ? 1000 : 500;
    const calorieTicks = Array.from({ length: Math.ceil(calorieMax / calorieStep) + 1 }, (_, i) => i * calorieStep);

    // --- Weight chart: the smoothed trend as a line, scale readings as dots ---
    const weightData = useMemo(() => {
        if (weight.points.length < 2) return [];
        const from = weight.points[0].date;
        const to = weight.points[weight.points.length - 1].date;
        const rows: { time: number; date: string; trend: number | null; scale: number | null }[] = [];
        weightTrend(stats.weightHistory).filter(p => p.date >= from && p.date <= to).forEach((p, i, all) => {
            // Break the line where a long gap started a new trend
            if (i > 0 && all[i - 1].run !== p.run) rows.push({ time: p.time - 43_200_000, date: p.date, trend: null, scale: null });
            rows.push({ time: p.time, date: p.date, trend: Math.round(p.trend * 100) / 100, scale: p.scale });
        });
        return rows;
    }, [weight.points, stats.weightHistory]);
    const weightDomain = (() => {
        if (weight.points.length === 0) return undefined;
        const ys = weight.points.map(p => p.weight);
        return [Math.floor(Math.min(...ys) - 1), Math.ceil(Math.max(...ys) + 1)] as [number, number];
    })();
    const lastPoint = weight.points[weight.points.length - 1];
    const xDomain: [number, number] | undefined = weight.points.length
        ? [weight.points[0].time, lastPoint.time + 86_400_000]
        : undefined;

    // --- Hero chips: pace, change since this spell of weigh-ins began, and what's left ---
    const heroChips: string[] = [];
    if (progress) {
        if (progress.ratePerWeek !== null) heroChips.push(`${signed(progress.ratePerWeek)} kg a week`);
        if (Math.abs(progress.change) >= 0.1) heroChips.push(`${signed(progress.change)} kg since ${shortDate(progress.since)}`);
        if (progress.toGoal !== null) heroChips.push(progress.toGoal >= 0.1 ? `${progress.toGoal.toFixed(1)} kg to go` : 'At your goal');
    }

    // --- Consistency calendar: whole weeks (Mon–Sun) covering the period, at least four.
    // Week is the exception: just the period's seven days, in a row ---
    const today = localDateString();
    const isWeek = period === 'week';
    const weekDates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const weeks = Math.max(4, Math.ceil(periodDays / 7));
    const thisMonday = addDays(today, -((parseLocalDate(today).getDay() + 6) % 7));
    const calendarWeeks = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(thisMonday, (w - weeks + 1) * 7 + d)));
    const fastKept = (day: AnalyticsDay | undefined) => !!day && day.isFastDay && day.complete && day.goals.calories;
    const cellStyle = (day: AnalyticsDay | undefined, date: string): React.CSSProperties => {
        const ring = fastKept(day) ? { boxShadow: 'inset 0 0 0 3px var(--fasting)' } : {};
        if (date > today) return { background: 'transparent', border: '1px dashed var(--border-control)' };
        if (day?.complete) return { background: 'var(--weight)', ...ring };
        if (day?.logged) return { background: 'color-mix(in srgb, var(--weight) 35%, var(--surface-sunken))', ...ring };
        return { background: 'var(--surface-sunken)' };
    };
    const cellLabel = (day: AnalyticsDay | undefined, date: string) => {
        if (date > today) return `${longDate(date)}: upcoming`;
        const state = day?.complete ? 'fully logged' : day?.logged ? 'partly logged' : 'nothing logged';
        return `${longDate(date)}: ${state}${fastKept(day) ? ', fast day kept' : day?.isFastDay ? ', fast day' : ''}`;
    };
    // Calendar can reach back before the period: look those days up too
    const calendarDays = useMemo(() => {
        const span = weeks * 7 + 7;
        return span > periodDays ? new Map(buildDays(Math.min(span, 90), summaries, dayTypes, stats, dailyLog).map(d => [d.date, d])) : byDate;
    }, [weeks, periodDays, summaries, dayTypes, stats, dailyLog, byDate]);

    return (
        <div className="space-y-4 md:space-y-5 pb-4">
            {/* 1. Is it working? Progress towards the goal: the page's one bold block */}
            <section className="hero p-5 md:p-6" aria-label="Your progress">
                <p className="text-[15px] font-bold">Your progress</p>
                {progress ? (
                    <>
                        <p className="mt-2 font-display font-extrabold text-[72px] leading-[0.9] tracking-[-0.05em] tabular-nums">
                            <AnimatedNumber value={progress.current} format={n => n.toFixed(1)} />
                            <span className="text-2xl tracking-tight"> kg</span>
                        </p>
                        <p className="text-sm font-medium mt-1">Trend weight, smoothing out day-to-day changes</p>
                        {heroChips.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5 mt-3" aria-label="Progress">
                                {heroChips.map(c => <li key={c} className="badge badge-ink">{c}</li>)}
                            </ul>
                        )}
                        <Sparkline line={progress.line} goal={stats.goalWeight} />
                        {progress.projection && (
                            <p className="flex items-center gap-1.5 text-[15px] font-semibold mt-3">
                                <Flag size={16} strokeWidth={2.25} aria-hidden="true" /> {stats.goalWeight} kg around {monthYear(progress.projection.date)} at this pace
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        <p className="mt-2 font-display font-extrabold text-[72px] leading-[0.9] tracking-[-0.05em]">—</p>
                        <p className="text-sm font-medium mt-3">Weigh in on Today to start following your progress.</p>
                    </>
                )}
            </section>

            {/* 2. What to do next, including what's still needed for the burn estimate */}
            <CoachPanel
                stats={stats}
                summaries={summaries}
                dayTypes={dayTypes}
                dailyLog={dailyLog}
                onUpdateStats={onUpdateStats}
                onOpenFoodModal={onOpenFoodModal}
                onOpenWeightModal={onOpenWeightModal}
                onNavigate={onNavigate}
                coachRead={coachRead}
                onSetCoachRead={onSetCoachRead}
                unlock={energy.estimate.ready ? undefined : <BurnUnlock estimate={energy.estimate} />}
            />

            {/* 3. How to get there faster: pace, goal date and target together, once the burn is known */}
            <EnergyPanel stats={stats} summaries={summaries} dayTypes={dayTypes} onUpdateStats={onUpdateStats} currentWeight={progress?.current ?? null} />

            {/* 4. Habits: everything from here follows the period */}
            <section className="space-y-3 pt-2" aria-labelledby="habits-heading">
                <div className="flex items-end justify-between gap-3">
                    <h2 id="habits-heading" className="heading-2">Your habits</h2>
                    <p className="text-sm text-muted text-right">{shortDate(days[0].date)} – {shortDate(today)}</p>
                </div>
                <div role="radiogroup" aria-label="Period" className="segmented pill-group">
                    {PERIODS.map(p => (
                        <button
                            key={p.value}
                            role="radio"
                            aria-checked={period === p.value}
                            onClick={() => changePeriod(p.value)}
                            className="segment px-3.5 sm:px-4"
                        >
                            {period === p.value && <SelectionPill group="analytics-period-pill" />}
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Stat label="Nourish days" icon={CookingPot} tile="tile-calories"
                        value={summary.nourishLogged ? summary.nourishOnTarget : '—'}
                        unit={summary.nourishLogged ? `of ${summary.nourishLogged} on target` : undefined}
                        sub={summary.nourishLogged ? undefined : 'None fully logged'} />
                    <Stat label="Fast days" icon={Flame} tile="tile-fasting"
                        value={summary.fastDaysLogged ? summary.fastDaysKept : '—'}
                        unit={summary.fastDaysLogged ? `of ${summary.fastDaysLogged} kept` : undefined}
                        sub={summary.fastDaysLogged
                            ? `Averaged ${fmt(summary.avgFastDayCalories!)} kcal`
                            : summary.fastDays ? 'None fully logged' : 'None planned'} />
                    <Stat label="Fully logged" icon={NotebookPen} tile="tile-neutral"
                        value={summary.loggedDays} unit={`of ${days.length} days`} />
                    <Stat label="Protein" icon={Egg} tile="tile-neutral"
                        value={summary.avgProtein !== null ? fmt(summary.avgProtein) : '—'}
                        unit={summary.avgProtein !== null ? `of ${proteinTarget(stats)} g` : undefined}
                        sub={summary.avgProtein !== null ? 'Daily average' : 'Not tracked yet'} />
                </div>

                {/* Without a period before to compare with, insights would only repeat the tiles */}
                {compared && insights.length > 0 && (
                    <section className="card p-4 md:p-6" aria-label="Insights">
                        <h3 className="font-semibold">Against the {periodName} before</h3>
                        <ul className="space-y-2.5 mt-3">
                            {insights.map(insight => {
                                const { Icon, className, label } = INSIGHT_TONE[insight.tone];
                                return (
                                    <li key={insight.id} className="flex items-start gap-2.5">
                                        <span className={`mt-0.5 size-6 shrink-0 rounded-full flex items-center justify-center ${className}`}><Icon size={14} aria-hidden="true" /></span>
                                        <span className="leading-relaxed"><span className="sr-only">{label}: </span>{insight.text}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}
            </section>

            {/* 5. The detail behind it */}
            <Panel
                title="Weight"
                icon={Scale}
                tile="tile-weight"
                subtitle={
                    weight.fallback ? `${weight.inPeriod ? 'One weigh-in' : 'No weigh-ins'} this ${periodName}; showing your last ${weight.points.length}`
                        : weight.ratePerWeek !== null ? `Trend ${signed(weight.ratePerWeek, 2)} kg a week${stats.goalWeight ? ` · goal ${stats.goalWeight} kg` : ''}`
                        : stats.goalWeight ? `Goal ${stats.goalWeight} kg` : undefined
                }
            >
                {weight.points.length < 2 ? (
                    <Empty>{weight.points.length === 1 ? 'One weigh-in so far. Weigh in again to see a trend.' : 'No weigh-ins yet. Log your weight on Today to see a trend.'}</Empty>
                ) : (
                    <>
                        <div className="h-56 md:h-64">
                            <ChartContainer key={period}>
                                <LineChart data={weightData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="time" type="number" scale="time" domain={xDomain} tick={AXIS} tickLine={false} axisLine={false}
                                        tickFormatter={t => shortDate(localDateString(new Date(t)))} minTickGap={24} />
                                    <YAxis domain={weightDomain} allowDecimals={false} tickCount={5} tick={AXIS} tickLine={false} axisLine={false} width={44} />
                                    <Tooltip content={({ active, label }) => (
                                        <ChartTip active={active} label={label} lines={l => {
                                            const p = weightData.find(x => x.time === l);
                                            return p && p.trend !== null ? <>
                                                <p className="text-muted">{longDate(p.date)}</p>
                                                <p className="font-semibold">Trend {p.trend.toFixed(1)} kg</p>
                                                {p.scale !== null && <p>Scale {p.scale.toFixed(1)} kg</p>}
                                            </> : null;
                                        }} />
                                    )} />
                                    {stats.goalWeight > 0 && (
                                        <ReferenceLine y={stats.goalWeight} ifOverflow="hidden" stroke="var(--weight)" strokeDasharray="4 4"
                                            label={{ value: `Goal ${stats.goalWeight}`, position: 'insideBottomRight', fill: 'var(--weight-text)', fontSize: 12 }} />
                                    )}
                                    <Line type="monotone" dataKey="trend" stroke="var(--weight)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls={false} {...chartMotion} />
                                    <Line dataKey="scale" stroke="none" dot={{ r: 3, fill: 'var(--surface)', stroke: 'var(--weight)', strokeWidth: 2 }} activeDot={false} connectNulls={false} {...chartMotion} legendType="none" />
                                </LineChart>
                            </ChartContainer>
                        </div>
                        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-2">
                            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 rounded-full bg-weight" aria-hidden="true" /> Trend</span>
                            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full border-2 border-weight" aria-hidden="true" /> Scale</span>
                        </p>
                    </>
                )}
            </Panel>

            <Panel
                title="Calories"
                icon={Gauge}
                tile="tile-calories"
                subtitle={summary.loggedDays ? `${trimmed ? `Since ${shortDate(chartDays[0].date)}, each` : 'Each'} day against its target · ${summary.loggedDays} fully logged` : undefined}
            >
                {summary.loggedDays === 0 ? <Empty>No food logged in this period.</Empty> : (
                    <>
                        <div className="h-56 md:h-64">
                            <ChartContainer key={period}>
                                <ComposedChart data={calorieData} margin={{ top: 8, right: 16, bottom: 0, left: -4 }}>
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={tickDate} interval={tickInterval} />
                                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} ticks={calorieTicks} domain={[0, calorieTicks[calorieTicks.length - 1]]} />
                                    <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={({ active, label }) => (
                                        <ChartTip active={active} label={label} lines={l => {
                                            const d = byDate.get(String(l));
                                            if (!d) return null;
                                            return <><p className="text-muted">{longDate(d.date)}{d.isFastDay ? ' · fast day' : ''}</p>
                                                <p className="font-semibold">{d.logged ? `${fmt(d.calories)} of ${fmt(d.calorieTarget)} kcal` : 'Nothing logged'}</p></>;
                                        }} />
                                    )} />
                                    <Bar dataKey="eaten" radius={ROUND} maxBarSize={20} {...chartMotion}>
                                        {calorieData.map(d => <Cell key={d.date} fill={d.calories > d.calorieTarget ? 'var(--warning)' : 'var(--calories)'} />)}
                                    </Bar>
                                    <Line type="stepAfter" dataKey="calorieTarget" stroke="var(--text-muted)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                </ComposedChart>
                            </ChartContainer>
                        </div>
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted">
                            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-calories" aria-hidden="true" /> On target</li>
                            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-warning" aria-hidden="true" /> Over</li>
                            <li className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[var(--text-muted)]" aria-hidden="true" /> Target, lower on fast days</li>
                        </ul>
                    </>
                )}
            </Panel>

            <div className="grid lg:grid-cols-2 gap-4 md:gap-5 items-start">
                <div className="space-y-4 md:space-y-5">
                    <Panel title="Fasting window" icon={Timer} tile="tile-fasting" subtitle={summary.fastCount ? `Hours between your last and first meal · goal ${targetFast} h` : undefined}>
                        {summary.fastCount === 0 ? <Empty>No fasts recorded in this period. They're measured between logged meals.</Empty> : (
                            <div className="h-44 md:h-52">
                                <ChartContainer key={period}>
                                    <BarChart data={fastData} margin={{ top: 8, right: 16, bottom: 0, left: -6 }}>
                                        <CartesianGrid vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={tickDate} interval={tickInterval} />
                                        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} unit=" h" allowDecimals={false} />
                                        <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={({ active, label }) => (
                                            <ChartTip active={active} label={label} lines={l => {
                                                const d = byDate.get(String(l));
                                                return d ? <><p className="text-muted">{longDate(d.date)}</p><p className="font-semibold">{d.fastHours !== null ? `${d.fastHours.toFixed(1)} h fast` : 'No fast recorded'}</p></> : null;
                                            }} />
                                        )} />
                                        <ReferenceLine y={targetFast} stroke="var(--fasting-text)" strokeDasharray="4 4" />
                                        <Bar dataKey="fast" fill="var(--fasting)" radius={ROUND} maxBarSize={20} {...chartMotion} />
                                    </BarChart>
                                </ChartContainer>
                            </div>
                        )}
                    </Panel>

                    <div className="grid grid-cols-2 gap-2">
                        <Stat label="Movement" icon={Activity} tile="tile-workout"
                            value={summary.workouts} unit={summary.workouts === 1 ? 'workout' : 'workouts'}
                            sub={summary.burned ? `${fmt(summary.burned)} kcal burned` : 'None logged'} />
                        <Stat label="Water" icon={Droplet} tile="tile-water"
                            value={summary.avgWater !== null ? (summary.avgWater / 1000).toFixed(1) : '—'}
                            unit={summary.avgWater !== null ? 'L a day' : undefined}
                            sub={summary.waterDaysLogged ? `Goal met ${summary.waterDaysMet} of ${summary.waterDaysLogged} days` : 'None logged'} />
                    </div>
                </div>

                {/* Consistency: the habits the plan runs on. One dot size for month and 3 months
                    (smaller on phones so 13 weeks still fit); a week is one row of bigger dots */}
                <Panel title="Consistency" icon={CalendarCheck} tile="tile-weight" subtitle="Fully logged days, and fast days you kept">
                    {isWeek ? (
                        <div className="grid grid-cols-7 gap-1.5 md:gap-2 max-w-[26rem] stagger">
                            {weekDates.map(date => {
                                const day = calendarDays.get(date);
                                return (
                                    <div key={date} className="flex flex-col items-center gap-1.5">
                                        <span
                                            role="img"
                                            aria-label={cellLabel(day, date)}
                                            title={cellLabel(day, date)}
                                            className={`w-full aspect-square rounded-full ${date === today ? 'outline-2 outline-offset-2 outline-[var(--ink)]' : ''}`}
                                            style={cellStyle(day, date)}
                                        />
                                        <span className="text-xs text-muted" aria-hidden="true">{parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div
                            key={period}
                            className="grid grid-flow-col gap-1 md:gap-1.5 w-fit [--cell:1rem] md:[--cell:1.25rem] animate-fade-in"
                            style={{ gridTemplateRows: 'auto repeat(7, var(--cell))', gridTemplateColumns: `auto repeat(${weeks}, var(--cell))` }}
                        >
                            <span aria-hidden="true" />
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                                <span key={d} className="text-xs text-muted pr-2 self-center">{i % 2 === 0 ? d : ''}</span>
                            ))}
                            {calendarWeeks.map(week => (
                                <React.Fragment key={week[0]}>
                                    <span className="text-xs text-muted h-5 whitespace-nowrap">{parseLocalDate(week[0]).getDate() <= 7 ? parseLocalDate(week[0]).toLocaleDateString(undefined, { month: 'short' }) : ''}</span>
                                    {week.map(date => {
                                        const day = calendarDays.get(date);
                                        return (
                                            <span
                                                key={date}
                                                role="img"
                                                aria-label={cellLabel(day, date)}
                                                title={cellLabel(day, date)}
                                                className={`size-full rounded-full ${date === today ? 'outline-2 outline-offset-2 outline-[var(--ink)]' : ''}`}
                                                style={cellStyle(day, date)}
                                            />
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-muted">
                        <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-surface-sunken" aria-hidden="true" /> Not logged</li>
                        <li className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: 'color-mix(in srgb, var(--weight) 35%, var(--surface-sunken))' }} aria-hidden="true" /> Partly</li>
                        <li className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-weight" aria-hidden="true" /> Fully logged</li>
                        <li className="flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ boxShadow: 'inset 0 0 0 2.5px var(--fasting)' }} aria-hidden="true" /> Fast day kept</li>
                    </ul>
                </Panel>
            </div>
        </div>
    );
};
