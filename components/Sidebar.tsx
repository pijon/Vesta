import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AppView, Avatar, UserExperience } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { SelectionPill } from './SelectionPill';
import { NAV_ITEMS, NavIcon, isNavCurrent, navItemLabel, navItemsFor } from './MobileBottomNav';
import { VestaMark } from './VestaMark';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  /** The signed-in user, at the foot of the sidebar; opens Settings (Family has its own item) */
  me?: { uid: string; name?: string; avatar?: Avatar };
  /** Family updates from others not seen yet */
  familyUnseen?: number;
  experience?: UserExperience;
}

/** Primary navigation from the nav breakpoint (md width, 640px tall) up: an icon rail on tablets, a labelled sidebar on desktop. Phones, and short screens such as a phone in landscape, use MobileBottomNav. */
export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, me, familyUnseen = 0, experience }) => {
  const item = ({ view, label, Icon }: (typeof NAV_ITEMS)[number]) => {
    const dot = view === AppView.FAMILY && familyUnseen > 0 && currentView !== AppView.FAMILY;
    return (
      <button
        key={view}
        onClick={() => onNavigate(view)}
        aria-current={isNavCurrent(view, currentView, experience) ? 'page' : undefined}
        aria-label={navItemLabel(label, dot)}
        className="side-item"
      >
        {isNavCurrent(view, currentView, experience) && <SelectionPill group="side-nav-pill" />}
        <span className="side-icon">
          <NavIcon Icon={Icon} size={20} current={isNavCurrent(view, currentView, experience)} dot={dot} />
        </span>
        <span className="side-label">{label}</span>
      </button>
    );
  };

  return (
    <nav aria-label="Main" className="side-nav">
      {/* Same inset as the items, so the mark sits on the icon column and the wordmark on the labels */}
      <div className="flex items-center justify-center lg:justify-start gap-3 lg:pl-1.5 mb-6">
        <VestaMark />
        <span className="hidden lg:block font-display font-extrabold text-xl lowercase tracking-[-0.03em]">Vesta</span>
      </div>
      <div className="pill-group flex flex-col gap-1">
        {navItemsFor(experience).map(item)}
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
            {/* The rail shows "Settings" like its other labels; the labelled sidebar adds your name above it */}
            <span className="side-label min-w-0 lg:text-left">
              <span className="hidden lg:block truncate">{me.name || 'You'}</span>
              <span className="block lg:font-sans lg:text-xs lg:leading-4 lg:font-medium lg:tracking-normal">Settings</span>
            </span>
          </button>
        ) : (
          item({ view: AppView.SETTINGS, label: 'Settings', Icon: SlidersHorizontal })
        )}
      </div>
    </nav>
  );
};
