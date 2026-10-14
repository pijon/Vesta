import React from 'react';
import { Settings } from 'lucide-react';
import { AppView } from '../types';
import { NAV_ITEMS, isNavCurrent } from './MobileBottomNav';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

/** Primary navigation from md up: an icon rail on tablets, a labelled sidebar on desktop. Phones use MobileBottomNav. */
export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const item = ({ view, label, Icon }: (typeof NAV_ITEMS)[number]) => (
    <button
      key={view}
      onClick={() => onNavigate(view)}
      aria-current={isNavCurrent(view, currentView) ? 'page' : undefined}
      className="side-item"
    >
      <Icon size={22} strokeWidth={isNavCurrent(view, currentView) ? 2.25 : 1.75} />
      <span className="side-label">{label}</span>
    </button>
  );

  return (
    <nav aria-label="Main" className="side-nav">
      <div className="flex items-center justify-center lg:justify-start gap-3 lg:px-3 mb-6">
        {/* The Vesta mark (public/favicon.svg) inline, so its colours follow the theme */}
        <svg viewBox="0 0 100 100" className="size-9 shrink-0" aria-hidden="true">
          <rect width="100" height="100" rx="22" fill="var(--mark-bg)" />
          <path d="M50 10 C58 22 68 31 68 47 C68 59 60 66 50 66 C40 66 32 59 32 47 C32 39 36 34 41 28 C42 35 45 39 48 40 C46 30 47 20 50 10 Z" fill="var(--mark-flame)" />
          <path d="M50 38 C54 44 58 48 58 54 C58 60 54 64 50 64 C46 64 42 60 42 54 C42 48 46 44 50 38 Z" fill="var(--mark-bg)" />
          <rect x="17" y="54" width="66" height="8" rx="4" fill="var(--mark-bowl)" stroke="var(--mark-bg)" strokeWidth="3" />
          <path d="M23 62 H77 C77 75 65 83 50 83 C35 83 23 75 23 62 Z" fill="var(--mark-bowl)" />
          <rect x="39" y="84" width="22" height="5" rx="2.5" fill="var(--mark-bowl)" />
        </svg>
        <span className="side-brand hidden lg:block font-display font-extrabold text-xl text-main">Vesta</span>
      </div>
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map(item)}
      </div>
      <div className="mt-auto pt-4 border-t border-border">
        {item({ view: AppView.SETTINGS, label: 'Settings', Icon: Settings })}
      </div>
    </nav>
  );
};
