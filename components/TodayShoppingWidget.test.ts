// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPlan, ShoppingList, ShoppingListItem } from '../types';
import { localDateString } from '../utils/dateUtils';

const state = vi.hoisted(() => ({ list: null as unknown, plans: {} as Record<string, unknown> }));
vi.mock('../services/shoppingService', () => ({
  getCachedShoppingList: () => state.list,
  subscribeShoppingList: () => () => {},
  addMealsToList: async () => {},
}));
vi.mock('../services/pageData', () => ({ shoppingData: {} }));
vi.mock('../utils/prewarm', () => ({ usePrewarmed: () => ({ plans: state.plans }) }));

const { TodayShoppingWidget } = await import('./TodayShoppingWidget');

const item = (name: string, extra: Partial<ShoppingListItem> = {}): ShoppingListItem =>
  ({ id: name, key: name, name, sources: {}, amount: '', addedBy: 'me', addedAt: 1, ...extra });
const list = (items: ShoppingListItem[], meals: ShoppingList['meals'] = {}): ShoppingList => ({ items, meals, pantry: {} });

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.plans = {};
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

const render = async (onOpen = vi.fn()) => {
  await act(async () => root.render(React.createElement(TodayShoppingWidget, { onOpen })));
  return onOpen;
};

describe('Today\'s shopping widget', () => {
  it('counts what is left to buy, previews a few items and opens the list', async () => {
    state.list = list(['äpplen', 'bröd', 'ägg', 'mjölk', 'smör', 'ost'].map(name => item(name)).concat(item('salt', { checked: true })));
    const onOpen = await render();
    expect(container.textContent).toContain('6 things left to buy');
    expect(container.textContent).not.toContain('salt');
    expect(container.textContent).toContain('and 2 more');
    await act(async () => container.querySelector('button')!.click());
    expect(onOpen).toHaveBeenCalled();
  });

  it('says so when everything is bought', async () => {
    state.list = list([item('salt', { checked: true })]);
    await render();
    expect(container.textContent).toContain('Nothing left to buy');
  });

  it('points out planned meals that are not on the list yet', async () => {
    state.list = list([]);
    const date = localDateString();
    const plan: DayPlan = {
      date, completedMealIds: [],
      meals: [{ id: 'r1', instanceId: 'm1', name: 'Chili', calories: 600, calorieStatus: 'known', ingredients: ['500 g beef'], tags: [], servings: 2, slot: 'dinner' }],
    };
    state.plans = { [date]: plan };
    await render();
    expect(container.textContent).toContain('Nothing on the list yet');
    expect(container.textContent).toContain('Add 1 meal to the list');
  });
});
