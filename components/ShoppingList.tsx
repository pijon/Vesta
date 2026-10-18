import React, { useEffect, useMemo, useRef, useState } from 'react';
import { shoppingData } from '../services/pageData';
import { ensureWarm, peekWarm } from '../utils/prewarm';
import {
  addMealsToList,
  addOwnItem,
  clearBasket,
  getCachedShoppingList,
  moveOldListToFamily,
  removeItem,
  removeMealFromList,
  restoreItem,
  setItemAmount,
  setItemChecked,
  subscribeShoppingList,
} from '../services/shoppingService';
import { DayPlan, ShoppingList as List, ShoppingListItem, ShoppingListMeal } from '../types';
import { PlanMeal, extractMealsFromPlan, hasThingsToBuy } from '../utils/shoppingUtils';
import { itemAmount, itemMeals, listText, mealsOnList } from '../utils/shoppingList';
import { localDateString } from '../utils/dateUtils';
import ShoppingItem from './ShoppingItem';
import { AddMealsSheet } from './AddMealsSheet';
import { CalendarPlus, CircleAlert, Copy, CopyCheck, PartyPopper, Plus, ShoppingBasket, X } from 'lucide-react';

const byName = (a: ShoppingListItem, b: ShoppingListItem) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** The family's shopping list: one list everyone sees live, with planned meals added into it. */
export const ShoppingList: React.FC = () => {
  const [list, setList] = useState<List | null>(() => getCachedShoppingList());
  const [plans, setPlans] = useState<Record<string, DayPlan> | null>(() => peekWarm(shoppingData)?.plans ?? null);
  const [error, setError] = useState<string | null>(null);
  const [addingMeals, setAddingMeals] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [listCopied, setListCopied] = useState(false);
  // Delay the loading screen so quick loads don't flash a spinner
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (list) return;
    const timer = setTimeout(() => setShowLoading(true), 300);
    return () => clearTimeout(timer);
  }, [list]);

  useEffect(() => {
    moveOldListToFamily().catch(e => console.warn("Couldn't move the old shopping list to the family's", e));
    return subscribeShoppingList(setList, e => {
      console.error('Shopping list stopped updating:', e);
      setError("We couldn't load the shopping list. Check your connection and try again.");
    });
  }, []);

  // Planned meals, fresh each time the page is shown (App keeps it in an Activity, which re-runs effects)
  useEffect(() => {
    ensureWarm(shoppingData, true).then(data => setPlans(data.plans)).catch(e => console.error('Failed to load planned meals', e));
  }, []);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await action();
    } catch (e) {
      console.error(message, e);
      setError(message);
    }
  };

  /** The last item removed, offered back for a few seconds */
  const [lastRemoved, setLastRemoved] = useState<ShoppingListItem | null>(null);
  useEffect(() => {
    if (!lastRemoved) return;
    const timer = setTimeout(() => setLastRemoved(null), 5000);
    return () => clearTimeout(timer);
  }, [lastRemoved]);

  const inputRef = useRef<HTMLInputElement>(null);
  const submitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newItem;
    if (!text.trim()) return;
    setNewItem('');
    inputRef.current?.focus();
    void run(() => addOwnItem(text), `We couldn't add ${text.trim()}. Try again.`);
  };

  const today = localDateString();
  const plannedMeals = useMemo(() => (plans ? extractMealsFromPlan(plans, today) : []), [plans, today]);
  const onList = useMemo(() => (list ? mealsOnList(list) : new Map<string, ShoppingListMeal>()), [list]);
  const mealsToAdd = plannedMeals.filter(meal => hasThingsToBuy(meal) && !onList.has(meal.key));
  const planned = new Set(plannedMeals.map(meal => meal.key));
  const upcomingOnList = [...onList]
    .filter(([, meal]) => meal.date >= today)
    .sort(([, a], [, b]) => a.date.localeCompare(b.date));

  if (!list) {
    if (error) return <div className="space-y-5 pb-20">{errorNotice(error)}</div>;
    if (!showLoading) return <div className="min-h-[50vh]" aria-busy="true" />;
    return (
      <div className="tile tile-neutral items-center text-center py-12" role="status">
        <span className="spinner spinner-lg text-main mb-4" aria-hidden="true" />
        <p className="font-semibold">Loading the shopping list…</p>
      </div>
    );
  }

  const toBuy = list.items.filter(item => !item.checked).sort(byName);
  const inBasket = list.items.filter(item => item.checked).sort(byName);
  const total = list.items.length;

  const handleCopyList = () => {
    navigator.clipboard?.writeText(listText(toBuy)).then(() => {
      setListCopied(true);
      setTimeout(() => setListCopied(false), 2000);
    }).catch(err => console.error('Failed to copy list:', err));
  };

  const renderItem = (item: ShoppingListItem) => (
    <ShoppingItem
      key={item.id}
      name={item.name}
      amount={itemAmount(item)}
      meals={itemMeals(item)}
      isChecked={!!item.checked}
      onToggleCheck={() => run(() => setItemChecked(item.id, !item.checked), `We couldn't update ${item.name}. Try again.`)}
      onRemove={() => {
        setLastRemoved(item);
        void run(() => removeItem(item.id), `We couldn't remove ${item.name}. Try again.`);
      }}
      onUpdateAmount={amount => run(() => setItemAmount(item.id, amount), `We couldn't change ${item.name}. Try again.`)}
    />
  );

  const addMealsButton = (primary: boolean) => mealsToAdd.length > 0 && (
    <button onClick={() => setAddingMeals(true)} className={primary ? 'btn-primary' : 'btn-secondary btn-sm shrink-0'}>
      <CalendarPlus size={primary ? 20 : 16} aria-hidden="true" />
      Add {primary ? `${mealsToAdd.length} planned ${mealsToAdd.length === 1 ? 'meal' : 'meals'}` : `meals · ${mealsToAdd.length}`}
    </button>
  );

  return (
    <div className="space-y-5 pb-20">
      {total > 0 && (
        // What's left to buy is the page's one bold block
        <section className="hero p-5 md:p-6 flex flex-col gap-4" aria-label="Shopping progress">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-bold">{toBuy.length === 0 ? 'All in the basket' : 'Left to buy'}</p>
            <p className="text-sm font-medium tabular-nums">{inBasket.length} of {total} in the basket</p>
          </div>
          <p className="font-display font-extrabold text-[80px] leading-[0.9] tracking-[-0.05em] tabular-nums">
            {toBuy.length}<span className="sr-only"> {toBuy.length === 1 ? 'item' : 'items'} left to buy</span>
          </p>
          <div className="h-2.5 rounded-full bg-current/20 overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(inBasket.length / total) * 100}%` }} />
          </div>
          {toBuy.length > 0 && (
            <button
              onClick={handleCopyList}
              className="btn-base btn-block min-h-[52px] text-base hover:opacity-90"
              style={{ background: 'var(--hero-foreground)', color: 'var(--hero)' }}
            >
              {listCopied ? <CopyCheck size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              {listCopied ? 'Copied' : 'Copy list'}
            </button>
          )}
        </section>
      )}

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <form onSubmit={submitNewItem} className="flex-1 flex gap-2">
          <input
            ref={inputRef}
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add an item, like 2 l mjölk"
            aria-label="Add an item to the list"
            className="input flex-1 min-w-0"
            enterKeyHint="done"
          />
          <button type="submit" disabled={!newItem.trim()} className="icon-btn size-12 shrink-0 bg-ink text-on-ink disabled:bg-surface-sunken disabled:text-muted" aria-label="Add to the list">
            <Plus size={20} aria-hidden="true" />
          </button>
        </form>
        {total > 0 && addMealsButton(false)}
      </div>

      {error && errorNotice(error)}

      {total === 0 ? (
        <div className="tile tile-neutral items-center text-center py-10 gap-1">
          <ShoppingBasket size={28} className="text-muted mb-2" aria-hidden="true" />
          <p className="font-semibold">The list is empty</p>
          <p className="text-sm text-muted mb-3">
            {mealsToAdd.length > 0 ? 'Add the meals you have planned, or type what you need.'
              : plans ? 'Plan a few meals, or type what you need.'
              : 'Type what you need.'}
          </p>
          {addMealsButton(true)}
        </div>
      ) : toBuy.length > 0 ? (
        <ul className="card px-2 md:px-3 py-2">{toBuy.map(renderItem)}</ul>
      ) : (
        <div className="tile tile-neutral items-center text-center py-8">
          <PartyPopper size={28} className="mb-2" aria-hidden="true" />
          <p className="font-semibold">All done</p>
          <p className="text-sm text-muted mt-1">Everything's in the basket. Time to head home.</p>
        </div>
      )}

      {inBasket.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 px-2 pb-1.5">
            <h3 className="font-sans text-xs font-semibold text-muted">In the basket · {inBasket.length}</h3>
            <button onClick={() => run(clearBasket, "We couldn't clear the basket. Try again.")} className="btn-ghost btn-sm">
              Clear basket
            </button>
          </div>
          <ul className="card px-2 md:px-3 py-2">{inBasket.map(renderItem)}</ul>
        </section>
      )}

      {upcomingOnList.length > 0 && (
        <details className="card px-4 py-3 group/meals">
          <summary className="cursor-pointer text-sm font-semibold min-h-9 flex items-center">
            For {upcomingOnList.length} planned {upcomingOnList.length === 1 ? 'meal' : 'meals'}
          </summary>
          <ul className="mt-1">
            {upcomingOnList.map(([key, meal]) => (
              <li key={key} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold line-clamp-1">{meal.name}</span>
                  <span className="block text-xs text-muted">
                    {new Date(`${meal.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
                    {plans && !planned.has(key) && ' · No longer planned'}
                  </span>
                </span>
                <button
                  onClick={() => run(() => removeMealFromList(key), `We couldn't take ${meal.name} off the list. Try again.`)}
                  className="icon-btn hit-target size-9 shrink-0"
                  aria-label={`Take ${meal.name} and its ingredients off the list`}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {addingMeals && <AddMealsSheet meals={mealsToAdd} onAdd={addMealsToList} onClose={() => setAddingMeals(false)} />}

      {lastRemoved && (
        <div className="sticky bottom-[calc(var(--tab-bar-bottom)+78px)] nav:bottom-8 z-20 flex justify-center pt-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink text-on-ink pl-5 pr-1.5 py-1.5 shadow-[var(--elev-md)]" role="status">
            <span className="text-sm font-semibold truncate max-w-[55vw] first-letter:uppercase">Removed {lastRemoved.name}</span>
            <button
              onClick={() => {
                const item = lastRemoved;
                setLastRemoved(null);
                void run(() => restoreItem(item), `We couldn't put ${item.name} back. Try again.`);
              }}
              className="btn-base min-h-10 px-4 rounded-full text-sm font-bold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--on-ink)]"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const errorNotice = (message: string) => (
  <div className="rounded-3xl bg-error-bg p-5 flex gap-3" role="alert">
    <CircleAlert size={22} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
    <p className="text-sm min-w-0">{message}</p>
  </div>
);
