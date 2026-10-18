import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { EnhancedShoppingState, ParsedIngredientLine, ShoppingList, ShoppingListItem, ShoppingListMeal } from '../types';
import { currentUid, db } from './firebase';
import { getMyGroupId } from './groupService';
import { saveParsedIngredients } from './storageService';
import { parseIngredients } from './geminiService';
import { getCacheKey, getFromCache, saveToCache } from '../utils/cacheService';
import { parseIngredientLine, readRecipeLines } from '../utils/ingredientParse';
import { itemKey, mealsOnList, planAdditions, planMealRemoval } from '../utils/shoppingList';
import { formatAmount } from '../utils/scaleIngredient';
import { localDateString } from '../utils/dateUtils';
import { PlanMeal } from '../utils/shoppingUtils';

// The family's shopping list: groups/{groupId}/shoppingItems/{id}, one doc per item so members
// ticking at the same time never overwrite each other, and groups/{groupId}/shopping/list with the
// planned meals on it. Each meal's share of an item is its own field (sources.{instanceId}).

const itemsRef = (groupId: string) => collection(db, 'groups', groupId, 'shoppingItems');
const itemRef = (groupId: string, id: string) => doc(db, 'groups', groupId, 'shoppingItems', id);
const listRef = (groupId: string) => doc(db, 'groups', groupId, 'shopping', 'list');
const CACHE_KEY = getCacheKey('shoppingList');
// Firestore batches hold at most 500 writes
const BATCH_SIZE = 400;

type Write = (batch: ReturnType<typeof writeBatch>) => void;
const commit = async (writes: Write[]) => {
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    writes.slice(i, i + BATCH_SIZE).forEach(write => write(batch));
    await batch.commit();
  }
};

const familyId = async () => {
  const groupId = await getMyGroupId();
  if (!groupId) throw new Error("Couldn't load your family");
  return groupId;
};

const me = () => {
  const uid = currentUid();
  if (!uid) throw new Error('User not authenticated');
  return uid;
};

const readItems = async (groupId: string): Promise<ShoppingListItem[]> =>
  (await getDocs(itemsRef(groupId))).docs.map(d => ({ ...d.data() as ShoppingListItem, id: d.id }));

/** The list as last seen on this device, to show before the live one arrives */
export const getCachedShoppingList = (): ShoppingList | null => getFromCache<ShoppingList>(CACHE_KEY);

/** Keeps the family's list live. Returns the unsubscribe function. */
export const subscribeShoppingList = (onUpdate: (list: ShoppingList) => void, onError: (e: unknown) => void): (() => void) => {
  let stopped = false;
  const unsubscribes: (() => void)[] = [];
  const items = new Map<string, ShoppingListItem>();
  let meals: Record<string, ShoppingListMeal> = {};
  let itemsLoaded = false, mealsLoaded = false;
  const emit = () => {
    if (stopped || !itemsLoaded || !mealsLoaded) return;
    const list = { items: [...items.values()], meals };
    saveToCache(CACHE_KEY, list);
    onUpdate(list);
  };

  familyId().then(groupId => {
    if (stopped) return;
    unsubscribes.push(onSnapshot(itemsRef(groupId), snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') items.delete(change.doc.id);
        else items.set(change.doc.id, { ...change.doc.data() as ShoppingListItem, id: change.doc.id });
      });
      itemsLoaded = true;
      emit();
    }, onError));
    unsubscribes.push(onSnapshot(collection(db, 'groups', groupId, 'shopping'), snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.doc.id !== 'list') return;
        meals = change.type === 'removed' ? {} : (change.doc.data() as { meals?: Record<string, ShoppingListMeal> }).meals || {};
      });
      mealsLoaded = true;
      emit();
    }, onError));
  }).catch(onError);

  return () => { stopped = true; unsubscribes.forEach(unsubscribe => unsubscribe()); };
};

/**
 * Reads the meals' ingredient lines: kept on their recipe, plain enough to read in code, or by the
 * AI, whose readings are kept on the recipes for next time and for the rest of the family.
 */
const readMealLines = async (meals: PlanMeal[]): Promise<Map<string, ParsedIngredientLine>> => {
  const parts = meals.flatMap(meal => meal.parts);
  const read = new Map<string, ParsedIngredientLine>();
  parts.forEach(part => part.parsedIngredients?.forEach(line => read.set(line.text, line)));
  const texts = [...new Set(parts.flatMap(part => part.ingredients))];
  texts.forEach(text => {
    const line = read.has(text) ? undefined : parseIngredientLine(text);
    if (line) read.set(text, line);
  });

  const forAi = texts.filter(text => !read.has(text));
  if (forAi.length === 0) return read;
  // One result per text, or it throws
  const fromAi = await parseIngredients(forAi);
  forAi.forEach((text, i) => read.set(text, { text, ...fromAi[i] }));
  const recipes = new Map(parts.filter(part => !part.isQuick).map(part => [part.id, part]));
  recipes.forEach(part => {
    if (!part.ingredients.some(text => forAi.includes(text))) return;
    const lines = readRecipeLines(part.ingredients, part.ingredients.flatMap(text => read.get(text) ?? []));
    saveParsedIngredients(part.id, lines).catch(e => console.warn(`Couldn't keep the read ingredients of ${part.name}`, e));
  });
  return read;
};

/** Planned meals that ended before today, to forget */
const pastMeals = (meals: Record<string, ShoppingListMeal>) =>
  Object.fromEntries(Object.entries(meals).filter(([, meal]) => meal.date < localDateString()).map(([id]) => [id, deleteField()]));

/** Changes to the meals on the list, if any: an empty map would replace them all */
const mealsChange = (groupId: string, meals: Record<string, unknown>): Write[] =>
  Object.keys(meals).length > 0 ? [batch => batch.set(listRef(groupId), { meals }, { merge: true })] : [];

const listMeals = async (groupId: string): Promise<Record<string, ShoppingListMeal>> =>
  ((await getDoc(listRef(groupId))).data() as { meals?: Record<string, ShoppingListMeal> } | undefined)?.meals || {};

/** Adds planned meals' ingredients to the list, adding up with what's already on it. */
export const addMealsToList = async (meals: PlanMeal[]) => {
  const groupId = await familyId();
  const [items, recorded] = await Promise.all([readItems(groupId), listMeals(groupId)]);
  const onList = mealsOnList({ items, meals: recorded });
  const fresh = meals.filter(meal => !onList.has(meal.key));
  const read = await readMealLines(fresh);
  const toAdd = fresh.map(meal => ({
    instanceId: meal.key,
    date: meal.date,
    name: meal.name,
    lines: meal.parts.flatMap(part => part.ingredients.flatMap(text => read.get(text) ?? [])),
  }));
  const { create, add } = planAdditions(items, toAdd, me(), Date.now(), () => crypto.randomUUID());
  const record = meals.filter(meal => !recorded[meal.key]).map(meal => [meal.key, { date: meal.date, name: meal.name }]);
  await commit([
    ...create.map((item): Write => batch => batch.set(itemRef(groupId, item.id), item)),
    ...[...add].map(([id, sources]): Write => batch => batch.set(itemRef(groupId, id), { sources }, { merge: true })),
    ...mealsChange(groupId, { ...pastMeals(recorded), ...Object.fromEntries(record) }),
  ]);
};

/** Takes a meal off the list, with what it needed */
export const removeMealFromList = async (instanceId: string) => {
  const groupId = await familyId();
  const { remove, trim } = planMealRemoval(await readItems(groupId), instanceId);
  await commit([
    ...remove.map((id): Write => batch => batch.delete(itemRef(groupId, id))),
    ...trim.map((id): Write => batch => batch.set(itemRef(groupId, id), { sources: { [instanceId]: deleteField() } }, { merge: true })),
    ...mealsChange(groupId, { [instanceId]: deleteField() }),
  ]);
};

/** Something typed onto the list ("2 l mjölk", "toilet paper"); it doesn't add up with meals. */
export const addOwnItem = async (text: string) => {
  const typed = text.trim();
  if (!typed) return;
  const line = parseIngredientLine(typed);
  const name = line?.name ?? typed;
  const item: ShoppingListItem = {
    id: crypto.randomUUID(),
    key: itemKey(name, line?.unit ?? 'item'),
    name,
    sources: {},
    amount: line ? formatAmount(line.quantity, line.unit) : '',
    addedBy: me(),
    addedAt: Date.now(),
  };
  await setDoc(itemRef(await familyId(), item.id), item);
};

export const setItemChecked = async (id: string, checked: boolean) => {
  await updateDoc(itemRef(await familyId(), id), checked ? { checked: true, checkedBy: me() } : { checked: false, checkedBy: deleteField() });
};

/** An amount changed by hand, shown instead of what the meals need */
export const setItemAmount = async (id: string, amount: string) => {
  await updateDoc(itemRef(await familyId(), id), { amount });
};

export const removeItem = async (id: string) => {
  await deleteDoc(itemRef(await familyId(), id));
};

/** Puts a removed item back (undo) */
export const restoreItem = async (item: ShoppingListItem) => {
  await setDoc(itemRef(await familyId(), item.id), item);
};

/** Removes ticked items, and forgets meals already past */
export const clearBasket = async () => {
  const groupId = await familyId();
  const [items, onList] = await Promise.all([readItems(groupId), listMeals(groupId)]);
  await commit([
    ...items.filter(item => item.checked).map((item): Write => batch => batch.delete(itemRef(groupId, item.id))),
    ...mealsChange(groupId, pastMeals(onList)),
  ]);
};

type OldShoppingState = Partial<EnhancedShoppingState> & { movedToFamily?: boolean };

/**
 * Moves the user's own list from before family lists (users/{uid}/data/shopping) onto the
 * family's, once: what was still to buy becomes own items, if the family's list is empty.
 * The old doc stays, marked as moved.
 */
export const moveOldListToFamily = async () => {
  const oldRef = doc(db, 'users', me(), 'data', 'shopping');
  const old = await getDoc(oldRef);
  const state = old.data() as OldShoppingState | undefined;
  if (!state || state.movedToFamily) return;

  const groupId = await familyId();
  if ((await readItems(groupId)).length === 0) {
    const done = new Set([...(state.removed || []), ...(state.purchased || [])]);
    const now = Date.now();
    const items: ShoppingListItem[] = (state.cachedPurchasableItems || [])
      .filter(item => !done.has(item.ingredientName))
      .map((item, i) => ({
        id: crypto.randomUUID(),
        key: itemKey(item.ingredientName, 'item'),
        name: item.ingredientName,
        sources: {},
        amount: item.purchasableQuantity || item.requiredQuantity || '',
        addedBy: me(),
        addedAt: now + i,
      }));
    await commit(items.map((item): Write => batch => batch.set(itemRef(groupId, item.id), item)));
  }
  await updateDoc(oldRef, { movedToFamily: true });
};
