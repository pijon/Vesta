import React from 'react';
import { CalendarHeart, ShoppingBasket } from 'lucide-react';
import { AppView } from '../types';
import { SelectionPill } from './SelectionPill';

const TABS = [
  { view: AppView.PLANNER, label: 'Meals', Icon: CalendarHeart },
  { view: AppView.SHOPPING, label: 'Shopping list', Icon: ShoppingBasket },
] as const;

/** Switches between the meal plan and its shopping list, which live under one Planner nav item */
export const PlannerTabs: React.FC<{ currentView: AppView; onNavigate: (view: AppView) => void }> = ({ currentView, onNavigate }) => (
  <nav aria-label="Planner" className="segmented pill-group mb-5">
    {TABS.map(({ view, label, Icon }) => (
      <button
        key={view}
        onClick={() => onNavigate(view)}
        aria-current={currentView === view ? 'page' : undefined}
        className="segment"
      >
        {currentView === view && <SelectionPill group="planner-tabs-pill" />}
        <Icon size={16} aria-hidden="true" /> {label}
      </button>
    ))}
  </nav>
);
