import React from 'react';
import { CalendarDays, ShoppingCart } from 'lucide-react';
import { AppView } from '../types';

const TABS = [
  { view: AppView.PLANNER, label: 'Meals', Icon: CalendarDays },
  { view: AppView.SHOPPING, label: 'Shopping list', Icon: ShoppingCart },
] as const;

/** Switches between the meal plan and its shopping list, which live under one Planner nav item */
export const PlannerTabs: React.FC<{ currentView: AppView; onNavigate: (view: AppView) => void }> = ({ currentView, onNavigate }) => (
  <nav aria-label="Planner" className="inline-flex p-1 rounded-full bg-surface-sunken mb-5">
    {TABS.map(({ view, label, Icon }) => (
      <button
        key={view}
        onClick={() => onNavigate(view)}
        aria-current={currentView === view ? 'page' : undefined}
        className={`min-h-9 px-4 inline-flex items-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] ${currentView === view ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}
      >
        <Icon size={16} aria-hidden="true" /> {label}
      </button>
    ))}
  </nav>
);
