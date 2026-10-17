import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AppView, Avatar } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { SelectionPill } from './SelectionPill';
import { NAV_ITEMS, NavIcon, isNavCurrent, navItemLabel } from './MobileBottomNav';
import { VestaMark } from './VestaMark';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  /** The signed-in user, at the foot of the sidebar; opens Settings (Family has its own item) */
  me?: { uid: string; name?: string; avatar?: Avatar };
  /** Family updates from others not seen yet */
  familyUnseen?: number;
}

/** Primary navigation from the nav breakpoint (md width, 640px tall) up: an icon rail on tablets, a labelled sidebar on desktop. Phones, and short screens such as a phone in landscape, use MobileBottomNav. */
export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, me, familyUnseen = 0 }) => {
  const item = ({ view, label, Icon }: (typeof NAV_ITEMS)[number]) => {
    const dot = view === AppView.FAMILY && familyUnseen > 0 && currentView !== AppView.FAMILY;
    return (
      <button
        key={view}
        onClick={() => onNavigate(view)}
        aria-current={isNavCurrent(view, currentView) ? 'page' : undefined}
        aria-label={navItemLabel(label, dot)}
        className="side-item"
      >
        {isNavCurrent(view, currentView) && <SelectionPill group="side-nav-pill" />}
        <span className="side-icon">
          <NavIcon Icon={Icon} size={20} current={isNavCurrent(view, currentView)} dot={dot} />
        </span>
        <span className="side-label">{label}</span>
      </button>
    );
  };

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
        {/* You and your settings in one place: your account, goals and preferences live on Settings */}
        {me?.uid ? (
          <button
            onClick={() => onNavigate(AppView.SETTINGS)}
            aria-current={currentView === AppView.SETTINGS ? 'page' : undefined}
            className="side-item"
            aria-label={`${me.name || 'You'}: settings`}
          >
            {currentView === AppView.SETTINGS && <SelectionPill group="side-nav-pill" />}
            <MemberAvatar avatar={me.avatar} uid={me.uid} size={36} className="shrink-0" />
            <span className="side-label min-w-0">
              <span className="block truncate">{me.name || 'You'}</span>
              <span className="block text-xs font-medium opacity-80">Settings</span>
            </span>
          </button>
        ) : (
          item({ view: AppView.SETTINGS, label: 'Settings', Icon: SlidersHorizontal })
        )}
      </div>
    </nav>
  );
};
