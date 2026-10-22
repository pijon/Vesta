import React, { useMemo, useState } from 'react';
import { Check, TrendingDown } from 'lucide-react';
import { DailySummary, UserStats } from '../types';
import {
  DEFAULT_LOSS_RATE, EnergyEstimate, LOSS_RATES, MIN_LOGGED_DAYS, MIN_NOURISH_TARGET, MIN_WEIGH_INS, MIN_WEIGH_SPAN_DAYS,
  TargetSuggestion, burnRange, estimateEnergyFor, rangeLimit, fastDaysPerWeek, suggestTargets,
} from '../utils/energyModel';
import { goalDateAtPace } from '../utils/analyticsModel';
import { parseLocalDate } from '../utils/dateUtils';

const fmt = (n: number) => Math.round(n).toLocaleString();
/** Burn is an estimate; tens are as precise as it gets */
const approx = (n: number) => (Math.round(n / 10) * 10).toLocaleString();
const kg = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** The suggestion is only worth acting on when it differs this much from the current target */
const MEANINGFUL_CHANGE = 50;

export interface EnergyState {
  estimate: EnergyEstimate;
  suggestion: TargetSuggestion | null;
  rate: number;
  /** Suggestion differs enough from the current nourish target to bring up */
  differs: boolean;
}

/** Burn estimate and suggested target from the last four weeks of logs, weigh-ins and day types. */
export const useEnergy = (stats: UserStats, summaries: DailySummary[], dayTypes: Record<string, string>, rateOverride?: number): EnergyState =>
  useMemo(() => {
    const estimate = estimateEnergyFor(stats, summaries, dayTypes);
    const rate = rateOverride ?? stats.weeklyLossGoal ?? DEFAULT_LOSS_RATE;
    const suggestion = suggestTargets(estimate, stats, fastDaysPerWeek(dayTypes, estimate), rate);
    const current = stats.nonFastDayCalories || 2000;
    return { estimate, suggestion, rate, differs: !!suggestion && Math.abs(suggestion.nourish - current) >= MEANINGFUL_CHANGE };
  }, [stats, summaries, dayTypes, rateOverride]);

const Progress: React.FC<{ label: string; value: number; of: number; hint?: string }> = ({ label, value, of, hint }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="font-semibold">{label}</span>
      <span className="text-muted whitespace-nowrap inline-flex items-center gap-1">
        {value >= of && <Check size={14} strokeWidth={3} className="text-weight-text" aria-label="Done" />}
        {Math.min(value, of)} of {of}
      </span>
    </div>
    <div className="mt-1.5 h-2 rounded-full bg-surface-sunken overflow-hidden" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={of} aria-valuenow={Math.min(value, of)}>
      <div className="h-full rounded-full bg-weight transition-[width] duration-700" style={{ width: `${Math.min(value / of, 1) * 100}%` }} />
    </div>
    {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
  </div>
);

const plural = (n: number, one: string, many: string) => `${n} more ${n === 1 ? one : many}`;
/** What's still missing, in words: "4 more fully logged days and 1 more weigh-in" */
export const stillNeeded = (estimate: EnergyEstimate) => {
  const parts: string[] = [];
  if (estimate.loggedDays < MIN_LOGGED_DAYS) parts.push(plural(MIN_LOGGED_DAYS - estimate.loggedDays, 'fully logged day', 'fully logged days'));
  if (estimate.weighIns < MIN_WEIGH_INS) parts.push(plural(MIN_WEIGH_INS - estimate.weighIns, 'weigh-in', 'weigh-ins'));
  else if (estimate.weighSpanDays < MIN_WEIGH_SPAN_DAYS) parts.push('weigh-ins spread over two weeks');
  return parts.length ? parts.join(' and ') : 'a little more data';
};

/** What's still needed before the estimate can be made */
const Requirements: React.FC<{ estimate: EnergyEstimate }> = ({ estimate }) => (
  <div className="space-y-3">
    <Progress label="Fully logged days" value={estimate.loggedDays} of={MIN_LOGGED_DAYS} hint="In the last four weeks, drinks included. A day under 60% of its target only counts if you mark it complete on Today." />
    <Progress
      label="Weigh-ins"
      value={estimate.weighIns}
      of={MIN_WEIGH_INS}
      hint={estimate.weighIns >= MIN_WEIGH_INS && estimate.weighSpanDays < MIN_WEIGH_SPAN_DAYS
        ? `Spread them over at least two weeks (now ${estimate.weighSpanDays} days apart).`
        : 'On different days, about three a week; every day is best. Same time of day, for example in the morning before breakfast.'}
    />
  </div>
);

/** Guidance row while the burn can't be worked out yet: what's missing, and how far along it is */
export const BurnUnlock: React.FC<{ estimate: EnergyEstimate }> = ({ estimate }) => (
  <div className="flex gap-3">
    <span className="icon-tile size-9 shrink-0 tile-weight flex items-center justify-center"><TrendingDown size={18} strokeWidth={2.25} aria-hidden="true" /></span>
    <div className="flex-1 min-w-0">
      <p className="font-semibold leading-snug">{stillNeeded(estimate).replace(/^./, c => c.toUpperCase())}</p>
      <p className="text-sm text-muted mt-1 mb-3">Then Vesta can work out your daily burn and a calorie target for the pace you want.</p>
      <Requirements estimate={estimate} />
    </div>
  </div>
);

/** What widens the burn's range most, and what would narrow it */
export const rangeAdvice = (estimate: EnergyEstimate): string | null => {
  const limit = rangeLimit(estimate);
  if (!limit) return null;
  const narrower = limit.daily !== null ? ` would narrow it to about ±${fmt(limit.daily)}` : '';
  if (limit.cause === 'floor') return 'That range is as narrow as this kind of estimate gets.';
  if (limit.cause === 'weighIns') {
    return limit.daily !== null
      ? `The range is mostly down to the weigh-ins (${estimate.weighIns} days in four weeks). Weighing in every day${narrower}.`
      : 'The range is mostly down to day-to-day swings on the scale. Weighing at the same time each morning helps.';
  }
  return limit.daily !== null
    ? `The range is mostly down to how much your logged days vary, with ${estimate.loggedDays} of 28 counted. Logging every day fully${narrower}.`
    : 'The range is mostly down to how much your days vary.';
};

const monthYear = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

interface PanelProps {
  stats: UserStats;
  summaries: DailySummary[];
  dayTypes: Record<string, string>;
  onUpdateStats: (stats: UserStats) => void;
  /** Current trend weight, for the goal date at each pace */
  currentWeight: number | null;
}

/** Analytics panel, once the burn is known: a pace, when it reaches the goal, and the target for it. */
export const EnergyPanel: React.FC<PanelProps> = ({ stats, summaries, dayTypes, onUpdateStats, currentWeight }) => {
  const [rate, setRate] = useState<number | undefined>(undefined);
  const { estimate, suggestion, differs, rate: activeRate } = useEnergy(stats, summaries, dayTypes, rate);
  const current = stats.nonFastDayCalories || 2000;
  const [applied, setApplied] = useState(false);
  if (!estimate.ready || estimate.expenditure === null) return null;
  const range = burnRange(estimate);

  const goalDate = currentWeight !== null ? goalDateAtPace(currentWeight, stats.goalWeight, suggestion?.weeklyLoss ?? activeRate) : null;
  const apply = () => {
    if (!suggestion) return;
    onUpdateStats({ ...stats, nonFastDayCalories: suggestion.nourish, weeklyLossGoal: activeRate });
    setApplied(true);
  };

  return (
    <section className="card p-4 md:p-6" aria-labelledby="energy-title">
      <div className="flex items-start gap-3 mb-4">
        <span className="icon-tile size-10 shrink-0 tile-weight flex items-center justify-center"><TrendingDown size={18} strokeWidth={2.25} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 id="energy-title" className="heading-3 pt-2">Your pace</h2>
          <p className="text-sm text-muted mt-1">
            You burn about {approx(estimate.expenditure)} kcal a day
            {range && `, likely between ${range[0].toLocaleString()} and ${range[1].toLocaleString()}`}
            {', worked out from what you eat and how your weight moves. Unlogged food makes it read low.'}
          </p>
          {rangeAdvice(estimate) && <p className="text-xs text-muted mt-1">{rangeAdvice(estimate)}</p>}
        </div>
      </div>

      <div className="rounded-[20px] bg-surface-sunken p-4 md:max-w-md">
        <p className="text-sm font-semibold mb-2" id="rate-label">Lose a week</p>
        <div role="radiogroup" aria-labelledby="rate-label" className="grid grid-cols-4 p-1 rounded-full bg-surface">
          {LOSS_RATES.map(r => (
            <button
              key={r}
              role="radio"
              aria-checked={activeRate === r}
              onClick={() => { setRate(r); setApplied(false); }}
              className={`min-h-9 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${activeRate === r ? 'bg-ink text-on-ink' : 'text-muted hover:text-main'}`}
            >
              {kg(r)} kg
            </button>
          ))}
        </div>

        {suggestion && (
          <>
            {goalDate && <p className="font-display font-extrabold text-[22px] leading-7 tracking-tight mt-4">{stats.goalWeight} kg around {monthYear(goalDate)}</p>}
            <p className={goalDate ? 'mt-1' : 'mt-4'}>
              Nourish days at <span className="font-semibold">{fmt(suggestion.nourish)} kcal</span>
              <span className="text-sm text-muted"> · now {fmt(current)}</span>
            </p>
            <p className="text-xs text-muted mt-1">
              {suggestion.fastDaysPerWeek > 0
                ? `With ${suggestion.fastDaysPerWeek} fast ${suggestion.fastDaysPerWeek === 1 ? 'day' : 'days'} a week at ${fmt(suggestion.fast)} kcal, as you've planned lately.`
                : 'With no fast days, as you\'ve planned lately.'}
              {' '}{(stats.workoutCalorieCredit ?? 1) === 1 ? 'Workout calories are still added on the day.'
                : stats.workoutCalorieCredit === 0.5 ? 'Half of workout calories are added on the day.'
                : 'Workout calories aren\'t added on the day.'}
            </p>
            {suggestion.capped && <p className="text-xs text-muted mt-1">Aiming for {kg(suggestion.weeklyLoss)} kg a week, about 1% of your weight, which is a common upper limit.</p>}
            {suggestion.floored && <p className="text-xs text-muted mt-1">Kept at {fmt(MIN_NOURISH_TARGET)} kcal, so expect a slower pace than this.</p>}
            <div className="mt-4">
              {applied || !differs ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold"><Check size={16} aria-hidden="true" /> {applied ? 'Target updated' : 'Your target already fits this pace'}</p>
              ) : (
                <button onClick={apply} className="btn-primary btn-sm">Use {fmt(suggestion.nourish)} kcal</button>
              )}
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-muted mt-3">
        From {fmt(estimate.avgIntake!)} kcal a day over {estimate.loggedDays} fully logged days
        {estimate.fastAvgIntake !== null && estimate.nourishAvgIntake !== null
          ? ` (${fmt(estimate.fastAvgIntake)} on fast days, ${fmt(estimate.nourishAvgIntake)} on the rest, weighted for ${estimate.fastDays} fast days in 28)`
          : ''}
        {', while your weight moved'}
        {' '}{estimate.weightChangePerWeek! > 0 ? '+' : '−'}{kg(Math.abs(estimate.weightChangePerWeek!))} kg a week.
        {estimate.avgWorkoutBurn > 0 && ` That includes about ${fmt(estimate.avgWorkoutBurn)} kcal a day from workouts.`}
      </p>
    </section>
  );
};
