import React, { useEffect } from 'react';
import { FamilyMealChange } from '../services/storageService';
import { familyData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { addDays, slotLabel } from '../utils/planUtils';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { MemberAvatar } from './MemberAvatar';

/** "tonight", "tomorrow", "on Friday" (this week) or "on 3 Nov" */
const whenLabel = (date: string, today: string) => {
  if (date === today) return 'tonight';
  if (date === addDays(today, 1)) return 'tomorrow';
  const d = parseLocalDate(date);
  return date <= addDays(today, 6)
    ? `on ${d.toLocaleDateString(undefined, { weekday: 'long' })}`
    : `on ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

/**
 * Points out family meals another member just planned, with their avatar: "Anna planned Tacos
 * for dinner tomorrow". View opens the Planner on that day. Goes away by itself after a while.
 */
export const FamilyNotice: React.FC<{
  changes: FamilyMealChange[];
  onView: (date: string) => void;
  onDismiss: () => void;
}> = ({ changes, onView, onDismiss }) => {
  const family = usePrewarmed(familyData);

  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [changes, onDismiss]);

  const first = changes[0];
  const by = first.by;
  const name = family?.names.get(by) ?? 'Your family';
  const today = localDateString();
  const dates = Array.from(new Set<string>(changes.map(c => c.date))).sort();
  const message = changes.length === 1
    ? `${name} planned ${first.name} for ${slotLabel(first.slot).toLowerCase()} ${whenLabel(first.date, today)}`
    : dates.length === 1
      ? `${name} planned ${changes.length} family meals ${whenLabel(dates[0], today)}`
      : `${name} planned ${changes.length} family meals`;

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--tab-bar-bottom)+94px)] nav:bottom-8 z-[60] flex items-center gap-3 badge-ink !rounded-full pl-1.5 pr-1.5 py-1.5 text-sm font-semibold shadow-[var(--elev-md)] toast-in max-w-[calc(100vw-32px)]"
    >
      <MemberAvatar uid={by} avatar={family?.avatars.get(by)} size={32} className="shrink-0" />
      <span className="min-w-0 line-clamp-2">{message}</span>
      <button
        onClick={() => { onView(dates[0]); onDismiss(); }}
        className="hit-target shrink-0 min-h-8 px-3 rounded-full bg-on-ink/15 hover:bg-on-ink/25 font-semibold"
      >
        View
      </button>
    </div>
  );
};
