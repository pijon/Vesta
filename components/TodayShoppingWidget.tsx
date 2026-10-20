import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ListPlus, ShoppingBasket } from 'lucide-react';
import { ShoppingList } from '../types';
import { addMealsToList, getCachedShoppingList, subscribeShoppingList } from '../services/shoppingService';
import { shoppingData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { extractMealsFromPlan, hasThingsToBuy } from '../utils/shoppingUtils';
import { isProbablyAtHome, itemAmount, mealsOnList } from '../utils/shoppingList';
import { localDateString } from '../utils/dateUtils';
import { AddMealsSheet } from './AddMealsSheet';

const PREVIEW_ITEMS = 4;

interface TodayShoppingWidgetProps {
  onOpen: () => void;
}

/** Plan meals' Today: what's left to buy on the family's list, and meals planned that aren't on it yet. */
export const TodayShoppingWidget: React.FC<TodayShoppingWidgetProps> = ({ onOpen }) => {
  const [list, setList] = useState<ShoppingList | null>(() => getCachedShoppingList());
  const warm = usePrewarmed(shoppingData);
  const [addingMeals, setAddingMeals] = useState(false);

  useEffect(() => subscribeShoppingList(setList, e => console.warn("Today's shopping widget stopped updating", e)), []);

  const today = localDateString();
  const toBuy = useMemo(() => {
    const now = Date.now();
    return (list?.items ?? [])
      .filter(item => !item.checked && !isProbablyAtHome(item, list?.pantry ?? {}, now))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [list]);
  const mealsToAdd = useMemo(() => {
    if (!list || !warm) return [];
    const onList = mealsOnList(list);
    return extractMealsFromPlan(warm.plans, today).filter(meal => hasThingsToBuy(meal) && !onList.has(meal.key));
  }, [list, warm, today]);
  const notOnList = mealsToAdd.length;
  const headline = !list ? 'Your family\'s list'
    : toBuy.length > 0 ? `${toBuy.length} ${toBuy.length === 1 ? 'thing' : 'things'} left to buy`
    : notOnList > 0 ? 'Nothing on the list yet'
    : 'Nothing left to buy';

  const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]';

  return (
    <div className="card p-4 md:p-6">
      <button
        onClick={onOpen}
        className={`w-full text-left rounded-2xl ${focusRing}`}
        aria-label={`Shopping list: ${headline}. Open the list`}
      >
        <span className="flex items-center gap-3">
          <span className="icon-tile tile-neutral size-10 shrink-0 flex items-center justify-center" aria-hidden="true"><ShoppingBasket size={18} strokeWidth={2.25} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-semibold text-muted">Shopping list</span>
            <span className="block font-semibold leading-snug">{headline}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
        </span>

        {toBuy.length > 0 && (
          <span className="mt-3 block space-y-1.5">
            {toBuy.slice(0, PREVIEW_ITEMS).map(item => (
              <span key={item.id} className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold min-w-0 flex-1 [overflow-wrap:anywhere]">{item.name}</span>
                <span className="shrink-0 text-muted">{itemAmount(item)}</span>
              </span>
            ))}
            {toBuy.length > PREVIEW_ITEMS && <span className="block text-sm text-muted">and {toBuy.length - PREVIEW_ITEMS} more</span>}
          </span>
        )}
      </button>

      {/* Planned meals missing from the list: one tap to pick and add them */}
      {notOnList > 0 && (
        <button onClick={() => setAddingMeals(true)} className="btn-secondary btn-sm btn-block mt-4">
          <ListPlus size={16} aria-hidden="true" /> Add {notOnList} {notOnList === 1 ? 'meal' : 'meals'} to the list
        </button>
      )}

      {addingMeals && <AddMealsSheet meals={mealsToAdd} onAdd={addMealsToList} onClose={() => setAddingMeals(false)} />}
    </div>
  );
};
