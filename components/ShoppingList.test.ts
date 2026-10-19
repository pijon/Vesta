// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DayPlan, ShoppingList as List } from '../types';

const remote = vi.hoisted(() => ({
  list: null as List | null,
  plans: {} as Record<string, DayPlan>,
  update: (_list: List) => {},
  remove: vi.fn<() => Promise<void>>(),
  clear: vi.fn<() => Promise<void>>(),
  reset: vi.fn<() => Promise<void>>(),
  check: vi.fn<() => Promise<void>>(),
  removeItem: vi.fn<() => Promise<void>>(),
}));

vi.mock('../services/shoppingService', () => ({
  getCachedShoppingList: () => remote.list,
  subscribeShoppingList: (update: (list: List) => void) => { remote.update = update; return () => {}; },
  removeMealFromList: () => remote.remove(),
  clearBasket: () => remote.clear(),
  resetShoppingList: () => remote.reset(),
  setItemChecked: () => remote.check(),
  removeItem: () => remote.removeItem(),
  moveOldListToFamily: async () => {},
  moveOldPantryToFamily: async () => {},
  forgetOldPantryMarks: async () => {},
}));
vi.mock('../services/pageData', () => ({ shoppingData: {} }));
vi.mock('../services/firebase', () => ({ currentUid: () => 'me' }));
vi.mock('../utils/prewarm', () => ({
  peekWarm: () => ({ plans: remote.plans }),
  ensureWarm: async () => ({ plans: remote.plans }),
}));

const { ShoppingList } = await import('./ShoppingList');
let root: Root;
let container: HTMLDivElement;
const source = (meal: string, quantity: number) => ({ date: '2099-01-01', meal, quantity, unit: 'item' });

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  remote.remove.mockReset().mockResolvedValue();
  remote.clear.mockReset().mockResolvedValue();
  remote.reset.mockReset().mockResolvedValue();
  remote.check.mockReset().mockResolvedValue();
  remote.removeItem.mockReset().mockResolvedValue();
  remote.plans = {
    '2099-01-01': {
      date: '2099-01-01', completedMealIds: [],
      meals: [
        { id: 'chili', instanceId: 'm1', name: 'Chili', ingredients: ['2 eggs', '1 onion'], calories: 200, servings: 1, tags: [] },
        { id: 'soup', instanceId: 'm2', name: 'Soup', ingredients: ['1 egg'], calories: 100, servings: 1, tags: [] },
      ],
    },
  };
  remote.list = {
    items: [
      { id: 'eggs', key: 'egg|item', name: 'eggs', addedBy: 'me', addedAt: 0, sources: { m1: source('Chili', 2), m2: source('Soup', 1) } },
      { id: 'onion', key: 'onion|item', name: 'onion', addedBy: 'me', addedAt: 0, sources: { m1: source('Chili', 1) } },
      { id: 'milk', key: 'milk|item', name: 'milk', amount: '1 l', checked: true, addedBy: 'me', addedAt: 0, sources: {} },
    ],
    meals: { m1: { date: '2099-01-01', name: 'Chili' }, m2: { date: '2099-01-01', name: 'Soup' } },
    pantry: {},
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root.render(React.createElement(ShoppingList)); });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const click = async (label: string) => {
  const button = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent?.trim()) === label);
  expect(button, `Button: ${label}`).toBeDefined();
  await act(async () => { button!.click(); });
};

describe('shopping list actions without a reload', () => {
  it('removes a meal immediately, keeps another meal’s share and stays removed before live updates arrive', async () => {
    let finish!: () => void;
    remote.remove.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await click('Take Chili and its ingredients off the list');
    expect(container.textContent).not.toContain('Chili');
    expect(container.querySelector('[aria-label="Mark onion as in the basket"]')).toBeNull();
    expect(container.querySelector('[aria-label="Change amount: 1"]')).not.toBeNull();
    // A different subscription can emit before the removal has reached Firestore.
    await act(async () => { remote.update({ ...remote.list!, pantry: { salt: { key: 'salt', name: 'salt', by: 'partner', markedAt: Date.now() } } }); });
    expect(container.textContent).not.toContain('Chili');
    await act(async () => { finish(); });
    expect(container.textContent).not.toContain('Chili');
    expect(container.textContent).toContain('Soup');
  });

  it('restores a meal when saving fails and retains the latest family update', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail!: (error: Error) => void;
    remote.remove.mockReturnValue(new Promise<void>((_resolve, reject) => { fail = reject; }));
    await click('Take Chili and its ingredients off the list');
    expect(container.textContent).not.toContain('Chili');
    await act(async () => { remote.update({ ...remote.list!, items: [...remote.list!.items, { id: 'coffee', key: 'coffee|item', name: 'coffee', amount: '', sources: {}, addedBy: 'partner', addedAt: 1 }] }); });
    await act(async () => { fail(new Error('Offline')); });
    expect(container.querySelector('[aria-label="Take Chili and its ingredients off the list"]')).not.toBeNull();
    expect(container.textContent).toContain('coffee');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("couldn't take Chili off");
  });

  it('clears the basket immediately while preserving things still to buy', async () => {
    let finish!: () => void;
    remote.clear.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await click('Clear basket');
    expect(container.textContent).not.toContain('milk');
    expect(container.querySelector('[aria-label="Mark eggs as in the basket"]')).not.toBeNull();
    await act(async () => { finish(); });
    expect(container.textContent).not.toContain('milk');
  });

  it('offers a confirmed reset that empties the list and lets planned meals be added again', async () => {
    let finish!: () => void;
    remote.reset.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    await click('Reset list');
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('family');
    expect(container.textContent).toContain('eggs');
    await click('Reset shopping list');
    expect(container.textContent).toContain('The list is empty');
    expect(container.textContent).not.toContain('For 2 planned meals');
    expect(container.textContent).toContain('Add 2 planned meals');
    await act(async () => { finish(); });
    expect(container.textContent).toContain('The list is empty');
  });

  it('leaves the list intact when reset is cancelled', async () => {
    await click('Reset list');
    await click('Cancel');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[aria-label="Mark eggs as in the basket"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Take Chili and its ingredients off the list"]')).not.toBeNull();
  });

  it('restores the list and offers retry if resetting fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail!: (error: Error) => void;
    remote.reset.mockReturnValue(new Promise<void>((_resolve, reject) => { fail = reject; }));
    await click('Reset list');
    await click('Reset shopping list');
    expect(container.textContent).toContain('The list is empty');
    await act(async () => { fail(new Error('Save failed')); });
    expect(container.querySelector('[aria-label="Mark eggs as in the basket"]')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("couldn't reset");
    expect(container.textContent).toContain('Reset list');
  });

  it('ticks and removes individual items immediately while saving is pending', async () => {
    let checked!: () => void;
    remote.check.mockReturnValue(new Promise<void>(resolve => { checked = resolve; }));
    await click('Mark eggs as in the basket');
    expect(container.querySelector('[aria-label="Put eggs back on the list"]')).not.toBeNull();
    await act(async () => { checked(); });
    let removed!: () => void;
    remote.removeItem.mockReturnValue(new Promise<void>(resolve => { removed = resolve; }));
    await click('Remove eggs');
    expect(container.querySelector('[aria-label="Put eggs back on the list"]')).toBeNull();
    expect(container.textContent).toContain('Undo');
    await act(async () => { removed(); });
    expect(container.querySelector('[aria-label="Remove eggs"]')).toBeNull();
  });
});
