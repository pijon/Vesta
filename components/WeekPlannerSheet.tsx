import React, { useEffect, useId, useMemo, useState } from 'react';
import { CircleAlert, Flame, Plus, RefreshCw, Repeat, Shuffle, Sparkles, X } from 'lucide-react';
import { DayPlan, MealSlot, Recipe, UserStats } from '../types';
import { getCachedPlansInRange, getDayPlansInRange } from '../services/storageService';
import { readWeekHint } from '../services/geminiService';
import { addDays, dayTarget, emptyDayPlan, isFastDay, mealKcalLabel, PLANNABLE_SLOTS, slotFor } from '../utils/planUtils';
import { DayResult, Proposal, WeekDay, libraryId, pinsOf, planWeek, proposalsOf, slotKey } from '../utils/weekPlanner';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { mealVisualFor } from '../utils/mealVisual';
import { Sheet } from './Sheet';
import { SelectionPill } from './SelectionPill';

interface WeekPlannerSheetProps {
  /** The Planner's days from today on: the ones to fill */
  dates: string[];
  plans: Record<string, DayPlan>;
  recipes: Recipe[];
  stats: UserStats;
  /** Adds the proposals and saves the days whose fast day changed */
  onSave: (proposals: Proposal[], fastDays: Record<string, boolean>) => Promise<void>;
  onClose: () => void;
}

interface Hint { text: string; prefer: Set<string>; avoid: Set<string> }

const longDay = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'long' });
const shortDate = (date: string) => parseLocalDate(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Recipe ids planned over the past two weeks, with how many days ago each was last planned */
const recentFrom = (plans: Record<string, DayPlan>, today: string) => {
  const recent = new Map<string, number>();
  Object.values(plans).forEach(plan => {
    const ago = Math.round((parseLocalDate(today).getTime() - parseLocalDate(plan.date).getTime()) / 86_400_000);
    plan.meals.forEach(meal => {
      const id = libraryId(meal);
      if (!recent.has(id) || recent.get(id)! > ago) recent.set(id, ago);
    });
  });
  return recent;
};

/**
 * Fills the open meals of the days shown with the family's recipes, in one sheet: the plan is made
 * on the device (utils/weekPlanner.ts), so it's there at once and changes as the days are set.
 * A wish for the week goes through the AI only to sort the recipes.
 */
export const WeekPlannerSheet: React.FC<WeekPlannerSheetProps> = ({ dates, plans, recipes, stats, onSave, onClose }) => {
  const pillGroup = useId();
  const today = localDateString();
  // Today is usually under way, so it's left out unless picked
  const [skip, setSkip] = useState<Record<string, boolean>>(() => Object.fromEntries(dates.map(d => [d, d === today])));
  const [fast, setFast] = useState<Record<string, boolean>>(() => Object.fromEntries(dates.map(d => [d, isFastDay(plans[d])])));
  const [fastDayMeals, setFastDayMeals] = useState<2 | 3>(2);
  const [leftovers, setLeftovers] = useState(false);
  const [seed, setSeed] = useState(1);
  const [pins, setPins] = useState<Record<string, string | null>>({});
  const [rejected, setRejected] = useState<Record<string, string[]>>({});
  const [hintText, setHintText] = useState('');
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintState, setHintState] = useState<'idle' | 'reading' | 'failed'>('idle');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // What was planned over the past two weeks, so the plan doesn't repeat it
  const historyStart = addDays(today, -14);
  const historyEnd = addDays(today, -1);
  const [history, setHistory] = useState<Record<string, DayPlan>>(() => getCachedPlansInRange(historyStart, historyEnd) || {});
  useEffect(() => {
    getDayPlansInRange(historyStart, historyEnd).then(setHistory).catch(e => console.error('Failed to load recent plans', e));
  }, []);
  const recent = useMemo(() => recentFrom(history, today), [history, today]);

  const days = useMemo<WeekDay[]>(() => dates.map(date => {
    const isFast = !!fast[date];
    return { date, plan: plans[date] || emptyDayPlan(date), fast: isFast, target: dayTarget({ type: isFast ? 'fast' : 'non-fast' }, stats), skip: !!skip[date] };
  }), [dates, plans, fast, skip, stats]);
  const results = useMemo(
    () => planWeek(days, recipes, { fastDayMeals, leftovers, seed, prefer: hint?.prefer, avoid: hint?.avoid, recent, pins, rejected }),
    [days, recipes, fastDayMeals, leftovers, seed, hint, recent, pins, rejected],
  );
  const proposals = proposalsOf(results);
  const fastChanges = Object.fromEntries(days.filter(d => !d.skip && d.fast !== isFastDay(d.plan)).map(d => [d.date, d.fast]));
  const anyFast = days.some(d => !d.skip && d.fast);

  /** Starts over from the current settings, keeping only slots left open by hand */
  const replan = () => {
    setPins(p => Object.fromEntries(Object.entries(p).filter(([, v]) => v === null)));
    setRejected({});
  };

  /** Changes one slot and keeps every other proposal as it is (the next day's leftovers follow a dinner) */
  const changeSlot = (date: string, slot: MealSlot, change: (pins: Record<string, string | null>) => void) => {
    const next = { ...pinsOf(results), ...Object.fromEntries(Object.entries(pins).filter(([, v]) => v === null)) } as Record<string, string | null>;
    change(next);
    if (slot === 'dinner') {
      const lunch = results.find(r => r.date === addDays(date, 1))?.slots.lunch;
      if (lunch?.kind === 'proposed' && lunch.leftover) delete next[slotKey(addDays(date, 1), 'lunch')];
    }
    setPins(next);
  };

  const swap = (date: string, slot: MealSlot, current: Recipe) => {
    const key = slotKey(date, slot);
    changeSlot(date, slot, next => { delete next[key]; });
    setRejected(r => ({ ...r, [key]: [...(r[key] || []), current.id] }));
  };
  const remove = (date: string, slot: MealSlot) => changeSlot(date, slot, next => { next[slotKey(date, slot)] = null; });
  const fill = (date: string, slot: MealSlot) => changeSlot(date, slot, next => { delete next[slotKey(date, slot)]; });

  const toggleFast = (date: string) => {
    setFast(f => ({ ...f, [date]: !f[date] }));
    // The day's meals are planned again for its new target
    const ofDay = (record: Record<string, unknown>) => Object.fromEntries(Object.entries(record).filter(([k]) => !k.startsWith(`${date}/`)));
    setPins(p => ofDay(p) as Record<string, string | null>);
    setRejected(r => ofDay(r) as Record<string, string[]>);
  };

  const applyHint = async () => {
    const text = hintText.trim();
    if (!text) return;
    setHintState('reading');
    try {
      const { prefer, avoid } = await readWeekHint(text, recipes);
      setHint({ text, prefer: new Set(prefer), avoid: new Set(avoid) });
      setHintText('');
      setHintState('idle');
      replan();
    } catch (e) {
      console.error('Failed to read the wish for the week', e);
      setHintState('failed');
    }
  };

  const save = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave(proposals, fastChanges);
      onClose();
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  };

  const changes = proposals.length + Object.keys(fastChanges).length;
  const saveLabel = proposals.length > 0 ? `Add ${proposals.length} meal${proposals.length === 1 ? '' : 's'}` : changes > 0 ? 'Save fast days' : 'Nothing to add';

  const thumb = (recipe: Recipe) => {
    if (recipe.image) return <img src={recipe.image} alt="" loading="lazy" className="size-10 rounded-full object-cover shrink-0" />;
    const visual = mealVisualFor(recipe);
    return (
      <span className={`size-10 rounded-full shrink-0 flex items-center justify-center ${visual.tint}`} aria-hidden="true">
        <visual.Icon size={18} strokeWidth={2.25} />
      </span>
    );
  };

  const renderSlot = (day: WeekDay, result: DayResult, slot: MealSlot, label: string) => {
    const planned = day.plan.meals.filter(m => slotFor(m) === slot);
    const r = result.slots[slot];
    if (planned.length === 0 && !r) return null;
    const name = `${longDay(day.date)} ${label.toLowerCase()}`;
    return (
      <li key={slot} className="flex flex-col md:flex-row md:items-start md:gap-3 py-2 border-t border-border first:border-t-0">
        <span className="md:w-[4.5rem] shrink-0 md:pt-3 text-xs font-semibold text-muted">{label}</span>
        <div className="flex-1 min-w-0 space-y-1">
          {planned.map(meal => (
            <div key={meal.instanceId || meal.id} className="flex items-center gap-3 min-h-11">
              {thumb(meal)}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-muted leading-snug line-clamp-2 [overflow-wrap:anywhere]">{meal.name}</span>
                <span className="block text-xs text-muted">Already planned · {mealKcalLabel(meal)}</span>
              </span>
            </div>
          ))}
          {r?.kind === 'proposed' && (
            <div className="flex items-center gap-3 min-h-11">
              {thumb(r.recipe)}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold leading-snug line-clamp-2 [overflow-wrap:anywhere]">{r.recipe.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  {r.leftover && <><Repeat size={12} aria-hidden="true" /> Leftovers ·</>} {r.calories} kcal
                </span>
              </span>
              <button onClick={() => swap(day.date, slot, r.recipe)} className="icon-btn size-10 shrink-0 bg-surface-sunken" aria-label={`Swap ${r.recipe.name} on ${name}`}>
                <RefreshCw size={16} />
              </button>
              <button onClick={() => remove(day.date, slot)} className="icon-btn size-10 shrink-0" aria-label={`Leave ${name} open`}>
                <X size={16} />
              </button>
            </div>
          )}
          {r?.kind === 'open' && (
            <div className="flex items-center justify-between gap-3 min-h-11">
              <span className="text-sm text-muted">{r.reason === 'removed' ? 'Left open' : `No ${label.toLowerCase()} recipes yet`}</span>
              {r.reason === 'removed' && (
                <button onClick={() => fill(day.date, slot)} className="btn-ghost btn-sm" aria-label={`Fill ${name}`}><Plus size={16} aria-hidden="true" /> Fill</button>
              )}
            </div>
          )}
          {r?.kind === 'rest' && (
            <p className="min-h-11 flex items-center text-sm text-muted">Skipped on fast days</p>
          )}
        </div>
      </li>
    );
  };

  const renderDay = (day: WeekDay, i: number) => {
    const result = results[i];
    if (day.skip) {
      return (
        <section key={day.date} aria-label={longDay(day.date)} className="flex items-center justify-between gap-3 py-3">
          <span className="min-w-0">
            <span className="font-display font-extrabold text-lg text-muted">{longDay(day.date)}</span>
            <span className="text-xs text-muted ml-2">{day.date === today ? 'Today · ' : ''}not planned</span>
          </span>
          <button onClick={() => setSkip(s => ({ ...s, [day.date]: false }))} className="btn-secondary btn-sm shrink-0" aria-label={`Plan ${longDay(day.date)}`}>
            <Plus size={16} aria-hidden="true" /> Plan
          </button>
        </section>
      );
    }
    const over = !result.incomplete && result.calories > day.target;
    return (
      <section key={day.date} aria-label={longDay(day.date)} className="py-4">
        <header className="flex items-center justify-between gap-2">
          <h3 className="min-w-0 font-display font-extrabold text-lg leading-6">
            {longDay(day.date)} <span className="font-sans font-normal text-xs text-muted">{day.date === today ? 'Today' : shortDate(day.date)}</span>
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => toggleFast(day.date)}
              aria-pressed={day.fast}
              aria-label={`Fast day on ${longDay(day.date)}`}
              className={`inline-flex items-center gap-1 min-h-8 px-2.5 rounded-full text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${day.fast ? 'bg-fasting-bg text-fasting-text' : 'bg-surface-sunken text-muted hover:text-main'}`}
            >
              <Flame size={14} aria-hidden="true" /> {day.fast ? 'Fast day' : 'Make fast day'}
            </button>
            <button onClick={() => setSkip(s => ({ ...s, [day.date]: true }))} className="icon-btn size-9" aria-label={`Don't plan ${longDay(day.date)}`}>
              <X size={16} />
            </button>
          </div>
        </header>
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className={over ? 'text-warning font-semibold' : 'text-muted'}>{result.incomplete ? result.reason : `${result.calories} / ${day.target} kcal`}</span>
            {over && <span className="text-warning font-semibold">{result.calories - day.target} over</span>}
          </div>
          <div className="h-1.5 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${over ? 'bg-warning' : day.fast ? 'bg-fasting' : 'bg-calories'}`}
              style={{ width: `${(result.incomplete ? 0 : Math.min(100, (result.calories / Math.max(day.target, 1)) * 100))}%` }}
            />
          </div>
        </div>
        <ul className="mt-2">
          {PLANNABLE_SLOTS.map(({ slot, label }) => renderSlot(day, result, slot, label))}
        </ul>
      </section>
    );
  };

  const range = dates.length > 1
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).formatRange(parseLocalDate(dates[0]), parseLocalDate(dates[dates.length - 1]))
    : shortDate(dates[0]);

  return (
    <Sheet
      title="Plan the week"
      subtitle={`${range}. Meals you've planned stay; swap anything you don't fancy.`}
      size="lg"
      fixedHeight
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {saveFailed && <p role="alert" className="text-sm text-warning flex items-center gap-1.5"><CircleAlert size={16} aria-hidden="true" /> Couldn't save the plan. Check your connection.</p>}
          <div className="flex gap-2">
            <button onClick={() => { setSeed(s => s + 1); replan(); }} disabled={saving || recipes.length === 0} className="btn-secondary">
              <Shuffle size={16} aria-hidden="true" /> Shuffle
            </button>
            <button onClick={save} disabled={saving || changes === 0} className="btn-primary flex-1">
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        </div>
      }
    >
      {recipes.length === 0 ? (
        <p className="py-8 text-center text-muted">Add a few recipes first, and the week can be filled from them.</p>
      ) : (
        <div className="space-y-4">
          {/* A wish for the week, read by the AI into recipes to favour or leave out */}
          <div className="space-y-2">
            <form onSubmit={e => { e.preventDefault(); applyHint(); }} className="flex gap-2">
              <label htmlFor="week-hint" className="sr-only">Anything for this week?</label>
              <input
                id="week-hint"
                value={hintText}
                onChange={e => { setHintText(e.target.value); if (hintState === 'failed') setHintState('idle'); }}
                placeholder="Anything for this week? More fish, no pasta…"
                className="input flex-1 min-w-0"
                disabled={hintState === 'reading'}
              />
              <button type="submit" disabled={!hintText.trim() || hintState === 'reading'} className="btn-secondary shrink-0 px-4">
                {hintState === 'reading' ? <span className="spinner" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                <span className="sr-only md:not-sr-only">{hintState === 'reading' ? 'Reading…' : 'Apply'}</span>
              </button>
            </form>
            {hintState === 'failed' && <p role="alert" className="text-sm text-warning">Couldn't read that just now. The plan works without it, or try again.</p>}
            {hint && (
              <span className="badge badge-neutral !pr-1 max-w-full">
                <Sparkles size={12} aria-hidden="true" />
                <span className="truncate">{hint.text}</span>
                <button onClick={() => { setHint(null); replan(); }} className="hit-target size-6 rounded-full inline-flex items-center justify-center hover:bg-surface" aria-label={`Stop planning for "${hint.text}"`}>
                  <X size={12} />
                </button>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => { setLeftovers(l => !l); replan(); }} aria-pressed={leftovers} className="chip">
              <Repeat size={14} aria-hidden="true" /> Leftovers for lunch
            </button>
            {anyFast && (
              <div className="flex items-center gap-2">
              <span id={`${pillGroup}-fast`} className="text-sm text-muted">Fast days</span>
              <div className="segmented pill-group" role="radiogroup" aria-labelledby={`${pillGroup}-fast`}>
                {([2, 3] as const).map(n => (
                  <button key={n} type="button" role="radio" aria-checked={fastDayMeals === n} onClick={() => { setFastDayMeals(n); replan(); }} className="segment !px-3.5">
                    {fastDayMeals === n && <SelectionPill group={pillGroup} />}
                    {n} meals
                  </button>
                ))}
              </div>
              </div>
            )}
          </div>

          <div className="divide-y divide-border">
            {days.map(renderDay)}
          </div>
        </div>
      )}
    </Sheet>
  );
};
