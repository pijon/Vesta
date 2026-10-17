import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Avatar } from '../types';
import { FamilyUpdate, FamilyUpdateGroup, groupFamilyUpdates, markFamilyUpdatesSeen, subscribeFamilyUpdates, UPDATES_KEPT_DAYS } from '../services/activityService';
import { mealWhen } from '../utils/planUtils';
import { MemberAvatar } from './MemberAvatar';

interface FamilyUpdatesProps {
  me: string | null;
  /** Family members' first names and avatars, by uid */
  members: { id: string; name: string; avatar?: Avatar }[];
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "Tuesday" (this week) or "12 Oct" */
const timeAgo = (at: number, now = Date.now()) => {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const then = new Date(at);
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  if (then >= startOfToday) return `${Math.round(minutes / 60)} h ago`;
  const days = Math.ceil((startOfToday.getTime() - then.getTime()) / 86_400_000);
  if (days <= 1) return 'Yesterday';
  return days < 7
    ? then.toLocaleDateString(undefined, { weekday: 'long' })
    : then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

type MealUpdate = Extract<FamilyUpdate, { type: 'planned' | 'notEating' }>;

/** What a group of updates says, after the member's name */
const describe = (group: FamilyUpdateGroup, isMe: boolean): { text: string; detail?: string } => {
  const n = group.updates.length;
  const names = group.updates.map(u => ('name' in u ? u.name : '')).filter(Boolean);
  const list = names.length > 1 ? [...names].reverse().join(', ') : undefined;
  switch (group.type) {
    case 'joined':
      return { text: 'joined the family' };
    case 'recipe':
      return n === 1 ? { text: `added the recipe ${names[0]}` } : { text: `added ${n} recipes`, detail: list };
    case 'planned': {
      const [u] = group.updates as MealUpdate[];
      return n === 1 ? { text: `planned ${u.name} for ${mealWhen(u.slot, u.date)}` } : { text: `planned ${n} family meals`, detail: list };
    }
    case 'notEating': {
      const [u] = group.updates as MealUpdate[];
      const verb = isMe ? "aren't" : "isn't";
      return n === 1 ? { text: `${verb} eating ${u.name} (${mealWhen(u.slot, u.date)})` } : { text: `${verb} eating ${n} family meals`, detail: list };
    }
  }
};

/**
 * The family's recent updates on the Family page: who added a recipe, planned a family meal or
 * isn't eating one. Showing them marks them seen (the Family tab's dot goes away).
 */
export const FamilyUpdates: React.FC<FamilyUpdatesProps> = ({ me, members }) => {
  const navigate = useNavigate();
  const [updates, setUpdates] = useState<FamilyUpdate[] | null>(null);

  // Only while the page is shown: a hidden page's effects are paused, so nothing is marked seen unseen
  useEffect(() => subscribeFamilyUpdates((latest, unseen) => {
    setUpdates(latest);
    if (unseen > 0) markFamilyUpdatesSeen();
  }), []);

  const groups = groupFamilyUpdates(updates || []);
  const member = (uid: string) => members.find(m => m.id === uid);

  return (
    <section className="card p-5 md:p-6" aria-labelledby="updates-heading">
      <h2 id="updates-heading" className="heading-3">Updates</h2>
      {updates === null ? (
        <div className="mt-4 h-14 rounded-[14px] bg-surface-sunken animate-pulse" aria-busy="true" aria-label="Loading updates" />
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted mt-0.5">
          Recipes added and family meals planned show up here, for {UPDATES_KEPT_DAYS} days.
        </p>
      ) : (
        <ul className="mt-3">
          {groups.map(group => {
            const isMe = group.by === me;
            const who = member(group.by);
            const name = isMe ? 'You' : who?.name.split(' ')[0] ?? 'Someone';
            const { text, detail } = describe(group, isMe);
            // Meals open the Planner on their (first) day
            const dates = group.updates.flatMap(u => ('date' in u ? [u.date] : [])).sort();
            const content = (
              <>
                <MemberAvatar avatar={who?.avatar} uid={group.by} size={36} className="shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] leading-snug"><span className="font-semibold">{name}</span> {text}</span>
                  {detail && <span className="block text-xs text-muted truncate">{detail}</span>}
                  <span className="block text-xs text-muted">{timeAgo(group.at)}</span>
                </span>
              </>
            );
            return (
              <li key={group.key} className="border-t border-border first:border-t-0">
                {dates.length > 0 ? (
                  <button
                    onClick={() => navigate('/mealplanner', { state: { date: dates[0] } })}
                    className="w-full flex items-center gap-3 py-2.5 text-left rounded-[14px] hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    {content}
                    <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
                  </button>
                ) : (
                  <div className="flex items-center gap-3 py-2.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
