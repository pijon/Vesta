import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, CircleAlert, Minus, Plus, TrendingDown } from 'lucide-react';
import { DailySummary, UserStats } from '../types';
import {
  DEFAULT_LOSS_RATE, EnergyEstimate, KCAL_PER_KG, MIN_BURN_MARGIN, MIN_LOGGED_DAYS, NOURISH_BELOW_BURN, MIN_WEIGH_INS, MIN_WEIGH_SPAN_DAYS,
  TargetSuggestion, burnRange, estimateEnergyFor, rangeLimit, planFastDays, planOutcome, suggestTargets,
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
    const suggestion = suggestTargets(estimate, stats, planFastDays(stats, estimate), rate);
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

/** The research the burn estimate follows, listed under "How this is worked out": recent work first, then where the method comes from */
const METHOD_SOURCES = [
  { title: 'Santos-Báez et al. 2025, BMC Medical Research Methodology', note: 'measuring intake the same way, as what you burn plus the change in body energy, to show how often food logs are off.', url: 'https://pubmed.ncbi.nlm.nih.gov/40287632/' },
  { title: 'Schroor et al. 2024, Advances in Nutrition', note: 'a meta-analysis of 28 trials: 5:2 and other intermittent diets lose about the same as eating less every day.', url: 'https://pubmed.ncbi.nlm.nih.gov/37827491/' },
  { title: 'Vuorinen et al. 2021, Journal of Medical Internet Research', note: '10,000 smart scale users: weighing more often went with more weight lost, and long breaks with gains.', url: 'https://pubmed.ncbi.nlm.nih.gov/34075879/' },
  { title: 'Ravelli & Schoeller 2020, Frontiers in Nutrition', note: 'on why food logs tend to miss part of what is eaten.', url: 'https://pubmed.ncbi.nlm.nih.gov/32719809/' },
  { title: 'Hall & Chow 2011, American Journal of Clinical Nutrition', note: 'the method: intake from repeated weigh-ins, and how many it takes.', url: 'https://pubmed.ncbi.nlm.nih.gov/21562087/' },
  { title: 'Hall & Chow 2013, International Journal of Obesity', note: 'on the energy in a kilo of weight change.', url: 'https://pubmed.ncbi.nlm.nih.gov/23774459/' },
] as const;

/** The panel's steppers move in this many kcal */
const KCAL_STEP = 50;
const FAST_DAY_CHOICES = [0, 1, 2, 3] as const;

/** One target with − and + buttons around a number you can also type */
const KcalStepper: React.FC<{ label: string; value: number; onChange: (value: number) => void; min: number; max: number }> = ({ label, value, onChange, min, max }) => {
  const [text, setText] = useState<string | null>(null); // what's being typed; null shows the value
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = () => {
    const n = parseInt(text ?? '', 10);
    if (Number.isFinite(n)) onChange(clamp(n));
    setText(null);
  };
  const step = (delta: number) => onChange(clamp(Math.round((value + delta) / KCAL_STEP) * KCAL_STEP));
  const button = (delta: number, Icon: typeof Plus, what: string) => (
    <button type="button" onClick={() => step(delta)} aria-label={`${what} ${label.toLowerCase()} by ${KCAL_STEP} kcal`} className="icon-btn !size-11 shrink-0 bg-surface border-transparent">
      <Icon size={18} aria-hidden="true" />
    </button>
  );
  return (
    <div>
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      <div className="flex items-center gap-2">
        {button(-KCAL_STEP, Minus, 'Lower')}
        <label className="flex-1 flex items-center justify-center gap-1 rounded-full bg-surface min-h-11 px-3">
          <span className="sr-only">{label} in kcal</span>
          <input
            value={text ?? value.toLocaleString()}
            onChange={e => setText(e.target.value.replace(/\D/g, ''))}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            onFocus={e => { setText(String(value)); requestAnimationFrame(() => e.target.select()); }}
            inputMode="numeric"
            className="w-20 bg-transparent text-right font-display font-extrabold text-[20px] leading-7 tracking-tight focus:outline-none"
          />
          <span className="text-sm text-muted">kcal</span>
        </label>
        {button(KCAL_STEP, Plus, 'Raise')}
      </div>
    </div>
  );
};

/** In words, what a week of the plan gives: "About 0.4 kg a week", "About your burn", "About 0.2 kg a week up" */
export const paceText = (weeklyLoss: number) => {
  const kgWeek = Math.round(Math.abs(weeklyLoss) * 20) / 20;
  if (kgWeek < 0.05) return 'About the same as you burn';
  return `About ${kg(kgWeek)} kg a week ${weeklyLoss > 0 ? 'down' : 'up'}`;
};

/**
 * Analytics panel, once the burn is known: your burn, and a calculator for the week. Changing the fast
 * days and the kcal of fast and nourish days shows at once what pace and goal date that gives; Save
 * makes them your targets, and Sunday's check-in then keeps that pace as your burn changes.
 */
export const EnergyPanel: React.FC<PanelProps> = ({ stats, summaries, dayTypes, onUpdateStats, currentWeight }) => {
  const { estimate } = useEnergy(stats, summaries, dayTypes);
  const saved = useMemo(() => ({
    fastDays: planFastDays(stats, estimate),
    fast: stats.dailyCalorieGoal,
    nourish: stats.nonFastDayCalories || 2000,
  }), [stats, estimate]);
  const [plan, setPlan] = useState(saved);
  /** Changed here and not saved yet; until then the panel follows the saved targets (a check-in, Settings) */
  const [touched, setTouched] = useState(false);
  const [savedNow, setSavedNow] = useState(false);
  useEffect(() => { if (!touched) setPlan(saved); }, [saved, touched]);
  const dirty = plan.fastDays !== saved.fastDays || plan.fast !== saved.fast || plan.nourish !== saved.nourish;

  if (!estimate.ready || estimate.expenditure === null) return null;
  const outcome = planOutcome(estimate, stats, plan)!;
  const range = burnRange(estimate);
  const loss = Math.round(outcome.weeklyLoss * 100) / 100;
  const goalDate = currentWeight !== null && loss > 0.02 ? goalDateAtPace(currentWeight, stats.goalWeight, loss) : null;
  const change = (next: Partial<typeof plan>) => { setPlan(p => ({ ...p, ...next })); setTouched(true); setSavedNow(false); };
  const save = () => {
    onUpdateStats({ ...stats, dailyCalorieGoal: plan.fast, nonFastDayCalories: plan.nourish, fastDaysPerWeek: plan.fastDays, weeklyLossGoal: loss });
    setTouched(false);
    setSavedNow(true);
  };

  return (
    <section className="card p-4 md:p-6" aria-labelledby="energy-title">
      <div className="flex items-center gap-3 mb-4">
        <span className="icon-tile size-10 shrink-0 tile-weight flex items-center justify-center"><TrendingDown size={18} strokeWidth={2.25} aria-hidden="true" /></span>
        <h2 id="energy-title" className="heading-3">Your pace</h2>
      </div>

      {/* Phones: one column. From md: burn and the plan on the left, what it gives and Save on the right */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-6 md:items-start">
        <div className="space-y-3 min-w-0">
          <div className="rounded-[20px] bg-surface-sunken p-4">
            <p className="text-sm text-muted">You burn</p>
            <p className="font-display font-extrabold text-[22px] leading-7 tracking-tight">{approx(estimate.expenditure)} kcal a day</p>
            {range && <p className="text-sm text-muted">likely {range[0].toLocaleString()}–{range[1].toLocaleString()}</p>}
          </div>

          <div className="rounded-[20px] bg-surface-sunken p-4 space-y-4">
            <div>
              <span className="block text-sm font-semibold mb-1.5" id="fast-days-label">Fast days a week</span>
              <div role="radiogroup" aria-labelledby="fast-days-label" className="grid grid-cols-4 p-1 rounded-full bg-surface">
                {FAST_DAY_CHOICES.map(n => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={plan.fastDays === n}
                    onClick={() => change({ fastDays: n })}
                    className={`min-h-9 rounded-full text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${plan.fastDays === n ? 'bg-ink text-on-ink' : 'text-muted hover:text-main'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {plan.fastDays > 0 && <KcalStepper label="Fast days" value={plan.fast} onChange={fast => change({ fast })} min={400} max={3000} />}
            <KcalStepper label={plan.fastDays > 0 ? 'Nourish days' : 'Every day'} value={plan.nourish} onChange={nourish => change({ nourish })} min={800} max={6000} />
            <button type="button" onClick={() => change({ nourish: Math.round(outcome.maintenance / KCAL_STEP) * KCAL_STEP })} className="chip text-sm">
              {plan.fastDays > 0 ? 'Nourish days' : 'Every day'} at your burn ({fmt(Math.round(outcome.maintenance / 10) * 10)}{estimate.avgWorkoutBurn > 0 ? ' without workouts' : ''})
            </button>
          </div>
        </div>

        <div className="min-w-0 px-1 md:px-0 md:pl-6 md:border-l md:border-border md:py-2">
          <div aria-live="polite">
            <p className="text-sm text-muted">With this plan</p>
            <p className="font-display font-extrabold text-[22px] md:text-[32px] leading-7 md:leading-9 tracking-tight">{paceText(outcome.weeklyLoss)}</p>
            {goalDate && <p className="font-semibold mt-1">{stats.goalWeight} kg around {monthYear(goalDate)}</p>}
            <p className="text-sm text-muted mt-1">
              {fmt(outcome.weeklyIntake)} kcal a week, {approx(Math.abs(outcome.weeklyDeficit))} {outcome.weeklyDeficit >= 0 ? 'under' : 'over'} your burn.
            </p>
            {outcome.nourishNearFast && (
              <p className="text-sm mt-3 flex items-start gap-1.5 text-warning">
                <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                Nourish days more than {NOURISH_BELOW_BURN} kcal under your burn are close to a fast day. Lower fast days are the easier way to go faster.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-5">
            {dirty ? (
              <>
                <button onClick={save} className="btn-primary btn-sm">Save targets</button>
                <button onClick={() => { setPlan(saved); setTouched(false); }} className="btn-ghost btn-sm">Reset</button>
              </>
            ) : (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold"><Check size={16} aria-hidden="true" /> {savedNow ? 'Targets saved' : 'These are your targets'}</p>
            )}
          </div>
          <p className="text-xs text-muted mt-2">Sunday's check-in keeps this pace as your burn changes, moving nourish days at most 150 kcal a week.</p>
        </div>
      </div>

      <details className="group mt-5 border-t border-border pt-4">
        <summary className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
          <ChevronRight size={16} className="transition-transform group-open:rotate-90" aria-hidden="true" /> How this is worked out
        </summary>
        <div className="mt-3 space-y-2 text-sm text-muted">
          <p>
            From {fmt(estimate.avgIntake!)} kcal a day over {estimate.loggedDays} fully logged days
            {estimate.fastAvgIntake !== null && estimate.nourishAvgIntake !== null
              ? ` (${fmt(estimate.fastAvgIntake)} on fast days, ${fmt(estimate.nourishAvgIntake)} on the rest, weighted for ${estimate.fastDays} fast days in ${estimate.windowDays})`
              : ''}
            {', while your weight moved'}
            {' '}{estimate.weightChangePerWeek! > 0 ? '+' : '−'}{kg(Math.abs(estimate.weightChangePerWeek!))} kg a week.
            {estimate.avgWorkoutBurn > 0 && ` That includes about ${fmt(estimate.avgWorkoutBurn)} kcal a day from workouts.`}
          </p>
          {rangeAdvice(estimate) && <p>{rangeAdvice(estimate)}</p>}
          <p>It's in your own logging terms: if you usually log a bit less than you eat, it reads low, and your targets allow for that.</p>
          <p>The pace counts a kilo as about {KCAL_PER_KG.toLocaleString()} kcal. On 5:2 the fast days make most of the deficit, so nourish days near your burn still lose weight.</p>
          <p>
            {(stats.workoutCalorieCredit ?? 1) === 1 ? 'Workout calories are added on the day, so they are left out of your burn here.'
              : stats.workoutCalorieCredit === 0.5 ? 'Half of workout calories are added on the day, so that half is left out of your burn here.'
              : "Workout calories aren't added on the day."}
          </p>
          <p>
            The method is energy balance: what you burn is what you eat, less the energy your body stored or used, read
            from the slope of a straight line through your weigh-ins. Your intake is averaged over the last four weeks
            of fully logged days, fast and nourish days apart; breaks and the days after them are left out. The range is
            an 80% band from how much your weigh-ins and logged days scatter, and it never gets narrower than
            ±{MIN_BURN_MARGIN.toLocaleString()} kcal.
          </p>
          <div>
            <p>Based on:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {METHOD_SOURCES.map(source => (
                <li key={source.url}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-main underline underline-offset-2 hover:text-primary">{source.title}</a>
                  {' '}{source.note}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
};
