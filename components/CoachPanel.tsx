import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Lightbulb, Loader2, Send, Sparkles, ThumbsUp, X } from 'lucide-react';
import { AppView, DailyLog, DailySummary, UserStats } from '../types';
import { CoachAction, CoachFacts, Finding, buildCoachFacts, coachFindings } from '../utils/coachModel';

export interface CoachHandlers {
  onUpdateStats: (stats: UserStats) => void;
  onOpenFoodModal: () => void;
  onOpenWeightModal: () => void;
  onNavigate: (view: AppView) => void;
}

interface CoachInput {
  stats: UserStats;
  summaries: DailySummary[];
  dayTypes: Record<string, string>;
  dailyLog: DailyLog;
}

export const useCoach = ({ stats, summaries, dayTypes, dailyLog }: CoachInput) =>
  useMemo(() => {
    const facts = buildCoachFacts(stats, summaries, dayTypes, dailyLog);
    return { facts, findings: coachFindings(facts) };
  }, [stats, summaries, dayTypes, dailyLog]);

const TONE = {
  focus: { Icon: CircleAlert, className: 'tile-calories', label: 'Focus' },
  good: { Icon: ThumbsUp, className: 'tile-weight', label: 'Going well' },
  tip: { Icon: Lightbulb, className: 'tile-neutral', label: 'Tip' },
} as const;

/** Runs a finding's action; returns a confirmation for actions that change settings */
const useRunAction = (stats: UserStats, handlers: CoachHandlers) => (action: CoachAction): string | null => {
  switch (action.kind) {
    case 'applyTarget':
      handlers.onUpdateStats({ ...stats, nonFastDayCalories: action.nourish });
      return `Nourish days are now ${action.nourish.toLocaleString()} kcal.`;
    case 'setWorkoutCredit':
      handlers.onUpdateStats({ ...stats, workoutCalorieCredit: action.credit });
      return 'Workouts now add half their calories.';
    case 'logFood':
      handlers.onOpenFoodModal();
      return null;
    case 'logWeight':
      handlers.onOpenWeightModal();
      return null;
    case 'openPlanner':
      handlers.onNavigate(AppView.PLANNER);
      return null;
    case 'openReminders':
      handlers.onNavigate(AppView.SETTINGS);
      window.setTimeout(() => document.getElementById('reminders-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
      return null;
  }
};

const FindingRow: React.FC<{ finding: Finding; onAction: (a: CoachAction) => string | null }> = ({ finding, onAction }) => {
  const { Icon, className, label } = TONE[finding.tone];
  const [done, setDone] = useState<string | null>(null);
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span className={`size-9 shrink-0 rounded-[10px] flex items-center justify-center ${className}`} title={label}>
        <Icon size={18} aria-hidden="true" />
        <span className="sr-only">{label}:</span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-snug">{finding.title}</p>
        <p className="text-sm text-muted mt-1">{finding.detail}</p>
        {finding.action && (
          done ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold" role="status"><Check size={16} aria-hidden="true" /> {done}</p>
          ) : (
            <button onClick={() => setDone(onAction(finding.action!))} className="btn-secondary btn-sm mt-2">
              {finding.action.label}
            </button>
          )
        )}
      </div>
    </li>
  );
};

const QUESTIONS = ['Why has my weight stalled?', 'What should I change this week?', 'How do I hit my protein today?'];

/** Free-text questions about the user's own progress, answered from the measured facts */
const AskVesta: React.FC<{ facts: CoachFacts; findings: Finding[] }> = ({ facts, findings }) => {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setAsked(text);
    setAnswer(null);
    setQuestion('');
    try {
      const { askCoach } = await import('../services/geminiService');
      setAnswer(await askCoach(text, facts, findings));
    } catch (e) {
      console.error(e);
      setError("Couldn't get an answer right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[14px] bg-surface-sunken p-4">
      <p className="flex items-center gap-2 font-semibold"><Sparkles size={16} aria-hidden="true" /> Ask Vesta</p>
      <p className="text-sm text-muted mt-0.5">Answers come from your own logs and weigh-ins.</p>

      {(asked || busy) && (
        <div className="mt-3 space-y-2" aria-live="polite">
          {asked && <p className="text-sm font-semibold">{asked}</p>}
          {busy && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Looking at your numbers…</p>}
          {answer && (
            <div className="rounded-[12px] bg-surface border border-border p-3 text-sm leading-relaxed space-y-1.5">
              {answer.split('\n').filter(Boolean).map((line, i) => (
                line.startsWith('- ')
                  ? <p key={i} className="flex gap-2"><ArrowRight size={14} className="shrink-0 mt-1 text-muted" aria-hidden="true" />{line.slice(2)}</p>
                  : <p key={i}>{line.replace(/\*\*/g, '')}</p>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-error" role="alert">{error}</p>}
        </div>
      )}

      {!asked && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {QUESTIONS.map(q => (
            <button key={q} onClick={() => ask(q)} className="min-h-9 px-3 rounded-full border border-border bg-surface text-sm font-semibold hover:bg-border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
              {q}
            </button>
          ))}
        </div>
      )}

      <form className="flex gap-2 mt-3" onSubmit={e => { e.preventDefault(); ask(question); }}>
        <label className="sr-only" htmlFor="ask-vesta">Ask a question about your progress</label>
        <input
          id="ask-vesta"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={asked ? 'Ask a follow-up' : 'Ask about your progress'}
          className="input flex-1 min-w-0"
          maxLength={300}
        />
        <button type="submit" disabled={!question.trim() || busy} className="icon-btn shrink-0" aria-label="Ask">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

/** Analytics: all guidance, in order of what matters most, plus questions. */
export const CoachPanel: React.FC<CoachInput & CoachHandlers> = props => {
  const { facts, findings } = useCoach(props);
  const runAction = useRunAction(props.stats, props);
  return (
    <section className="card p-4 md:p-6" aria-labelledby="coach-title">
      <h2 id="coach-title" className="heading-3">Guidance</h2>
      <p className="text-sm text-muted mt-0.5 mb-4">What your last few weeks say, most important first.</p>
      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,22rem)] lg:gap-8">
        {findings.length ? (
          <ul className="divide-y divide-border">
            {findings.map(f => <FindingRow key={f.id} finding={f} onAction={runAction} />)}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing to flag. Keep logging and weighing in, and guidance will appear here.</p>
        )}
        <AskVesta facts={facts} findings={findings} />
      </div>
    </section>
  );
};

const DISMISS_KEY = 'vesta_coach_dismissed';

/** Today: the single most useful piece of guidance; hidden for three days when dismissed. */
export const CoachCard: React.FC<CoachInput & CoachHandlers> = props => {
  const { findings } = useCoach(props);
  const runAction = useRunAction(props.stats, props);
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); } catch { return {}; }
  });
  const [done, setDone] = useState<string | null>(null);

  const top = findings.find(f => f.tone !== 'good' && !(dismissed[f.id] > Date.now() - 3 * 86_400_000));
  if (!top) return null;
  const { Icon, className } = TONE[top.tone];
  const more = findings.length - 1;

  const dismiss = () => {
    const next = { ...dismissed, [top.id]: Date.now() };
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* per-device */ }
  };

  return (
    <section className="card p-4 md:px-6" aria-label="Guidance">
      <div className="flex items-start gap-3">
        <span className={`size-10 shrink-0 rounded-[12px] flex items-center justify-center ${className}`}><Icon size={20} aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          <h2 className="heading-4">{top.title}</h2>
          <p className="text-sm text-muted line-clamp-3">{top.detail}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {top.action && (done
              ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold" role="status"><Check size={16} aria-hidden="true" /> {done}</span>
              : <button onClick={() => setDone(runAction(top.action!))} className="btn-secondary btn-sm">{top.action.label}</button>)}
            <button onClick={() => props.onNavigate(AppView.ANALYTICS)} className="btn-ghost btn-sm">
              {more > 0 ? `${more} more tip${more === 1 ? '' : 's'}` : 'Ask Vesta'}
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="size-9 -mr-1.5 -mt-1 shrink-0 inline-flex items-center justify-center rounded-full text-muted hover:text-main hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label="Hide for three days">
          <X size={18} />
        </button>
      </div>
    </section>
  );
};
