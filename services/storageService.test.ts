import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DayPlan, PlannedMeal, Recipe } from '../types';
import { decideEatingOut, eatingOutBudgetMeal, eatingOutDishMeal, planMeal, setFamilyMealOut, withLiveBudgets, QUICK_MEAL_DESCRIPTION } from '../utils/planUtils';

const fake = vi.hoisted(() => ({ uid: 'me' }));

vi.mock('firebase/firestore', async () => ({...(await import('../test/fakeFirestore')).fakeFirestore.api, runTransaction:(await import('../test/transactionFirestore')).runTestTransaction}));
vi.mock('./firebase', () => ({ db: {}, auth: { get currentUser() {return {uid:fake.uid};} }, currentUid: () => fake.uid }));

const { fakeFirestore: store } = await import('../test/fakeFirestore');
const { forgetMyGroupId, getMyGroupId } = await import('./groupService');
const { deleteRecipe, getCheckIns, getDayPlan, getUserStats, saveCheckInIfNew, saveUserStats, getPlanHistoryInRange, getRecipes, saveDayPlan, saveFamilyMealOut, saveParsedIngredients, saveRecipe, setRecipeFavorite, subscribeFamilyMeals } = await import('./storageService');
const { RECIPE_CACHE_MS } = await import('./recipeCache');
const { localWriteCount } = await import('../utils/localWrites');
const { getCachedDayPlan, getFromCache, getUserCacheKey, saveToCache } = await import('../utils/cacheService');
const { groupFamilyUpdates, recordFamilyUpdate } = await import('./activityService');

const chili: Recipe = {
  id: 'r1', name: 'Chili', calories: 520, protein: 35, servings: 4,
  ingredients: ['500 g beef', '2 cans beans'], instructions: ['Cook'], tags: ['main meal'],
};
const putRecipe = (recipe: Recipe) => store.docs.set(`groups/g/recipes/${recipe.id}`, JSON.parse(JSON.stringify(recipe)));
const storedDay = (date: string) => store.docs.get(`users/me/days/${date}`) as { meals: PlannedMeal[]; totalCalories: number };
/** The user's family; a second member makes dinners shared */
const setFamily = (memberIds: string[]) => {
  store.docs.set('users/me', { groupId: 'g' });
  store.docs.set('groups/g', { id: 'g', name: 'Family', ownerId: 'me', createdAt: 0, inviteCode: 'ABCDEFGH', memberIds, legacyRecipesMoved: memberIds });
};
const plan = (date: string, meals: Recipe[], extra: Partial<DayPlan> = {}): DayPlan => ({ date, meals, completedMealIds: [], ...extra });
const quickMeal = (fields: Partial<Recipe>): Recipe => ({
  id: crypto.randomUUID(), name: 'Pizza out', calories: 900, ingredients: [], tags: [], servings: 1,
  description: QUICK_MEAL_DESCRIPTION, quick: { kind: 'out' }, ...fields,
});

beforeEach(() => {
  store.reset();
  forgetMyGroupId();
  setFamily(['me']);
  putRecipe(chili);
});

describe('day plans', () => {
  it('stores library recipes as references, never the full recipe', async () => {
    await saveDayPlan(plan('2026-10-01', [planMeal(chili, 'dinner', { isPacked: true })]));
    const [stored] = storedDay('2026-10-01').meals;
    expect(stored).toMatchObject({ type: 'reference', recipeId: 'r1', slot: 'dinner', isPacked: true });
    expect(stored).not.toHaveProperty('ingredients');
    expect(stored).not.toHaveProperty('name');
  });

  it('loads a planned recipe back with its library details and plan settings', async () => {
    const meal = planMeal(chili, 'dinner', { isLeftover: true });
    await saveDayPlan(plan('2026-10-02', [meal], { completedMealIds: [meal.instanceId!], type: 'fast' }));
    const loaded = await getDayPlan('2026-10-02');
    expect(loaded).toMatchObject({ date: '2026-10-02', type: 'fast', completedMealIds: [meal.instanceId] });
    expect(loaded.meals[0]).toMatchObject({
      name: 'Chili', calories: 520, ingredients: chili.ingredients, slot: 'dinner',
      instanceId: meal.instanceId, isLeftover: true,
    });
  });

  it('shows library edits in plans already made', async () => {
    await saveDayPlan(plan('2026-10-03', [planMeal(chili, 'dinner')]));
    putRecipe({ ...chili, calories: 480 });
    expect((await getDayPlan('2026-10-03')).meals[0].calories).toBe(480);
  });

  it('keeps a planned meal whose recipe was deleted, marked missing', async () => {
    await saveDayPlan(plan('2026-10-04', [planMeal(chili, 'lunch')]));
    store.docs.delete('groups/g/recipes/r1');
    expect((await getDayPlan('2026-10-04')).meals[0]).toMatchObject({ isMissing: true, name: 'Recipe deleted', slot: 'lunch' });
  });

  it('round-trips quick meals, estimated and without calories', async () => {
    await saveDayPlan(plan('2026-10-05', [
      planMeal(quickMeal({ quick: { kind: 'out', estimated: true } }), 'dinner'),
      planMeal(quickMeal({ name: 'Lunch at work', calories: 0, quick: { kind: 'out', noCalories: true } }), 'lunch'),
    ]));
    const [estimated, unset] = (await getDayPlan('2026-10-05')).meals;
    expect(estimated).toMatchObject({ name: 'Pizza out', calories: 900, quick: { kind: 'out', estimated: true } });
    expect(unset).toMatchObject({ name: 'Lunch at work', calories: 0, quick: { noCalories: true } });
  });

  it('round-trips an eating-out budget and keeps it once the place is decided', async () => {
    const budget = planMeal(eatingOutBudgetMeal('dinner', 700), 'dinner');
    await saveDayPlan(plan('2026-10-06', [budget]));
    const [loaded] = (await getDayPlan('2026-10-06')).meals;
    expect(loaded).toMatchObject({ name: 'Eating out', calories: 700, quick: { kind: 'out', budget: true }, instanceId: budget.instanceId });

    await saveDayPlan(plan('2026-10-06', [decideEatingOut(loaded, 'Pad thai at Siam', 780, { protein: 30 })]));
    const [decided] = (await getDayPlan('2026-10-06')).meals;
    expect(decided).toMatchObject({ name: 'Pad thai at Siam', calories: 780, protein: 30, instanceId: budget.instanceId, quick: { kind: 'out', estimated: true } });
    expect(decided.quick?.budget).toBeUndefined();
  });

  it('keeps the place and dish of a planned dish, still open', async () => {
    const dish = planMeal(eatingOutDishMeal('dinner', { place: 'Thai corner', dish: 'Pad thai', calories: 780, protein: 30 }), 'dinner');
    await saveDayPlan(plan('2026-10-08', [dish]));
    const day = await getDayPlan('2026-10-08');
    expect(day.meals[0]).toMatchObject({ name: 'Pad thai at Thai corner', calories: 780, protein: 30, quick: { kind: 'out', place: 'Thai corner', dish: 'Pad thai' } });
    expect(day.completedMealIds).toEqual([]);
  });

  it('saves a live budget as planned, so it can follow the day again tomorrow', async () => {
    const live = withLiveBudgets(plan('2026-10-07', [planMeal(eatingOutBudgetMeal('dinner', 700), 'dinner')]), { loggedKcal: 250 });
    expect(live.meals[0].calories).toBe(450);
    await saveDayPlan(live);
    const [loaded] = (await getDayPlan('2026-10-07')).meals;
    expect(loaded).toMatchObject({ calories: 700, quick: { budget: true, autoBudget: true } });
  });

  it('keeps sides with their meal', async () => {
    const side = quickMeal({ name: 'Green salad', calories: 120, tags: ['side dish'], quick: {} });
    await saveDayPlan(plan('2026-10-06', [{ ...planMeal(chili, 'dinner'), sides: [side] }]));
    expect(storedDay('2026-10-06').totalCalories).toBe(640);
    expect((await getDayPlan('2026-10-06')).meals[0].sides).toMatchObject([{ name: 'Green salad', calories: 120 }]);
  });

  it("reads every reference from the family's recipes, also old ones that name an owner", async () => {
    putRecipe({ ...chili, id: 'p1', name: 'Pad thai', createdBy: 'partner' });
    store.docs.set('users/me/days/2026-10-07', {
      date: '2026-10-07', completedMealIds: [],
      meals: [{ type: 'reference', recipeId: 'p1', ownerId: 'partner', servings: 1, slot: 'dinner', instanceId: 'a' }],
    });
    expect((await getDayPlan('2026-10-07')).meals.map(m => m.name)).toEqual(['Pad thai']);

    await saveDayPlan(plan('2026-10-07', [planMeal({ ...chili, ownerId: 'partner' }, 'dinner')]));
    expect(storedDay('2026-10-07').meals[0]).not.toHaveProperty('ownerId');
  });

  it('gives meals without an instance id one, so they can be ticked off', async () => {
    await saveDayPlan(plan('2026-10-08', [{ ...chili, slot: 'dinner' }]));
    expect(storedDay('2026-10-08').meals[0].instanceId).toBeTruthy();
  });

  it('still reads legacy day docs that hold full recipes', async () => {
    store.docs.set('users/me/days/2026-10-09', { date: '2026-10-09', meals: [chili], completedMealIds: ['r1'] });
    expect((await getDayPlan('2026-10-09')).meals[0]).toMatchObject({ name: 'Chili', ingredients: chili.ingredients });
  });

  it('gives an empty plan for a day with nothing saved', async () => {
    expect(await getDayPlan('2026-10-10')).toMatchObject({ date: '2026-10-10', meals: [], completedMealIds: [] });
  });
});

describe('plan reads', () => {
  const recipeReads = () => store.reads.filter(path => path === 'groups/g/recipes/r1').length;
  const loadBoth = () => Promise.all([getDayPlan('2026-10-01'), getDayPlan('2026-10-02')]);
  beforeEach(async () => {
    await saveDayPlan(plan('2026-10-01', [planMeal(chili, 'dinner')]));
    await saveDayPlan(plan('2026-10-02', [planMeal(chili, 'lunch')]));
    store.reads.length = 0;
  });

  it("reads a planned recipe once for both days, and not again on the next refresh", async () => {
    await loadBoth();
    const [today] = await loadBoth();
    expect(today.meals[0]).toMatchObject({ name: 'Chili', calories: 520 });
    expect(recipeReads()).toBe(1);
  });

  it("shows the user's own recipe changes at once", async () => {
    await loadBoth();
    await saveRecipe({ ...chili, name: 'Chili con carne' });
    expect((await getDayPlan('2026-10-01')).meals[0].name).toBe('Chili con carne');

    await setRecipeFavorite('r1', true);
    expect((await getDayPlan('2026-10-01')).meals[0].isFavorite).toBe(true);

    await deleteRecipe('r1');
    expect((await getDayPlan('2026-10-01')).meals[0]).toMatchObject({ isMissing: true });
  });

  it("shows another member's edit once the kept copy is a few minutes old, or the recipes are loaded", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    try {
      await loadBoth();
      putRecipe({ ...chili, calories: 480 });
      expect((await getDayPlan('2026-10-01')).meals[0].calories).toBe(520);
      clock.mockReturnValue(now + RECIPE_CACHE_MS);
      expect((await getDayPlan('2026-10-01')).meals[0].calories).toBe(480);

      putRecipe({ ...chili, calories: 450 });
      await getRecipes();
      expect((await getDayPlan('2026-10-01')).meals[0].calories).toBe(450);
    } finally {
      clock.mockRestore();
    }
  });

  it('counts its writes, so a refresh on its way from before one is not reused', async () => {
    const before = localWriteCount();
    await saveDayPlan(plan('2026-10-01', []));
    await saveRecipe({ ...chili, name: 'Chili con carne' });
    await deleteRecipe('r1');
    expect(localWriteCount()).toBeGreaterThanOrEqual(before + 6); // each when it starts and when it's done
  });

  it('starts with the family remembered from last time, before the profile and group are read', async () => {
    await getMyGroupId();
    expect(getFromCache(getUserCacheKey('me', 'groupId'))).toBe('g');
    forgetMyGroupId(); // a new launch: the session's groupId is gone, the device remembers it
    expect(getFromCache(getUserCacheKey('me', 'groupId'))).toBeNull();
    saveToCache(getUserCacheKey('me', 'groupId'), 'g');
    store.reads.length = 0;

    expect((await getDayPlan('2026-10-01')).meals[0].name).toBe('Chili');
    const at = (path: string) => store.reads.indexOf(path);
    expect(at('users/me/days/2026-10-01')).toBeLessThan(at('groups/g'));
    expect(at('groups/g/dinners')).toBeLessThan(at('groups/g'));
    expect(at('groups/g/recipes/r1')).toBeGreaterThan(-1);
  });

  it('reads again in the confirmed family when the remembered one is no longer theirs', async () => {
    setFamily(['me', 'partner']);
    store.docs.set('groups/old', { id: 'old', name: 'Old', ownerId: 'ex', createdAt: 0, inviteCode: 'OLDOLDOL', memberIds: ['ex'] });
    store.docs.set('groups/old/recipes/r1', { ...JSON.parse(JSON.stringify(chili)), name: 'Old chili' });
    const meal = (name: string) => ({ type: 'reference', recipeId: 'r1', servings: 1, instanceId: name, slot: 'dinner', familyMeal: true, position: 0 });
    store.docs.set('groups/old/dinners/2026-10-03', { date: '2026-10-03', meals: { old: meal('old') } });
    store.docs.set('groups/g/dinners/2026-10-03', { date: '2026-10-03', meals: { now: meal('now') } });
    forgetMyGroupId();
    saveToCache(getUserCacheKey('me', 'groupId'), 'old');

    const day = await getDayPlan('2026-10-03');
    expect(day.meals.map(m => [m.instanceId, m.name])).toEqual([['now', 'Chili']]);
    expect(getFromCache(getUserCacheKey('me', 'groupId'))).toBe('g');

    // Saves only ever go to the confirmed family
    store.writes.length = 0;
    await saveDayPlan({ ...day, meals: [...day.meals, planMeal(chili, 'dinner', { familyMeal: true })] });
    expect(store.writes).toContain('groups/g/dinners/2026-10-03');
    expect(store.writes.filter(path => path.startsWith('groups/') && !path.startsWith('groups/g/'))).toEqual([]);
  });
});

describe('family meals', () => {
  beforeEach(() => { setFamily(['me', 'partner']); });
  const dinners = (date: string) => (store.docs.get(`groups/g/dinners/${date}`)?.meals ?? {}) as Record<string, PlannedMeal & { position: number }>;

  it("splits family dinners into the group's doc and merges them back", async () => {
    const lunch = planMeal(chili, 'lunch');
    const dinner = planMeal(chili, 'dinner', { familyMeal: true, isPacked: true });
    await saveDayPlan(plan('2026-10-11', [lunch, dinner]));

    expect(storedDay('2026-10-11').meals.map(m => m.instanceId)).toEqual([lunch.instanceId]);
    expect(dinners('2026-10-11')[dinner.instanceId!]).toMatchObject({ type: 'reference', recipeId: 'r1', isPacked: true, position: 0 });

    const loaded = await getDayPlan('2026-10-11');
    expect(loaded.meals.map(m => [m.instanceId, m.slot, !!m.familyMeal])).toEqual([
      [lunch.instanceId, 'lunch', false],
      [dinner.instanceId, 'dinner', true],
    ]);
  });

  it('only removes dinners this session has seen, never ones added since by someone else', async () => {
    const mine = planMeal(chili, 'dinner', { familyMeal: true });
    await saveDayPlan(plan('2026-10-12', [mine]));
    const loaded = await getDayPlan('2026-10-12');

    // A family member adds a dinner after this plan was loaded
    putRecipe({ ...chili, id: 'p1', name: 'Pad thai', createdBy: 'partner' });
    store.docs.set('groups/g/dinners/2026-10-12', {
      date: '2026-10-12',
      meals: { ...dinners('2026-10-12'), theirs: { type: 'reference', recipeId: 'p1', instanceId: 'theirs', position: 1 } },
    });

    await saveDayPlan({ ...loaded, meals: loaded.meals.filter(m => m.instanceId !== mine.instanceId) });
    expect(Object.keys(dinners('2026-10-12'))).toEqual(['theirs']);
  });

  it("doesn't rewrite the group's doc when the family dinners didn't change", async () => {
    await saveDayPlan(plan('2026-10-13', [planMeal(chili, 'dinner', { familyMeal: true })]));
    const loaded = await getDayPlan('2026-10-13');
    store.writes.length = 0;
    await saveDayPlan({ ...loaded, completedMealIds: [loaded.meals[0].instanceId!] });
    expect(store.writes).toEqual(['users/me/days/2026-10-13']);
  });

  it('keeps a family meal in any slot, and a dinner just for the user', async () => {
    const breakfast = planMeal(chili, 'breakfast', { familyMeal: true });
    const dinner = planMeal(chili, 'dinner');
    await saveDayPlan(plan('2026-10-14', [breakfast, dinner]));

    expect(Object.keys(dinners('2026-10-14'))).toEqual([breakfast.instanceId]);
    expect(storedDay('2026-10-14').meals.map(m => m.instanceId)).toEqual([dinner.instanceId]);
    const loaded = await getDayPlan('2026-10-14');
    expect(loaded.meals.map(m => [m.instanceId, m.slot, !!m.familyMeal])).toEqual([
      [dinner.instanceId, 'dinner', false],
      [breakfast.instanceId, 'breakfast', true],
    ]);
  });

  it('moves a meal between the family and the user when it is shared or made just theirs', async () => {
    const dinner = planMeal(chili, 'dinner', { familyMeal: true });
    await saveDayPlan(plan('2026-10-15', [dinner]));
    const loaded = await getDayPlan('2026-10-15');

    await saveDayPlan({ ...loaded, meals: [{ ...loaded.meals[0], familyMeal: false }] });
    expect(dinners('2026-10-15')).toEqual({});
    expect(storedDay('2026-10-15').meals.map(m => m.instanceId)).toEqual([dinner.instanceId]);
  });

  describe('not eating', () => {
    const date = '2026-10-16';
    /** A family dinner and the user's own lunch, loaded */
    const setUp = async () => {
      const lunch = planMeal(chili, 'lunch');
      const dinner = planMeal(chili, 'dinner', { familyMeal: true });
      await saveDayPlan(plan(date, [lunch, dinner], { completedMealIds: [dinner.instanceId!] }));
      return { lunch, dinner, loaded: await getDayPlan(date) };
    };
    /** Runs as the other family member, signed in elsewhere */
    const asPartner = async (fn: () => Promise<void>) => {
      store.docs.set('users/partner', { groupId: 'g' });
      fake.uid = 'partner';
      forgetMyGroupId();
      try { await fn(); } finally { fake.uid = 'me'; forgetMyGroupId(); }
    };
    const goOut = async (loaded: DayPlan, instanceId: string) => {
      const next = setFamilyMealOut(loaded, instanceId, 'me', true);
      await saveFamilyMealOut(next, instanceId, true);
      return next;
    };

    it("leaves the meal for the family and takes it off the user's day", async () => {
      const { lunch, dinner, loaded } = await setUp();
      const next = await goOut(loaded, dinner.instanceId!);

      expect(next.meals.map(m => m.instanceId)).toEqual([lunch.instanceId]);
      expect(next.completedMealIds).toEqual([]);
      expect(dinners(date)[dinner.instanceId!]).toMatchObject({ recipeId: 'r1', notEating: ['me'] });
      expect(storedDay(date).totalCalories).toBe(520);
      expect(storedDay(date)).not.toHaveProperty('familyMealsOut');

      // Read back: out of the meals, into familyMealsOut
      const reloaded = await getDayPlan(date);
      expect(reloaded.meals.map(m => m.instanceId)).toEqual([lunch.instanceId]);
      expect(reloaded.familyMealsOut?.map(m => m.instanceId)).toEqual([dinner.instanceId]);

      // Another member still has it
      await asPartner(async () => {
        const theirs = await getDayPlan(date);
        expect(theirs.meals.map(m => [m.instanceId, m.notEating])).toEqual([[dinner.instanceId, ['me']]]);
        expect(theirs.familyMealsOut).toBeUndefined();
      });
    });

    it("reads the user's own meals and the family's for analytics, without the ones they're out of", async () => {
      const { lunch, dinner, loaded } = await setUp();
      const breakfast = planMeal(chili, 'breakfast', { familyMeal: true });
      await saveDayPlan({ ...loaded, meals: [...loaded.meals, breakfast], completedMealIds: [lunch.instanceId!], type: 'fast' });
      await goOut(await getDayPlan(date), dinner.instanceId!);

      const history = await getPlanHistoryInRange(date, date);
      expect(history.types).toEqual({ [date]: 'fast' });
      expect(history.days[date].meals).toEqual(expect.arrayContaining([
        { key: lunch.instanceId, slot: 'lunch' },
        { key: breakfast.instanceId, slot: 'breakfast' },
      ]));
      expect(history.days[date].meals).toHaveLength(2);
      expect(history.days[date].completed).toEqual([lunch.instanceId]);
    });

    it("isn't removed for the family when the user saves their plan without it", async () => {
      const { lunch, dinner, loaded } = await setUp();
      const next = await goOut(loaded, dinner.instanceId!);
      await saveDayPlan({ ...next, meals: [...next.meals, planMeal(chili, 'snack')], familyMealsOut: undefined });
      expect(Object.keys(dinners(date))).toEqual([dinner.instanceId]);
      expect(storedDay(date).meals.map(m => m.instanceId)).toContain(lunch.instanceId);
    });

    it('keeps both members out when they say so at the same time', async () => {
      const { dinner, loaded } = await setUp();
      // The partner's change lands first, unseen by this session
      await store.api.setDoc({ path: `groups/g/dinners/${date}` }, { meals: { [dinner.instanceId!]: { notEating: store.api.arrayUnion('partner') } } }, { merge: true });
      await goOut(loaded, dinner.instanceId!);
      expect(dinners(date)[dinner.instanceId!].notEating).toEqual(['partner', 'me']);
    });

    it("keeps who's out when someone edits the meal, and lets the user back in", async () => {
      const { dinner, loaded } = await setUp();
      const next = await goOut(loaded, dinner.instanceId!);

      await asPartner(async () => {
        const theirs = await getDayPlan(date);
        await saveDayPlan({ ...theirs, meals: theirs.meals.map(m => ({ ...m, isPacked: true })) });
      });
      // This session loads the plan again, as the live listener would
      await getDayPlan(date);
      expect(dinners(date)[dinner.instanceId!]).toMatchObject({ isPacked: true, notEating: ['me'] });

      const back = setFamilyMealOut(next, dinner.instanceId!, 'me', false);
      await saveFamilyMealOut(back, dinner.instanceId!, false);
      expect(dinners(date)[dinner.instanceId!].notEating).toEqual([]);
      expect(back.meals.map(m => m.instanceId)).toContain(dinner.instanceId);
      expect(back.familyMealsOut).toBeUndefined();
      expect(storedDay(date).totalCalories).toBe(1040);
    });

    it('carries who is out over to a meal swapped in', async () => {
      const { lunch, dinner } = await setUp();
      await store.api.setDoc({ path: `groups/g/dinners/${date}` }, { meals: { [dinner.instanceId!]: { notEating: ['partner'] } } }, { merge: true });
      const fresh = await getDayPlan(date);
      const old = fresh.meals.find(m => m.instanceId === dinner.instanceId)!;
      const swapped = planMeal(chili, 'dinner', { familyMeal: true, notEating: old.notEating });
      await saveDayPlan({ ...fresh, meals: [fresh.meals.find(m => m.instanceId === lunch.instanceId)!, swapped] });
      expect(Object.keys(dinners(date))).toEqual([swapped.instanceId]);
      expect(dinners(date)[swapped.instanceId!].notEating).toEqual(['partner']);
    });
  });
});

describe('live family meals', () => {
  beforeEach(() => {
    setFamily(['me', 'partner']);
    putRecipe({ ...chili, id: 'p1', name: 'Pad thai', createdBy: 'partner' });
  });
  type Update = { dinners: Record<string, Recipe[]>; added: { date: string; name: string; by: string; slot: string }[] };
  const listen = (start: string, end: string) => {
    const updates: Update[] = [];
    const stop = subscribeFamilyMeals(start, end, (dinners, added) => updates.push({ dinners, added }));
    return { updates, stop };
  };
  /** A dinner saved by the partner on another device */
  const partnerPlans = (date: string, instanceId: string, extra: Record<string, unknown> = {}) => {
    const existing = (store.docs.get(`groups/g/dinners/${date}`)?.meals ?? {}) as Record<string, unknown>;
    store.docs.set(`groups/g/dinners/${date}`, {
      date,
      meals: { ...existing, [instanceId]: { type: 'reference', recipeId: 'p1', instanceId, addedBy: 'partner', position: 9, ...extra } },
    });
    store.notify();
  };

  it("starts with the range's dinners and points out none of them", async () => {
    partnerPlans('2026-10-20', 'a');
    const { updates, stop } = listen('2026-10-20', '2026-10-26');
    await vi.waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0].dinners['2026-10-20'].map(m => [m.name, m.familyMeal, m.slot])).toEqual([['Pad thai', true, 'dinner']]);
    expect(updates[0].added).toEqual([]);
    stop();
  });

  it('points out a dinner another member plans while listening', async () => {
    const { updates, stop } = listen('2026-10-20', '2026-10-26');
    await new Promise(r => setTimeout(r, 20)); // listening
    partnerPlans('2026-10-21', 'b');
    await vi.waitFor(() => expect(updates.at(-1)?.added).toEqual([{ date: '2026-10-21', name: 'Pad thai', by: 'partner', slot: 'dinner' }]));
    expect(updates.at(-1)!.dinners['2026-10-21'].map(m => m.instanceId)).toEqual(['b']);
    stop();
  });

  it("updates the cached day plan, and doesn't point out the user's own dinners", async () => {
    const lunch = planMeal(chili, 'lunch');
    await saveDayPlan(plan('2026-10-22', [lunch]));
    const { updates, stop } = listen('2026-10-20', '2026-10-26');
    await saveDayPlan(plan('2026-10-22', [lunch, planMeal(chili, 'dinner', { familyMeal: true, addedBy: 'me' })]));
    partnerPlans('2026-10-22', 'c');
    await vi.waitFor(() => expect(getCachedDayPlan('2026-10-22')?.meals.map(m => m.name)).toEqual(['Chili', 'Chili', 'Pad thai']));
    expect(updates.flatMap(u => u.added).map(a => a.name)).toEqual(['Pad thai']);
    stop();
  });

  it('passes on removed dinners as an empty day, and stops when asked', async () => {
    partnerPlans('2026-10-23', 'd');
    const { updates, stop } = listen('2026-10-20', '2026-10-26');
    await vi.waitFor(() => expect(updates).toHaveLength(1));
    store.docs.delete('groups/g/dinners/2026-10-23');
    store.notify();
    await vi.waitFor(() => expect(updates.at(-1)?.dinners).toEqual({ '2026-10-23': [] }));
    stop();
    partnerPlans('2026-10-24', 'e');
    await new Promise(r => setTimeout(r, 20));
    expect(updates).toHaveLength(2);
  });

  it('does nothing outside its range', async () => {
    const { updates, stop } = listen('2026-10-20', '2026-10-26');
    partnerPlans('2026-11-02', 'f');
    await new Promise(r => setTimeout(r, 20));
    expect(updates).toEqual([]);
    stop();
  });
});

describe('family updates', () => {
  beforeEach(() => { setFamily(['me', 'partner']); });
  const updates = () => [...store.docs.entries()]
    .filter(([path]) => path.startsWith('groups/g/activity/'))
    .map(([, data]) => data as { id: string; type: string; name?: string; date?: string; by: string });

  it('tells the family about a family meal the user plans, and forgets it when removed', async () => {
    const dinner = planMeal(chili, 'dinner', { familyMeal: true, addedBy: 'me' });
    await saveDayPlan(plan('2026-10-20', [dinner]));
    await vi.waitFor(() => expect(updates()).toMatchObject([{ type: 'planned', name: 'Chili', date: '2026-10-20', by: 'me' }]));

    const loaded = await getDayPlan('2026-10-20');
    await saveDayPlan({ ...loaded, meals: [] });
    await vi.waitFor(() => expect(updates()).toEqual([]));
  });

  it("keeps the update when a meal moves to another day, and doesn't announce others' meals or own ones", async () => {
    const dinner = planMeal(chili, 'dinner', { familyMeal: true, addedBy: 'me' });
    await saveDayPlan(plan('2026-10-21', [dinner, planMeal(chili, 'dinner', { familyMeal: true, addedBy: 'partner' }), planMeal(chili, 'lunch')]));
    await vi.waitFor(() => expect(updates()).toHaveLength(1));

    const loaded = await getDayPlan('2026-10-21');
    await saveDayPlan({ ...loaded, meals: loaded.meals.filter(m => m.instanceId !== dinner.instanceId) });
    await saveDayPlan(plan('2026-10-22', [dinner]));
    await new Promise(r => setTimeout(r, 20));
    expect(updates()).toMatchObject([{ type: 'planned', date: '2026-10-22' }]);
  });

  it('says when the user is out of a family meal, and takes it back when they are in again', async () => {
    const dinner = planMeal(chili, 'dinner', { familyMeal: true, addedBy: 'partner' });
    await saveDayPlan(plan('2026-10-23', [dinner]));
    const loaded = await getDayPlan('2026-10-23');
    const out = setFamilyMealOut(loaded, dinner.instanceId!, 'me', true);
    await saveFamilyMealOut(out, dinner.instanceId!, true);
    await vi.waitFor(() => expect(updates()).toMatchObject([{ type: 'notEating', name: 'Chili', by: 'me' }]));

    await saveFamilyMealOut(setFamilyMealOut(out, dinner.instanceId!, 'me', false), dinner.instanceId!, false);
    await vi.waitFor(() => expect(updates()).toEqual([]));
  });

  it('keeps nothing for a family of one', async () => {
    setFamily(['me']);
    forgetMyGroupId();
    await recordFamilyUpdate({ type: 'recipe', name: 'Chili', recipeId: 'r1' }, 'r1');
    expect(updates()).toEqual([]);
  });

  it("groups a member's updates of one kind close together, newest first", () => {
    const u = (id: string, by: string, type: 'recipe' | 'planned', minutesAgo: number) =>
      ({ id, by, at: 1_000_000_000 - minutesAgo * 60_000, type, name: id, recipeId: id, date: '2026-10-20', slot: 'dinner' as const });
    const groups = groupFamilyUpdates([
      u('a', 'partner', 'planned', 0), u('b', 'partner', 'planned', 30), u('c', 'partner', 'planned', 80),
      u('d', 'partner', 'recipe', 90), u('e', 'me', 'recipe', 95), u('f', 'partner', 'planned', 300),
    ]);
    expect(groups.map(g => g.updates.map(x => x.id))).toEqual([['a', 'b', 'c'], ['d'], ['e'], ['f']]);
  });
});

describe('read ingredient lines', () => {
  it('keeps them on the recipe: earlier readings stay, new plain lines are read on save', async () => {
    const salt = { text: 'Salt to taste', name: 'salt', quantity: 1, unit: 'pinch' };
    await saveRecipe({ ...chili, ingredients: ['500 g beef', 'Salt to taste'], parsedIngredients: [salt] });
    expect((store.docs.get('groups/g/recipes/r1') as unknown as Recipe).parsedIngredients).toEqual([
      { text: '500 g beef', name: 'beef', quantity: 500, unit: 'g' },
      salt,
    ]);
  });

  it('reach planned meals, and lines read later are kept for the family', async () => {
    const beans = { text: '2 cans beans', name: 'beans', quantity: 2, unit: 'can' };
    await saveParsedIngredients('r1', [beans]);
    await saveDayPlan(plan('2026-10-03', [planMeal(chili, 'dinner')]));
    const loaded = await getDayPlan('2026-10-03');
    expect(loaded.meals[0].parsedIngredients).toEqual([beans]);
  });
});

describe('nutrition compatibility', () => {
  it('retains explicit reference overrides through read and save', async () => {
    store.docs.set('users/me/days/2026-10-25', {date:'2026-10-25',completedMealIds:[],meals:[{type:'reference',recipeId:'r1',servings:1,instanceId:'x',overrides:{calories:0,name:'Tea'}}]});
    const day = await getDayPlan('2026-10-25');
    expect(day.meals[0]).toMatchObject({calories:0,calorieStatus:'known',planOverrides:{calories:0,name:'Tea'}});
    await saveDayPlan(day);
    expect(storedDay(day.date).meals[0]).toMatchObject({overrides:{calories:0,name:'Tea'}});
  });
  it('round trips missing and confirmed-zero custom nutrition without fabricated macros', async () => {
    await saveDayPlan(plan('2026-10-26', [quickMeal({id:'unknown',calories:400,calorieStatus:'unknown'}),quickMeal({id:'zero',calories:0,calorieStatus:'known'})]));
    const raw = storedDay('2026-10-26');
    expect(raw.meals[0]).not.toHaveProperty('calories');
    expect(raw.meals[1]).toMatchObject({calories:0,calorieStatus:'known'});
    const loaded = await getDayPlan('2026-10-26');
    expect(loaded).toMatchObject({totalCalories:0,totalCaloriesComplete:false});
    expect(loaded.meals[0].protein).toBeUndefined();
  });
  it('normalizes nested legacy full recipes without rewriting them', async () => {
    store.docs.set('users/me/days/2026-10-27', {date:'2026-10-27',completedMealIds:[],totalCalories:999,meals:[{...chili,sides:[{...chili,id:'bad',calories:null}]}]});
    const loaded = await getDayPlan('2026-10-27');
    expect(loaded).toMatchObject({totalCalories:520,totalCaloriesComplete:false});
    expect(loaded.meals[0].sides[0].calorieStatus).toBe('unknown');
    expect(store.writes).toEqual([]);
  });
});

describe('weekly check-ins', () => {
  const checkIn = (date: string, target: number) => ({
    date, status: 'changed' as const, previousTarget: 2100, target, expenditure: 2300, margin: 300, burnUsed: 2300,
    suggested: 1750, weeklyLoss: 0.5, weightChangePerWeek: -0.4, loggedDays: 20, weighIns: 20, createdAt: 1,
  });

  it('saves one per Sunday and keeps the first when another device got there', async () => {
    expect(await saveCheckInIfNew(checkIn('2026-10-25', 1950))).toMatchObject({ created: true });
    const second = await saveCheckInIfNew(checkIn('2026-10-25', 1800));
    expect(second).toMatchObject({ created: false, checkIn: { target: 1950 } });
    expect(store.docs.get('users/me/checkins/2026-10-25')).toMatchObject({ target: 1950 });
  });

  it('reads them oldest first', async () => {
    await saveCheckInIfNew(checkIn('2026-11-01', 1800));
    await saveCheckInIfNew(checkIn('2026-10-25', 1950));
    expect((await getCheckIns()).map(c => c.date)).toEqual(['2026-10-25', '2026-11-01']);
  });
});

describe('breaks on stats', () => {
  it('reads breaks along with stats and never saves them back with stats', async () => {
    store.docs.set('users/me/data/stats', { name: 'Alex', weightHistory: [] });
    store.docs.set('users/me/data/breaks', { list: [{ start: '2026-10-20' }] });
    const stats = await getUserStats();
    expect(stats.breaks).toEqual([{ start: '2026-10-20' }]);
    await saveUserStats({ ...stats, breaks: [] });
    expect(store.docs.get('users/me/data/stats')).not.toHaveProperty('breaks');
    expect(store.docs.get('users/me/data/breaks')).toEqual({ list: [{ start: '2026-10-20' }] });
  });
});
