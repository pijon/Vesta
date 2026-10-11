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
        <img src="/favicon.svg" alt="" className="size-9 rounded-[10px]" />
        <span className="hidden lg:block font-display font-extrabold text-xl text-main">Vesta</span>
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
