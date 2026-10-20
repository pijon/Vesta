import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ShoppingBasket } from 'lucide-react';
import { ShoppingList } from '../types';
import { getCachedShoppingList, subscribeShoppingList } from '../services/shoppingService';
import { shoppingData } from '../services/pageData';
import { usePrewarmed } from '../utils/prewarm';
import { extractMealsFromPlan, hasThingsToBuy } from '../utils/shoppingUtils';
import { isProbablyAtHome, itemAmount, mealsOnList } from '../utils/shoppingList';
import { localDateString } from '../utils/dateUtils';

const PREVIEW_ITEMS = 4;

interface TodayShoppingWidgetProps {
  onOpen: () => void;
}

/** Plan meals' Today: what's left to buy on the family's list, and meals planned that aren't on it yet. */
export const TodayShoppingWidget: React.FC<TodayShoppingWidgetProps> = ({ onOpen }) => {
  const [list, setList] = useState<ShoppingList | null>(() => getCachedShoppingList());
  const warm = usePrewarmed(shoppingData);

  useEffect(() => subscribeShoppingList(setList, e => console.warn("Today's shopping widget stopped updating", e)), []);

  const today = localDateString();
  const toBuy = useMemo(() => {
    const now = Date.now();
    return (list?.items ?? [])
      .filter(item => !item.checked && !isProbablyAtHome(item, list?.pantry ?? {}, now))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [list]);
  const notOnList = useMemo(() => {
    if (!list || !warm) return 0;
    const onList = mealsOnList(list);
    return extractMealsFromPlan(warm.plans, today).filter(meal => hasThingsToBuy(meal) && !onList.has(meal.key)).length;
  }, [list, warm, today]);

  const meals = (n: number) => `${n} planned ${n === 1 ? 'meal isn\'t' : 'meals aren\'t'} on the list yet`;
  const headline = !list ? 'Your family\'s list'
    : toBuy.length > 0 ? `${toBuy.length} ${toBuy.length === 1 ? 'thing' : 'things'} left to buy`
    : notOnList > 0 ? 'Nothing on the list yet'
    : 'Nothing left to buy';

  return (
    <button
      onClick={onOpen}
      className="card card-hover w-full p-4 md:p-6 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      aria-label={`Shopping list: ${headline}. Open the list`}
    >
      <span className="flex items-center gap-3">
        <span className="icon-tile tile-water size-10 shrink-0 flex items-center justify-center" aria-hidden="true"><ShoppingBasket size={18} strokeWidth={2.25} /></span>
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

      {notOnList > 0 && <span className="mt-3 block text-sm text-muted">{meals(notOnList)}.</span>}
    </button>
  );
};
