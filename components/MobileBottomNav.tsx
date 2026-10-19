import React from 'react';
import { AppView, UserExperience } from '../types';
import { SelectionPill } from './SelectionPill';
import { Sun, ChartNoAxesColumnIncreasing, CalendarHeart, CookingPot, ShoppingBasket, UsersRound } from 'lucide-react';

/** Tracking keeps the shopping list under Family, so Family stays current while shopping; Plan meals
 *  has Shopping as its own item */
export const isNavCurrent = (item: AppView, current: AppView, experience: UserExperience = 'tracking') =>
  item === current || (experience === 'tracking' && item === AppView.FAMILY && current === AppView.SHOPPING);

interface MobileBottomNavProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  /** Family updates from others not seen yet */
  familyUnseen?: number;
  experience?: UserExperience;
}

/** A nav item's icon, with a dot when its page has something new */
export const NavIcon: React.FC<{ Icon: (typeof NAV_ITEMS)[number]['Icon']; size: number; current: boolean; dot: boolean }> = ({ Icon, size, current, dot }) => (
  <span className="relative inline-flex">
    <Icon size={size} strokeWidth={current ? 2.5 : 2.25} />
    {dot && <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-[var(--surface)]" aria-hidden="true" />}
  </span>
);

/** What a nav item is called, with "new updates" when it has a dot */
export const navItemLabel = (label: string, dot: boolean) => (dot ? `${label}, new updates` : undefined);

export const NAV_ITEMS: { view: AppView; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { view: AppView.TODAY, label: 'Today', Icon: Sun },
  { view: AppView.ANALYTICS, label: 'Analytics', Icon: ChartNoAxesColumnIncreasing },
  { view: AppView.PLANNER, label: 'Planner', Icon: CalendarHeart },
  { view: AppView.RECIPES, label: 'Recipes', Icon: CookingPot },
  { view: AppView.FAMILY, label: 'Family', Icon: UsersRound },
];

/** Plan meals: its own meal-focused Today, no Analytics, and Shopping as an item of its own */
const PLANNING_NAV_ITEMS: typeof NAV_ITEMS = [
  ...NAV_ITEMS.filter(item => item.view !== AppView.ANALYTICS && item.view !== AppView.FAMILY),
  { view: AppView.SHOPPING, label: 'Shopping', Icon: ShoppingBasket },
  ...NAV_ITEMS.filter(item => item.view === AppView.FAMILY),
];
export const navItemsFor = (experience: UserExperience = 'tracking') =>
  experience === 'planning' ? PLANNING_NAV_ITEMS : NAV_ITEMS;

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  familyUnseen = 0,
  experience,
}) => {
  return (
    <nav aria-label="Main" className="tab-bar pill-group">
      {navItemsFor(experience).map(({ view, label, Icon }) => {
        const dot = view === AppView.FAMILY && familyUnseen > 0 && currentView !== AppView.FAMILY;
        return (
          <button
            key={view}
            onClick={() => onNavigate(view)}
            aria-current={isNavCurrent(view, currentView, experience) ? 'page' : undefined}
            aria-label={navItemLabel(label, dot)}
            className="tab-item"
          >
            {isNavCurrent(view, currentView, experience) && <SelectionPill group="tab-bar-pill" />}
            <NavIcon Icon={Icon} size={24} current={isNavCurrent(view, currentView, experience)} dot={dot} />
            <span className="tab-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
};
