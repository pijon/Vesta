import React from 'react';
import { AppView } from '../types';
import { Home, BarChart3, CalendarDays, UtensilsCrossed, ShoppingBag } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const NAV_ITEMS: { view: AppView; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { view: AppView.TODAY, label: 'Today', Icon: Home },
  { view: AppView.ANALYTICS, label: 'Analytics', Icon: BarChart3 },
  { view: AppView.PLANNER, label: 'Planner', Icon: CalendarDays },
  { view: AppView.RECIPES, label: 'Recipes', Icon: UtensilsCrossed },
  { view: AppView.SHOPPING, label: 'Shopping', Icon: ShoppingBag },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate
}) => {
  return (
    <nav
      aria-label="Main"
      className="nav-bar fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[90%] max-w-[400px] z-50"
    >
      {NAV_ITEMS.map(({ view, label, Icon }) => (
        <button
          key={view}
          onClick={() => onNavigate(view)}
          aria-label={label}
          aria-current={currentView === view ? 'page' : undefined}
          className="nav-item"
        >
          <Icon size={24} strokeWidth={2} />
        </button>
      ))}
    </nav>
  );
};
