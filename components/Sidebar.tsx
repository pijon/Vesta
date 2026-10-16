import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { AppView } from '../types';
import { NAV_ITEMS, isNavCurrent } from './MobileBottomNav';
import { VestaMark } from './VestaMark';

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
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map(item)}
      </div>
      <div className="side-foot mt-auto pt-4 border-t">
        {item({ view: AppView.SETTINGS, label: 'Settings', Icon: SlidersHorizontal })}
      </div>
    </nav>
  );
};
