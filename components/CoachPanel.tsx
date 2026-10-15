import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, CircleAlert, Lightbulb, ThumbsUp } from 'lucide-react';
import { AppView, CoachReadState, DailyLog, DailySummary, UserStats } from '../types';
import { CoachAction, Finding, buildCoachFacts, coachFindings, isFindingRead } from '../utils/coachModel';

export interface CoachHandlers {
  onUpdateStats: (stats: UserStats) => void;
  onOpenFoodModal: () => void;
  onOpenWeightModal: () => void;
  onNavigate: (view: AppView) => void;
  coachRead: CoachReadState;
  onSetCoachRead: (id: string, read: boolean) => void;
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

/** Findings split into unread and read, each still most important first */
const useSplitFindings = (input: CoachInput, read: CoachReadState) => {
  const { findings } = useCoach(input);
  return useMemo(() => ({
    unread: findings.filter(f => !isFindingRead(read, f.id)),
    read: findings.filter(f => isFindingRead(read, f.id)),
  }), [findings, read]);
};

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

const FindingRow: React.FC<{ finding: Finding; isRead: boolean; onAction: (a: CoachAction) => string | null; onSetRead: (id: string, read: boolean) => void }> = ({ finding, isRead, onAction, onSetRead }) => {
  const { Icon, className, label } = TONE[finding.tone];
  const [done, setDone] = useState<string | null>(null);
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span className={`icon-tile size-9 shrink-0 flex items-center justify-center ${className}`} title={label}>
        <Icon size={18} aria-hidden="true" />
        <span className="sr-only">{label}:</span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold leading-snug">{finding.title}</p>
        <p className="text-sm text-muted mt-1">{finding.detail}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {finding.action && !isRead && (
            done ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold" role="status"><Check size={16} aria-hidden="true" /> {done}</p>
            ) : (
              <button onClick={() => setDone(onAction(finding.action!))} className="btn-secondary btn-sm">
                {finding.action.label}
              </button>
            )
          )}
          <button onClick={() => onSetRead(finding.id, !isRead)} className="btn-ghost btn-sm">
            {isRead ? 'Mark as unread' : <><Check size={16} aria-hidden="true" /> Mark as read</>}
          </button>
        </div>
      </div>
    </li>
  );
};

/** Analytics: all guidance, in order of what matters most. */
export const CoachPanel: React.FC<CoachInput & CoachHandlers> = props => {
  const { unread, read } = useSplitFindings(props, props.coachRead);
  const runAction = useRunAction(props.stats, props);
  const [showRead, setShowRead] = useState(false);
  return (
    <section className="card p-4 md:p-6" aria-labelledby="coach-title">
      <h2 id="coach-title" className="heading-3">Guidance</h2>
      <p className="text-sm text-muted mt-0.5 mb-4">What your last few weeks say, most important first.</p>
      {unread.length ? (
        <ul className="divide-y divide-border">
          {unread.map(f => <FindingRow key={f.id} finding={f} isRead={false} onAction={runAction} onSetRead={props.onSetCoachRead} />)}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {read.length ? 'You\'re all caught up.' : 'Nothing to flag. Keep logging and weighing in, and guidance will appear here.'}
        </p>
      )}
      {read.length > 0 && (
        <div className="border-t border-border mt-4 pt-3">
          <button
            onClick={() => setShowRead(s => !s)}
            aria-expanded={showRead}
            className="btn-ghost btn-sm -ml-3"
          >
            {read.length} read <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${showRead ? 'rotate-180' : ''}`} />
          </button>
          {showRead && (
            <ul className="divide-y divide-border mt-3">
              {read.map(f => <FindingRow key={f.id} finding={f} isRead onAction={runAction} onSetRead={props.onSetCoachRead} />)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

/** Today: weight-loss progress when there's news, else the single most useful unread tip. */
export const CoachCard: React.FC<CoachInput & CoachHandlers> = props => {
  const { unread } = useSplitFindings(props, props.coachRead);
  const runAction = useRunAction(props.stats, props);
  const [done, setDone] = useState<string | null>(null);

  const top = unread.find(f => f.id === 'progress') ?? unread.find(f => f.tone !== 'good');
  if (!top) return null;
  const { Icon } = TONE[top.tone];
  const more = unread.length - 1;

  return (
    <section className="rounded-[24px] bg-secondary-light p-5 md:p-6" aria-label="Guidance">
      <div className="flex items-start gap-4">
        <span className="shrink-0 flex items-center justify-center size-12 rounded-full bg-secondary text-secondary-foreground"><Icon size={20} aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-muted">From your coach</p>
          <h2 className="heading-3">{top.title}</h2>
          <p className="mt-1 leading-relaxed line-clamp-3">{top.detail}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {top.action && (done
              ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold" role="status"><Check size={16} aria-hidden="true" /> {done}</span>
              : <button onClick={() => setDone(runAction(top.action!))} className="btn-primary btn-sm">{top.action.label}</button>)}
            <button onClick={() => { setDone(null); props.onSetCoachRead(top.id, true); }} className="btn-ghost btn-sm">
              <Check size={16} aria-hidden="true" /> Mark as read
            </button>
            <button onClick={() => props.onNavigate(AppView.ANALYTICS)} className="btn-ghost btn-sm">
              {more > 0 ? `${more} more tip${more === 1 ? '' : 's'}` : 'All guidance'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
