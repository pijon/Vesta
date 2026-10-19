import React from 'react';
import { UsersRound, ShoppingBasket } from 'lucide-react';
import { AppView } from '../types';
import { SelectionPill } from './SelectionPill';

const TABS = [
  { view: AppView.FAMILY, label: 'Family', Icon: UsersRound },
  { view: AppView.SHOPPING, label: 'Shopping list', Icon: ShoppingBasket },
] as const;

/** Family members and updates, alongside the shopping list shared by the family */
export const FamilyTabs: React.FC<{ currentView: AppView; onNavigate: (view: AppView) => void }> = ({ currentView, onNavigate }) => (
  <nav aria-label="Family" className="segmented pill-group mb-5">
    {TABS.map(({ view, label, Icon }) => (
      <button
        key={view}
        onClick={() => onNavigate(view)}
        aria-current={currentView === view ? 'page' : undefined}
        className="segment"
      >
        {currentView === view && <SelectionPill group="family-tabs-pill" />}
        <Icon size={16} aria-hidden="true" /> {label}
      </button>
    ))}
  </nav>
);
