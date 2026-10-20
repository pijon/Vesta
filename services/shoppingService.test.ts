import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PantryMark, Recipe, ShoppingList, ShoppingListItem } from '../types';
import { PlanMeal } from '../utils/shoppingUtils';

const fake = vi.hoisted(() => ({ uid: 'me', aiCalls: [] as string[][] }));

vi.mock('firebase/firestore', async () => (await import('../test/fakeFirestore')).fakeFirestore.api);
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: null }, currentUid: () => fake.uid }));
vi.mock('./geminiService', () => ({
  parseIngredients: async (texts: string[]) => {
    fake.aiCalls.push(texts);
    return texts.map(() => ({ name: 'salt', quantity: 1, unit: 'nypa' }));
  },
}));

const { fakeFirestore: store } = await import('../test/fakeFirestore');
const { forgetMyGroupId } = await import('./groupService');
const {
  addMealsToList, addOwnItem, clearBasket, forgetOldPantryMarks, markAtHome, markNeeded, moveOldListToFamily,
  moveOldPantryToFamily, removeMealFromList, resetShoppingList, setItemChecked, subscribeShoppingList,
} = await import('./shoppingService');
const { itemAmount } = await import('../utils/shoppingList');

const items = () => [...store.docs].filter(([path]) => path.startsWith('groups/g/shoppingItems/')).map(([, d]) => d as unknown as ShoppingListItem);
const named = (name: string) => items().find(i => i.name === name)!;
const pantry = () => [...store.docs].filter(([path]) => path.startsWith('groups/g/pantry/')).map(([, d]) => d as unknown as PantryMark);
const DAY = 86_400_000;
const listMeals = () => (store.docs.get('groups/g/shopping/list') as { meals: Record<string, unknown> } | undefined)?.meals ?? {};
const planMeal = (key: string, ingredients: string[], fields: Partial<PlanMeal> = {}): PlanMeal => ({
  key, name: 'Chili', date: '2099-01-01', parts: [{ id: 'r1', name: 'Chili', ingredients }], ...fields,
});

beforeEach(() => {
  store.reset();
  forgetMyGroupId();
  fake.uid = 'me';
  fake.aiCalls.length = 0;
  store.docs.set('users/me', { groupId: 'g' });
  store.docs.set('users/partner', { groupId: 'g' });
  store.docs.set('groups/g', { id: 'g', name: 'Family', ownerId: 'me', createdAt: 0, inviteCode: 'ABCDEFGH', memberIds: ['me', 'partner'], legacyRecipesMoved: ['me', 'partner'] });
});

describe('adding meals', () => {
  it('adds up the same food across meals, and adding a meal twice never doubles it', async () => {
    await addMealsToList([planMeal('m1', ['500 g potatis', '2 eggs'])]);
    await addMealsToList([planMeal('m1', ['500 g potatis', '2 eggs']), planMeal('m2', ['0.7 kg potatis'], { name: 'Mash' })]);
    expect(items().map(i => [i.name, itemAmount(i)]).sort()).toEqual([['eggs', '2'], ['potatis', '1.2 kg']]);
    expect(Object.keys(listMeals()).sort()).toEqual(['m1', 'm2']);
  });

  it('asks the AI only about lines it can\'t read, and keeps its answers on the recipe', async () => {
    store.docs.set('groups/g/recipes/r1', { id: 'r1', name: 'Chili', ingredients: ['500 g beef', 'rice and beans'] });
    await addMealsToList([planMeal('m1', ['500 g beef', 'rice and beans'])]);
    expect(fake.aiCalls).toEqual([['rice and beans']]);
    await vi.waitFor(() => expect((store.docs.get('groups/g/recipes/r1') as unknown as Recipe).parsedIngredients).toEqual([
      { text: '500 g beef', name: 'beef', quantity: 500, unit: 'g' },
      { text: 'rice and beans', name: 'salt', quantity: 1, unit: 'nypa' },
    ]));
  });

  it('lists salt and pepper without an amount and without asking the AI', async () => {
    await addMealsToList([planMeal('m1', ['1 tsk salt', 'svartpeppar, nymalen', '2 eggs'])]);
    expect(fake.aiCalls).toEqual([]);
    expect(itemAmount(named('salt'))).toBe('');
    expect(itemAmount(named('pepper'))).toBe('');
    expect(itemAmount(named('eggs'))).toBe('2');
  });

  it('brings sides along, and lines already read on the recipe skip the AI', async () => {
    await addMealsToList([planMeal('m1', ['500 g beef'], {
      parts: [
        { id: 'r1', name: 'Chili', ingredients: ['500 g beef'] },
        { id: 'rice', name: 'Rice', ingredients: ['Rice'], parsedIngredients: [{ text: 'Rice', name: 'rice', quantity: 3, unit: 'dl' }] },
      ],
    })]);
    expect(fake.aiCalls).toEqual([]);
    expect(itemAmount(named('rice'))).toBe('3 dl');
  });

  it('starts a new item when the matching one is already in the basket', async () => {
    await addMealsToList([planMeal('m1', ['2 eggs'])]);
    await setItemChecked(named('eggs').id, true);
    await addMealsToList([planMeal('m2', ['3 eggs'])]);
    expect(items().map(i => [itemAmount(i), !!i.checked]).sort()).toEqual([['2', true], ['3', false]]);
  });

  it('never adds a meal twice, even when the list\'s record of its meals is missing', async () => {
    await addMealsToList([planMeal('m1', ['2 eggs'])]);
    store.docs.delete('groups/g/shopping/list');
    await addMealsToList([planMeal('m1', ['2 eggs'])]);
    expect(items().map(i => itemAmount(i))).toEqual(['2']);
    expect(Object.keys(listMeals())).toEqual(['m1']);
  });
});

describe('the family\'s list', () => {
  it('is the same list for every member, live', async () => {
    const seen: ShoppingList[] = [];
    const stop = subscribeShoppingList(list => seen.push(list), e => { throw e; });
    fake.uid = 'partner';
    forgetMyGroupId();
    await addOwnItem('2 l mjölk');
    await addOwnItem('toilet paper');
    await vi.waitFor(() => expect(seen.at(-1)?.items.map(i => [i.name, itemAmount(i), i.addedBy]).sort()).toEqual([
      ['mjölk', '2 l', 'partner'], ['toilet paper', '', 'partner'],
    ]));
    stop();
  });

  it('takes a meal off with what only it needed', async () => {
    await addMealsToList([planMeal('m1', ['2 eggs', '1 onion']), planMeal('m2', ['1 egg'])]);
    await removeMealFromList('m1');
    expect(items().map(i => [i.name, itemAmount(i)])).toEqual([['eggs', '1']]);
    expect(Object.keys(listMeals())).toEqual(['m2']);
  });

  it('clears the basket and forgets meals already past', async () => {
    await addMealsToList([planMeal('old', ['2 eggs'], { date: '2020-01-01' }), planMeal('m1', ['1 onion'])]);
    await setItemChecked(named('eggs').id, true);
    await clearBasket();
    expect(items().map(i => i.name)).toEqual(['onion']);
    expect(Object.keys(listMeals())).toEqual(['m1']);
    // With nothing past, the meals on the list stay
    await clearBasket();
    expect(Object.keys(listMeals())).toEqual(['m1']);
  });

  it('resets every item and meal live, preserves the pantry and allows meals to be added again', async () => {
    await addMealsToList([planMeal('m1', ['2 eggs', '1 tsk salt'])]);
    await markAtHome('salt');
    await addOwnItem('coffee');
    await setItemChecked(named('eggs').id, true);
    const seen: ShoppingList[] = [];
    const stop = subscribeShoppingList(list => seen.push(list), e => { throw e; });
    await vi.waitFor(() => expect(seen.at(-1)?.items).toHaveLength(3));
    await resetShoppingList();
    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ items: [], meals: {} }));
    expect(pantry().map(mark => mark.key)).toEqual(['salt']);
    await addMealsToList([planMeal('m1', ['2 eggs'])]);
    expect(items().map(item => item.name)).toEqual(['eggs']);
    expect(Object.keys(listMeals())).toEqual(['m1']);
    stop();
  });

  it('resets lists larger than one Firestore batch', async () => {
    for (let i = 0; i < 405; i++) {
      store.docs.set(`groups/g/shoppingItems/i${i}`, { id: `i${i}`, name: 'coffee', sources: {} });
    }
    await resetShoppingList();
    expect(items()).toEqual([]);
  });
});

describe('the list from before family lists', () => {
  const old = {
    purchased: ['bread'], removed: ['salt'],
    cachedPurchasableItems: ['milk', 'bread', 'salt'].map(name => ({ ingredientName: name, requiredQuantity: '1', purchasableQuantity: `1 ${name}`, purchasableSize: '' })),
  };

  it('moves what was still to buy onto an empty family list, once', async () => {
    store.docs.set('users/me/data/shopping', old);
    await moveOldListToFamily();
    await moveOldListToFamily();
    expect(items().map(i => [i.name, itemAmount(i)])).toEqual([['milk', '1 milk']]);
    expect(store.docs.get('users/me/data/shopping')).toMatchObject({ movedToFamily: true });
  });

  it('leaves a family list that already has items alone', async () => {
    await addOwnItem('coffee');
    store.docs.set('users/me/data/shopping', old);
    await moveOldListToFamily();
    expect(items().map(i => i.name)).toEqual(['coffee']);
  });
});

describe('the family\'s pantry', () => {
  it('moves what\'s at home out of the shopping, live, and back when needed', async () => {
    const seen: ShoppingList[] = [];
    const stop = subscribeShoppingList(list => seen.push(list), e => { throw e; });
    await addMealsToList([planMeal('m1', ['1 tsk salt', '2 eggs'])]);
    await markAtHome('salt');
    await vi.waitFor(() => expect(Object.keys(seen.at(-1)!.pantry)).toEqual(['salt']));
    expect(pantry()).toEqual([expect.objectContaining({ key: 'salt', name: 'salt', by: 'me' })]);
    await markNeeded('salt');
    await vi.waitFor(() => expect(seen.at(-1)!.pantry).toEqual({}));
    stop();
  });

  it('clears what was at home with the basket, but keeps it marked', async () => {
    await addMealsToList([planMeal('m1', ['1 tsk salt', '2 eggs', '1 onion'])]);
    await markAtHome('salt');
    await setItemChecked(named('eggs').id, true);
    await clearBasket();
    expect(items().map(i => i.name)).toEqual(['onion']);
    expect(pantry().map(m => m.key)).toEqual(['salt']);
  });

  it('forgets marks too old to count', async () => {
    await markAtHome('salt');
    store.docs.set('groups/g/pantry/pepper', { key: 'pepper', name: 'pepper', markedAt: Date.now() - 40 * DAY, by: 'me' });
    await forgetOldPantryMarks();
    expect(pantry().map(m => m.key)).toEqual(['salt']);
  });

  it('moves each member\'s old pantry in once, keeping recent marks and newer family ones', async () => {
    const now = Date.now();
    store.docs.set('groups/g/pantry/olja', { key: 'olja', name: 'olja', markedAt: now - DAY, by: 'partner' });
    store.docs.set('users/me/data/pantry', { lastUpdated: 0, items: [
      { name: 'eggs', markedAt: now - 2 * DAY, persistent: true },
      { name: 'salt (tsk)', markedAt: now - 3 * DAY, persistent: true },
      { name: 'olja', markedAt: now - 5 * DAY, persistent: true },
      { name: 'salt', markedAt: now - 90 * DAY, persistent: true },
    ] });
    await moveOldPantryToFamily();
    await moveOldPantryToFamily();
    expect(pantry().map(m => [m.key, m.by]).sort()).toEqual([['egg', 'me'], ['olja', 'partner'], ['salt', 'me']]);
    expect(store.docs.get('users/me/data/pantry')).toMatchObject({ movedToFamily: true });
  });
});
