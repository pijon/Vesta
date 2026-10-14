import React from 'react';
import { Settings } from 'lucide-react';
import { AppView } from '../types';
import { NAV_ITEMS, isNavCurrent } from './MobileBottomNav';
import { useDevMode } from '../contexts/DevModeContext';

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
          // "Market day" mark: the hearth as two shapes, a butter flame over a cream bowl, on a tomato tile
          <svg viewBox="0 0 100 100" className="size-9 shrink-0" aria-hidden="true">
            <rect width="100" height="100" rx="30" fill="#FF5533" />
            <path d="M50 13 C61 26 69 34 69 46 C69 55 61 60 50 60 C39 60 31 55 31 46 C31 38 35 33 41 27 C42 35 45 39 48 40 C46 31 47 22 50 13 Z" fill="#FFD23F" />
            <path d="M19 55 H81 C81 74 67 85 50 85 C33 85 19 74 19 55 Z" fill="#FFF1D6" />
          </svg>
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
