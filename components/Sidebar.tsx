import React from 'react';
import { Settings } from 'lucide-react';
import { AppView } from '../types';
import { NAV_ITEMS, isNavCurrent } from './MobileBottomNav';
import { useDevMode } from '../contexts/DevModeContext';
import { VestaMark } from './VestaMark';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

/** Primary navigation from md up: an icon rail on tablets, a labelled sidebar on desktop. Phones use MobileBottomNav. */
export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const market = useDevMode().isFeatureEnabled('marketTheme');
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
        {market ? (
          <VestaMark />
        ) : (
          <img src="/favicon.svg" alt="" className="size-9 rounded-[10px]" />
        )}
        <span className="side-brand hidden lg:block font-display font-extrabold text-xl">Vesta</span>
      </div>
      <div className="flex flex-col gap-1">
        {NAV_ITEMS.map(item)}
      </div>
      <div className="side-foot mt-auto pt-4 border-t">
        {item({ view: AppView.SETTINGS, label: 'Settings', Icon: Settings })}
      </div>
    </nav>
  );
};
