import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DayPlan, PlannedMeal, Recipe } from '../types';
import { decideEatingOut, eatingOutBudgetMeal, eatingOutDishMeal, planMeal, withLiveBudgets, QUICK_MEAL_DESCRIPTION } from '../utils/planUtils';

const fake = vi.hoisted(() => ({ uid: 'me' }));

vi.mock('firebase/firestore', async () => (await import('../test/fakeFirestore')).fakeFirestore.api);
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: null }, currentUid: () => fake.uid }));

const { fakeFirestore: store } = await import('../test/fakeFirestore');
const { forgetMyGroupId } = await import('./groupService');
const { getDayPlan, saveDayPlan } = await import('./storageService');

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
    await saveDayPlan(plan('2026-10-01', [planMeal(chili, 'dinner', { cookingServings: 2, isPacked: true })]));
    const [stored] = storedDay('2026-10-01').meals;
    expect(stored).toMatchObject({ type: 'reference', recipeId: 'r1', slot: 'dinner', cookingServings: 2, isPacked: true });
    expect(stored).not.toHaveProperty('ingredients');
    expect(stored).not.toHaveProperty('name');
  });

  it('loads a planned recipe back with its library details and plan settings', async () => {
    const meal = planMeal(chili, 'dinner', { cookingServings: 2, isLeftover: true });
    await saveDayPlan(plan('2026-10-02', [meal], { completedMealIds: [meal.instanceId!], type: 'fast' }));
    const loaded = await getDayPlan('2026-10-02');
    expect(loaded).toMatchObject({ date: '2026-10-02', type: 'fast', completedMealIds: [meal.instanceId] });
    expect(loaded.meals[0]).toMatchObject({
      name: 'Chili', calories: 520, ingredients: chili.ingredients, slot: 'dinner',
      instanceId: meal.instanceId, cookingServings: 2, isLeftover: true,
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
    expect(await getDayPlan('2026-10-10')).toEqual({ date: '2026-10-10', meals: [], completedMealIds: [] });
  });
});

describe('family dinners', () => {
  beforeEach(() => { setFamily(['me', 'partner']); });
  const dinners = (date: string) => (store.docs.get(`groups/g/dinners/${date}`)?.meals ?? {}) as Record<string, PlannedMeal & { position: number }>;

  it("splits family dinners into the group's doc and merges them back", async () => {
    const lunch = planMeal(chili, 'lunch');
    const dinner = planMeal(chili, 'dinner', { familyDinner: true, cookingServings: 4 });
    await saveDayPlan(plan('2026-10-11', [lunch, dinner]));

    expect(storedDay('2026-10-11').meals.map(m => m.instanceId)).toEqual([lunch.instanceId]);
    expect(dinners('2026-10-11')[dinner.instanceId!]).toMatchObject({ type: 'reference', recipeId: 'r1', cookingServings: 4, position: 0 });

    const loaded = await getDayPlan('2026-10-11');
    expect(loaded.meals.map(m => [m.instanceId, m.slot, !!m.familyDinner])).toEqual([
      [lunch.instanceId, 'lunch', false],
      [dinner.instanceId, 'dinner', true],
    ]);
  });

  it('only removes dinners this session has seen, never ones added since by someone else', async () => {
    const mine = planMeal(chili, 'dinner', { familyDinner: true });
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
    await saveDayPlan(plan('2026-10-13', [planMeal(chili, 'dinner', { familyDinner: true })]));
    const loaded = await getDayPlan('2026-10-13');
    store.writes.length = 0;
    await saveDayPlan({ ...loaded, completedMealIds: [loaded.meals[0].instanceId!] });
    expect(store.writes).toEqual(['users/me/days/2026-10-13']);
  });
});
