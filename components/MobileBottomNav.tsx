import React from 'react';
import { AppView } from '../types';
import { SelectionPill } from './SelectionPill';
import { Sun, ChartNoAxesColumnIncreasing, CalendarHeart, CookingPot, UsersRound } from 'lucide-react';

/** The shopping list lives inside the Planner, so the Planner item stays current there */
export const isNavCurrent = (item: AppView, current: AppView) =>
  item === current || (item === AppView.PLANNER && current === AppView.SHOPPING);

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const NAV_ITEMS: { view: AppView; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { view: AppView.TODAY, label: 'Today', Icon: Sun },
  { view: AppView.ANALYTICS, label: 'Analytics', Icon: ChartNoAxesColumnIncreasing },
  { view: AppView.PLANNER, label: 'Planner', Icon: CalendarHeart },
  { view: AppView.RECIPES, label: 'Recipes', Icon: CookingPot },
  { view: AppView.FAMILY, label: 'Family', Icon: UsersRound },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate
}) => {
  return (
    <nav aria-label="Main" className="tab-bar pill-group">
      {NAV_ITEMS.map(({ view, label, Icon }) => (
        <button
          key={view}
          onClick={() => onNavigate(view)}
          aria-current={isNavCurrent(view, currentView) ? 'page' : undefined}
          className="tab-item"
        >
          {isNavCurrent(view, currentView) && <SelectionPill group="tab-bar-pill" />}
          <Icon size={24} strokeWidth={isNavCurrent(view, currentView) ? 2.5 : 2.25} />
          <span className="tab-label">{label}</span>
        </button>
      ))}
    </nav>
  );
};
