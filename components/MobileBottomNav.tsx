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
    <nav aria-label="Main" className="tab-bar">
      {NAV_ITEMS.map(({ view, label, Icon }) => (
        <button
          key={view}
          onClick={() => onNavigate(view)}
          aria-current={currentView === view ? 'page' : undefined}
          className="tab-item"
        >
          <Icon size={24} strokeWidth={currentView === view ? 2.25 : 1.75} />
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
};
