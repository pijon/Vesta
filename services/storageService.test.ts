import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DayPlan, PlannedMeal, Recipe } from '../types';
import { decideEatingOut, eatingOutBudgetMeal, planMeal, withLiveBudgets, QUICK_MEAL_DESCRIPTION } from '../utils/planUtils';

// An in-memory stand-in for the parts of Firestore that day plans use. Documents are stored
// as JSON, which drops undefined fields like the app's ignoreUndefinedProperties setting.
type Data = Record<string, unknown>;
const fake = vi.hoisted(() => {
  const docs = new Map<string, Data>();
  const writes: string[] = [];
  const DELETE = { deleteField: true };
  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const isObject = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v);
  const merge = (target: Data, patch: Data) => {
    Object.entries(patch).forEach(([key, value]) => {
      if (value === DELETE) delete target[key];
      else if (isObject(value) && isObject(target[key])) merge(target[key] as Data, value);
      else if (value !== undefined) target[key] = clone(value);
    });
  };
  const snapshot = (path: string) => ({
    id: path.split('/').pop(),
    exists: () => docs.has(path),
    data: () => (docs.has(path) ? clone(docs.get(path)) : undefined),
  });
  type Where = { field: string; op: string; value: string };
  const passes = (data: Data, w: Where) => {
    const v = data[w.field] as string;
    return w.op === '>=' ? v >= w.value : w.op === '<=' ? v <= w.value : w.op === '==' ? v === w.value : true;
  };
  const api = {
    doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
    collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
    query: (col: { path: string }, ...constraints: (Where | null)[]) => ({ path: col.path, constraints: constraints.filter(Boolean) as Where[] }),
    where: (field: string, op: string, value: string) => ({ field, op, value }),
    orderBy: () => null,
    limit: () => null,
    deleteField: () => DELETE,
    getDoc: async (ref: { path: string }) => snapshot(ref.path),
    getDocs: async (q: { path: string; constraints?: Where[] }) => ({
      docs: [...docs.keys()]
        .filter(p => p.slice(0, p.lastIndexOf('/')) === q.path)
        .filter(p => (q.constraints || []).every(w => passes(docs.get(p)!, w)))
        .map(snapshot),
    }),
    setDoc: async (ref: { path: string }, data: Data, options?: { merge?: boolean }) => {
      writes.push(ref.path);
      if (options?.merge) {
        const existing = docs.get(ref.path) ?? {};
        merge(existing, data);
        docs.set(ref.path, existing);
      } else {
        docs.set(ref.path, clone(data));
      }
    },
    deleteDoc: async (ref: { path: string }) => { docs.delete(ref.path); },
  };
  return { docs, writes, api, state: { groupId: null as string | null } };
});

vi.mock('firebase/firestore', () => fake.api);
vi.mock('./firebase', () => ({ db: {}, currentUid: () => 'me' }));
vi.mock('./groupService', () => ({
  getMyGroupId: async () => fake.state.groupId,
  getUserGroup: async () => null,
  getGroupMembersDetails: async () => [],
}));

const { getDayPlan, saveDayPlan } = await import('./storageService');

const chili: Recipe = {
  id: 'r1', name: 'Chili', calories: 520, protein: 35, servings: 4,
  ingredients: ['500 g beef', '2 cans beans'], instructions: ['Cook'], tags: ['main meal'],
};
const putRecipe = (owner: string, recipe: Recipe) => fake.docs.set(`users/${owner}/recipes/${recipe.id}`, JSON.parse(JSON.stringify(recipe)));
const storedDay = (date: string) => fake.docs.get(`users/me/days/${date}`) as { meals: PlannedMeal[]; totalCalories: number };
const plan = (date: string, meals: Recipe[], extra: Partial<DayPlan> = {}): DayPlan => ({ date, meals, completedMealIds: [], ...extra });
const quickMeal = (fields: Partial<Recipe>): Recipe => ({
  id: crypto.randomUUID(), name: 'Pizza out', calories: 900, ingredients: [], tags: [], servings: 1,
  description: QUICK_MEAL_DESCRIPTION, quick: { kind: 'out' }, ...fields,
});

beforeEach(() => {
  fake.docs.clear();
  fake.writes.length = 0;
  fake.state.groupId = null;
  putRecipe('me', chili);
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
    putRecipe('me', { ...chili, calories: 480 });
    expect((await getDayPlan('2026-10-03')).meals[0].calories).toBe(480);
  });

  it('keeps a planned meal whose recipe was deleted, marked missing', async () => {
    await saveDayPlan(plan('2026-10-04', [planMeal(chili, 'lunch')]));
    fake.docs.delete('users/me/recipes/r1');
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

  it("reads a family member's recipe from their library", async () => {
    putRecipe('partner', { ...chili, id: 'p1', name: 'Pad thai' });
    await saveDayPlan(plan('2026-10-07', [planMeal({ ...chili, id: 'p1', ownerId: 'partner' }, 'dinner'), planMeal({ ...chili, ownerId: 'me' }, 'lunch')]));
    expect(storedDay('2026-10-07').meals.map(m => m.type === 'reference' && m.ownerId)).toEqual(['partner', undefined]);
    expect((await getDayPlan('2026-10-07')).meals.map(m => m.name)).toEqual(['Pad thai', 'Chili']);
  });

  it('gives meals without an instance id one, so they can be ticked off', async () => {
    await saveDayPlan(plan('2026-10-08', [{ ...chili, slot: 'dinner' }]));
    expect(storedDay('2026-10-08').meals[0].instanceId).toBeTruthy();
  });

  it('still reads legacy day docs that hold full recipes', async () => {
    fake.docs.set('users/me/days/2026-10-09', { date: '2026-10-09', meals: [chili], completedMealIds: ['r1'] });
    expect((await getDayPlan('2026-10-09')).meals[0]).toMatchObject({ name: 'Chili', ingredients: chili.ingredients });
  });

  it('gives an empty plan for a day with nothing saved', async () => {
    expect(await getDayPlan('2026-10-10')).toEqual({ date: '2026-10-10', meals: [], completedMealIds: [] });
  });
});

describe('family dinners', () => {
  beforeEach(() => { fake.state.groupId = 'g'; });
  const dinners = (date: string) => (fake.docs.get(`groups/g/dinners/${date}`)?.meals ?? {}) as Record<string, PlannedMeal & { position: number }>;

  it("splits family dinners into the group's doc and merges them back", async () => {
    const lunch = planMeal(chili, 'lunch');
    const dinner = planMeal(chili, 'dinner', { familyDinner: true, cookingServings: 4 });
    await saveDayPlan(plan('2026-10-11', [lunch, dinner]));

    expect(storedDay('2026-10-11').meals.map(m => m.instanceId)).toEqual([lunch.instanceId]);
    expect(dinners('2026-10-11')[dinner.instanceId!]).toMatchObject({ type: 'reference', recipeId: 'r1', ownerId: 'me', cookingServings: 4, position: 0 });

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
    putRecipe('partner', { ...chili, id: 'p1', name: 'Pad thai' });
    fake.docs.set('groups/g/dinners/2026-10-12', {
      date: '2026-10-12',
      meals: { ...dinners('2026-10-12'), theirs: { type: 'reference', recipeId: 'p1', ownerId: 'partner', instanceId: 'theirs', position: 1 } },
    });

    await saveDayPlan({ ...loaded, meals: loaded.meals.filter(m => m.instanceId !== mine.instanceId) });
    expect(Object.keys(dinners('2026-10-12'))).toEqual(['theirs']);
  });

  it("doesn't rewrite the group's doc when the family dinners didn't change", async () => {
    await saveDayPlan(plan('2026-10-13', [planMeal(chili, 'dinner', { familyDinner: true })]));
    const loaded = await getDayPlan('2026-10-13');
    fake.writes.length = 0;
    await saveDayPlan({ ...loaded, completedMealIds: [loaded.meals[0].instanceId!] });
    expect(fake.writes).toEqual(['users/me/days/2026-10-13']);
  });
});
