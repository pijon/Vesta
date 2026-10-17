import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AppView, Avatar } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { SelectionPill } from './SelectionPill';
import { NAV_ITEMS, isNavCurrent } from './MobileBottomNav';
import { VestaMark } from './VestaMark';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  /** The signed-in user, shown above Settings; opens the Family page */
  me?: { uid: string; name?: string; avatar?: Avatar };
}

/** Primary navigation from the nav breakpoint (md width, 640px tall) up: an icon rail on tablets, a labelled sidebar on desktop. Phones, and short screens such as a phone in landscape, use MobileBottomNav. */
export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, me }) => {
  const item = ({ view, label, Icon }: (typeof NAV_ITEMS)[number]) => (
    <button
      key={view}
      onClick={() => onNavigate(view)}
      aria-current={isNavCurrent(view, currentView) ? 'page' : undefined}
      className="side-item"
    >
      {isNavCurrent(view, currentView) && <SelectionPill group="side-nav-pill" />}
      <span className="side-icon">
        <Icon size={20} strokeWidth={isNavCurrent(view, currentView) ? 2.5 : 2.25} />
      </span>
      <span className="side-label">{label}</span>
    </button>
  );

  return (
    <nav aria-label="Main" className="side-nav">
      <div className="flex items-center justify-center lg:justify-start gap-3 lg:px-3 mb-6">
        <VestaMark />
        <span className="hidden lg:block font-display font-extrabold text-xl lowercase tracking-[-0.03em]">Vesta</span>
      </div>
      <div className="pill-group flex flex-col gap-1">
        {NAV_ITEMS.map(item)}
      </div>
      <div className="side-foot pill-group mt-auto pt-4 border-t flex flex-col gap-1">
        {me?.uid && (
          <button onClick={() => onNavigate(AppView.FAMILY)} className="side-item" aria-label={me.name ? `${me.name}: your family` : 'Your family'}>
            <MemberAvatar avatar={me.avatar} uid={me.uid} size={36} />
            <span className="side-label truncate">{me.name || 'You'}</span>
          </button>
        )}
        {item({ view: AppView.SETTINGS, label: 'Settings', Icon: SlidersHorizontal })}
      </div>
    </nav>
  );
};
