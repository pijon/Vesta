import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Droplets, Flame, Lightbulb, Scale, Timer } from 'lucide-react';
import { DayPlan, DailyLog, FastingState, UserStats } from '../types';
import { analyticsDayTypesData, analyticsSummariesData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { AnalyticsDay, AnalyticsPeriod, PERIODS, buildDays, insightsFor, summarize, weightSummary } from '../utils/analyticsModel';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { addDays } from '../utils/planUtils';
import { ChartContainer } from './analytics/ChartContainer';

interface TrackAnalyticsProps {
    todayPlan: DayPlan;
    stats: UserStats;
    dailyLog: DailyLog;
    fastingState: FastingState;
}

const PERIOD_KEY = 'vesta_analytics_period';
const AXIS = { fontSize: 12, fill: 'var(--text-muted)' };

const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const longDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmt = (n: number) => Math.round(n).toLocaleString();
const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;

/** Card with a heading, optional subtitle and an optional control on the right */
const Panel: React.FC<{ title: string; subtitle?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, subtitle, action, children, className = '' }) => (
    <section className={`card p-4 md:p-6 ${className}`} aria-label={title}>
        <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
                <h2 className="heading-3">{title}</h2>
                {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
            </div>
            {action}
        </div>
        {children}
    </section>
);

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="h-40 flex items-center justify-center rounded-[14px] bg-surface-sunken text-sm text-muted text-center px-6">{children}</div>
);

/** Tooltip in the app's card style */
const ChartTip: React.FC<{ active?: boolean; label?: string | number; lines: (label: string | number) => React.ReactNode }> = ({ active, label, lines }) =>
    active && label !== undefined ? (
        <div className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm shadow-[var(--elev-md)]">{lines(label)}</div>
    ) : null;

export const TrackAnalytics: React.FC<TrackAnalyticsProps> = ({ stats, dailyLog, fastingState }) => {
    const summaries = usePrewarmed(analyticsSummariesData) ?? [];
    const dayTypes = usePrewarmed(analyticsDayTypesData) ?? {};
    const [period, setPeriod] = useState<AnalyticsPeriod>(() => {
        try { return (localStorage.getItem(PERIOD_KEY) as AnalyticsPeriod) || 'month'; } catch { return 'month'; }
    });
    const changePeriod = (next: AnalyticsPeriod) => {
        setPeriod(next);
        try { localStorage.setItem(PERIOD_KEY, next); } catch { /* per-device preference */ }
    };
    const [showProjection, setShowProjection] = useState(false);

    const periodDays = PERIODS.find(p => p.value === period)!.days;
    const targetFast = fastingState.config.targetFastHours || 16;
    const days = useMemo(() => buildDays(periodDays, summaries, dayTypes, stats, dailyLog), [periodDays, summaries, dayTypes, stats, dailyLog]);
    const byDate = useMemo(() => new Map(days.map(d => [d.date, d])), [days]);
    const summary = useMemo(() => summarize(days, targetFast), [days, targetFast]);
    const weight = useMemo(() => weightSummary(stats.weightHistory, periodDays, stats.goalWeight), [stats.weightHistory, periodDays, stats.goalWeight]);
    const workoutTypes = useMemo(() => {
        const since = days[0].date;
        return [
            ...summaries.filter(s => s.date >= since && s.date !== localDateString()).flatMap(s => s.workoutTypes || []),
            ...(dailyLog.workouts || []).map(w => w.type),
        ];
    }, [summaries, days, dailyLog]);
    const insights = useMemo(() => insightsFor(days, summary, workoutTypes), [days, summary, workoutTypes]);

    const tickDate = (date: string) => period === 'week'
        ? parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' })
        : shortDate(date);
    const tickInterval = period === 'week' ? 0 : period === 'month' ? 6 : 14;

    // Calorie, fasting and movement series: unlogged days stay empty so they show as gaps
    const calorieData = days.map(d => ({ ...d, eaten: d.logged ? d.calories : null }));
    const fastData = days.map(d => ({ ...d, fast: d.fastHours }));
    const moveData = days.map(d => ({ ...d, kcal: d.burned > 0 ? d.burned : null }));

    // --- Weight chart geometry ---
    const weightDomain = (() => {
        if (weight.points.length === 0) return undefined;
        // Fit the weigh-ins; include the goal only when projecting towards it
        const ys = weight.points.map(p => p.weight).concat(showProjection && stats.goalWeight > 0 ? [stats.goalWeight] : []);
        return [Math.floor(Math.min(...ys) - 1), Math.ceil(Math.max(...ys) + 1)] as [number, number];
    })();
    const lastPoint = weight.points[weight.points.length - 1];
    const projectionEnd = showProjection && weight.goalDate && lastPoint
        ? { x: parseLocalDate(weight.goalDate).getTime(), y: stats.goalWeight }
        : null;
    const xDomain: [number, number] | undefined = weight.points.length
        ? [weight.points[0].time, Math.max(lastPoint.time, projectionEnd?.x ?? 0) + 86_400_000]
        : undefined;

    const tiles: { label: string; icon: React.ElementType; tone: string; value: string; sub: string }[] = [
        {
            label: 'Weight', icon: Scale, tone: 'tile-weight',
            value: weight.current !== null ? `${weight.current.toFixed(1)} kg` : '—',
            sub: weight.current === null ? 'No weigh-ins yet'
                : weight.change !== null && !weight.fallback ? `${signed(weight.change)} kg this ${period === 'quarter' ? 'quarter' : period}`
                : weight.toGoal !== null ? `${Math.abs(weight.toGoal).toFixed(1)} kg to goal` : 'Latest weigh-in',
        },
        {
            label: 'Calories', icon: Flame, tone: 'tile-calories',
            value: summary.avgCalories !== null ? `${fmt(summary.avgCalories)} kcal` : '—',
            sub: summary.loggedDays ? `Daily average · ${summary.daysOnTarget} of ${summary.loggedDays} days on target` : 'Nothing logged yet',
        },
        {
            label: 'Fasting', icon: Timer, tone: 'tile-fasting',
            value: summary.avgFast !== null ? `${summary.avgFast.toFixed(1)} h` : '—',
            sub: summary.longestFast !== null ? `Average · longest ${summary.longestFast.toFixed(1)} h` : 'No fasts recorded',
        },
        {
            label: 'Movement', icon: Activity, tone: 'tile-workout',
            value: `${summary.workouts} ${summary.workouts === 1 ? 'workout' : 'workouts'}`,
            sub: summary.burned ? `${fmt(summary.burned)} kcal burned` : 'None logged',
        },
        {
            label: 'Water', icon: Droplets, tone: 'tile-water',
            value: summary.avgWater !== null ? `${(summary.avgWater / 1000).toFixed(1)} L` : '—',
            sub: summary.waterDaysLogged ? `Daily average · goal met ${summary.waterDaysMet} of ${summary.waterDaysLogged} days` : 'None logged',
        },
    ];

    // --- Consistency calendar: whole weeks (Mon–Sun) covering the period, at least four ---
    const today = localDateString();
    const weeks = Math.max(4, Math.ceil(periodDays / 7));
    const thisMonday = addDays(today, -((parseLocalDate(today).getDay() + 6) % 7));
    const calendarWeeks = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(thisMonday, (w - weeks + 1) * 7 + d)));
    const cellStyle = (day: AnalyticsDay | undefined, date: string): React.CSSProperties => {
        if (date > today) return { background: 'transparent', border: '1px dashed var(--border)' };
        if (!day || (!day.logged && day.water === 0 && day.workouts === 0)) return { background: 'var(--surface-sunken)' };
        const met = Number(day.goals.calories) + Number(day.goals.water) + Number(day.goals.movement);
        return { background: `color-mix(in srgb, var(--weight) ${[22, 45, 70, 100][met]}%, var(--surface-sunken))` };
    };
    const cellLabel = (day: AnalyticsDay | undefined, date: string) => {
        if (date > today) return `${longDate(date)}: upcoming`;
        if (!day || (!day.logged && day.water === 0 && day.workouts === 0)) return `${longDate(date)}: nothing logged`;
        const met = [day.goals.calories && 'calories', day.goals.water && 'water', day.goals.movement && 'movement'].filter(Boolean);
        return `${longDate(date)}: ${met.length ? `met ${met.join(', ')}` : 'logged, no goals met'}`;
    };
    // Calendar can reach back before the period: look those days up too
    const calendarDays = useMemo(() => {
        const span = weeks * 7 + 7;
        return span > periodDays ? new Map(buildDays(Math.min(span, 90), summaries, dayTypes, stats, dailyLog).map(d => [d.date, d])) : byDate;
    }, [weeks, periodDays, summaries, dayTypes, stats, dailyLog, byDate]);

    return (
        <div className="space-y-4 md:space-y-5 pb-4">
            {/* Period */}
            <div className="flex items-center justify-between gap-3">
                <div role="radiogroup" aria-label="Period" className="inline-flex p-1 rounded-full bg-surface-sunken">
                    {PERIODS.map(p => (
                        <button
                            key={p.value}
                            role="radio"
                            aria-checked={period === p.value}
                            onClick={() => changePeriod(p.value)}
                            className={`min-h-9 px-3.5 sm:px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${period === p.value ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <p className="hidden sm:block text-sm text-muted text-right">{shortDate(days[0].date)} – {shortDate(today)}</p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 md:gap-3">
                {tiles.map(({ label, icon: Icon, tone, value, sub }, i) => (
                    <div key={label} className={`tile ${tone} gap-1 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}>
                        <span className="flex items-center gap-1.5 text-xs font-semibold"><Icon size={14} aria-hidden="true" /> {label}</span>
                        <span className="font-display font-extrabold text-2xl leading-8 whitespace-nowrap">{value}</span>
                        <span className="text-xs font-semibold leading-snug">{sub}</span>
                    </div>
                ))}
            </div>

            {/* Weight */}
            <Panel
                title="Weight"
                subtitle={
                    weight.fallback ? `${weight.inPeriod ? 'One weigh-in' : 'No weigh-ins'} this ${period === 'quarter' ? 'quarter' : period}; showing your last ${weight.points.length}`
                        : weight.ratePerWeek !== null ? `Trend ${signed(weight.ratePerWeek, 2)} kg a week${stats.goalWeight ? ` · goal ${stats.goalWeight} kg` : ''}`
                        : stats.goalWeight ? `Goal ${stats.goalWeight} kg` : undefined
                }
                action={weight.goalDate ? (
                    <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer shrink-0">
                        <input type="checkbox" checked={showProjection} onChange={e => setShowProjection(e.target.checked)} className="size-4 accent-[var(--weight)]" />
                        Projection
                    </label>
                ) : undefined}
            >
                {weight.points.length < 2 ? (
                    <Empty>{weight.points.length === 1 ? 'One weigh-in so far. Weigh in again to see a trend.' : 'No weigh-ins yet. Log your weight on Today to see a trend.'}</Empty>
                ) : (
                    <>
                        <div className="h-56 md:h-64">
                            <ChartContainer>
                                <LineChart data={weight.points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="time" type="number" scale="time" domain={xDomain} tick={AXIS} tickLine={false} axisLine={false}
                                        tickFormatter={t => shortDate(localDateString(new Date(t)))} minTickGap={24} />
                                    <YAxis domain={weightDomain} allowDecimals={false} tickCount={5} tick={AXIS} tickLine={false} axisLine={false} width={44} />
                                    <Tooltip content={({ active, label }) => (
                                        <ChartTip active={active} label={label} lines={l => {
                                            const p = weight.points.find(x => x.time === l);
                                            return p ? <><p className="text-muted">{longDate(p.date)}</p><p className="font-semibold">{p.weight.toFixed(1)} kg</p></> : null;
                                        }} />
                                    )} />
                                    {stats.goalWeight > 0 && (
                                        <ReferenceLine y={stats.goalWeight} ifOverflow="hidden" stroke="var(--weight)" strokeDasharray="4 4"
                                            label={{ value: `Goal ${stats.goalWeight}`, position: 'insideBottomRight', fill: 'var(--weight-text)', fontSize: 12 }} />
                                    )}
                                    {projectionEnd && (
                                        <ReferenceLine segment={[{ x: lastPoint.time, y: lastPoint.weight }, projectionEnd]} stroke="var(--text-muted)" strokeDasharray="6 4" ifOverflow="extendDomain" />
                                    )}
                                    <Line type="linear" dataKey="weight" stroke="var(--weight)" strokeWidth={2.5} dot={{ r: 3.5, fill: 'var(--weight)' }} activeDot={{ r: 5 }} isAnimationActive={false} />
                                </LineChart>
                            </ChartContainer>
                        </div>
                        {showProjection && weight.goalDate && (
                            <p className="text-sm text-muted mt-3">At this pace you'd reach {stats.goalWeight} kg around {parseLocalDate(weight.goalDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.</p>
                        )}
                    </>
                )}
            </Panel>

            {/* Calories */}
            <Panel
                title="Calories"
                subtitle={summary.loggedDays ? `Each day against that day's target · ${summary.loggedDays} of ${days.length} days logged` : undefined}
            >
                {summary.loggedDays === 0 ? <Empty>No food logged in this period.</Empty> : (
                    <>
                        <div className="h-56 md:h-64">
                            <ChartContainer>
                                <ComposedChart data={calorieData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={tickDate} interval={tickInterval} />
                                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
                                    <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={({ active, label }) => (
                                        <ChartTip active={active} label={label} lines={l => {
                                            const d = byDate.get(String(l));
                                            if (!d) return null;
                                            return <><p className="text-muted">{longDate(d.date)}{d.isFastDay ? ' · fast day' : ''}</p>
                                                <p className="font-semibold">{d.logged ? `${fmt(d.calories)} of ${fmt(d.calorieTarget)} kcal` : 'Nothing logged'}</p></>;
                                        }} />
                                    )} />
                                    <Bar dataKey="eaten" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
                                        {calorieData.map(d => <Cell key={d.date} fill={d.calories > d.calorieTarget ? 'var(--warning)' : 'var(--calories)'} />)}
                                    </Bar>
                                    <Line type="stepAfter" dataKey="calorieTarget" stroke="var(--text-muted)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                </ComposedChart>
                            </ChartContainer>
                        </div>
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted">
                            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-calories" aria-hidden="true" /> Within target</li>
                            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" aria-hidden="true" /> Over target</li>
                            <li className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-[var(--text-muted)]" aria-hidden="true" /> Target (lower on fast days)</li>
                        </ul>
                    </>
                )}
            </Panel>

            <div className="grid lg:grid-cols-2 gap-4 md:gap-5">
                {/* Fasting */}
                <Panel title="Fasting" subtitle={summary.fastCount ? `Longest fast ending each day · target ${targetFast} h` : undefined}>
                    {summary.fastCount === 0 ? <Empty>No fasts recorded in this period. Fasts are measured between logged meals.</Empty> : (
                        <div className="h-48 md:h-56">
                            <ChartContainer>
                                <BarChart data={fastData} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={tickDate} interval={tickInterval} />
                                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} unit=" h" allowDecimals={false} />
                                    <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={({ active, label }) => (
                                        <ChartTip active={active} label={label} lines={l => {
                                            const d = byDate.get(String(l));
                                            return d ? <><p className="text-muted">{longDate(d.date)}</p><p className="font-semibold">{d.fastHours !== null ? `${d.fastHours.toFixed(1)} h fast` : 'No fast recorded'}</p></> : null;
                                        }} />
                                    )} />
                                    <ReferenceLine y={targetFast} stroke="var(--fasting)" strokeDasharray="4 4" />
                                    <Bar dataKey="fast" fill="var(--fasting)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                                </BarChart>
                            </ChartContainer>
                        </div>
                    )}
                </Panel>

                {/* Movement */}
                <Panel title="Movement" subtitle={summary.workouts ? `Calories burned in workouts · ${summary.workouts} ${summary.workouts === 1 ? 'workout' : 'workouts'}` : undefined}>
                    {summary.workouts === 0 ? <Empty>No workouts logged in this period.</Empty> : (
                        <div className="h-48 md:h-56">
                            <ChartContainer>
                                <BarChart data={moveData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                                    <CartesianGrid vertical={false} stroke="var(--border)" />
                                    <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={tickDate} interval={tickInterval} />
                                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
                                    <Tooltip cursor={{ fill: 'var(--surface-sunken)' }} content={({ active, label }) => (
                                        <ChartTip active={active} label={label} lines={l => {
                                            const d = byDate.get(String(l));
                                            return d ? <><p className="text-muted">{longDate(d.date)}</p><p className="font-semibold">{d.workouts ? `${d.workouts} ${d.workouts === 1 ? 'workout' : 'workouts'} · ${fmt(d.burned)} kcal` : 'No workout'}</p></> : null;
                                        }} />
                                    )} />
                                    <Bar dataKey="kcal" fill="var(--workout)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                                </BarChart>
                            </ChartContainer>
                        </div>
                    )}
                </Panel>
            </div>

            {/* Consistency */}
            <Panel title="Consistency" subtitle="Each square is a day: darker means more goals met (calories, water, movement)">
                <div className="overflow-x-auto no-scrollbar">
                    <div className="inline-grid grid-flow-col gap-1.5" style={{ gridTemplateRows: 'auto repeat(7, 1fr)' }}>
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
                                            className={`size-6 md:size-7 rounded-[6px] ${date === today ? 'ring-2 ring-ink ring-offset-1 ring-offset-[var(--surface)]' : ''}`}
                                            style={cellStyle(day, date)}
                                        />
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-muted">
                    <span>Not logged</span>
                    <span className="size-3 rounded-[3px]" style={{ background: 'var(--surface-sunken)' }} aria-hidden="true" />
                    {[22, 45, 70, 100].map(p => (
                        <span key={p} className="size-3 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--weight) ${p}%, var(--surface-sunken))` }} aria-hidden="true" />
                    ))}
                    <span>All three goals</span>
                </div>
            </Panel>

            {/* Insights */}
            {insights.length > 0 && (
                <Panel title="Insights">
                    <ul className="space-y-2.5">
                        {insights.map(text => (
                            <li key={text} className="flex items-start gap-2.5">
                                <span className="mt-0.5 size-6 shrink-0 rounded-full bg-surface-sunken flex items-center justify-center text-muted" aria-hidden="true"><Lightbulb size={14} /></span>
                                <span className="leading-relaxed">{text}</span>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}
        </div>
    );
};
