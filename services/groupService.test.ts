import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Recipe } from '../types';

const fake = vi.hoisted(() => ({ uid: 'me' }));

vi.mock('firebase/firestore', async () => (await import('../test/fakeFirestore')).fakeFirestore.api);
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: { displayName: 'Jon Lilja' } }, currentUid: () => fake.uid }));

const { fakeFirestore: store } = await import('../test/fakeFirestore');
const { forgetMyGroupId, getMyGroupId, joinGroup, leaveGroup } = await import('./groupService');
const { getRecipes, saveRecipe, setRecipeFavorite } = await import('./storageService');

const recipe = (id: string, fields: Partial<Recipe> = {}): Recipe => ({
  id, name: id, calories: 400, ingredients: [], tags: [], servings: 2, ...fields,
});
const group = (id: string, memberIds: string[], fields: Partial<Group> = {}): Group => ({
  id, name: id, ownerId: memberIds[0], createdAt: 0, inviteCode: `CODE${id}`.toUpperCase(), memberIds, legacyRecipesMoved: memberIds, ...fields,
});
const put = (path: string, data: object) => store.docs.set(path, JSON.parse(JSON.stringify(data)));
const putGroup = (g: Group) => {
  put(`groups/${g.id}`, g);
  put(`groupInvites/${g.inviteCode}`, { groupId: g.id });
  g.memberIds.forEach(uid => put(`users/${uid}`, { groupId: g.id }));
};
const recipesIn = (groupId: string) => [...store.docs.entries()]
  .filter(([path]) => path.startsWith(`groups/${groupId}/recipes/`))
  .map(([, data]) => data as unknown as Recipe)
  .sort((a, b) => a.id.localeCompare(b.id));
const signIn = (uid: string) => { fake.uid = uid; forgetMyGroupId(); };

beforeEach(() => {
  store.reset();
  signIn('me');
});

describe('every user has a family', () => {
  it('creates a family of one, named after the user, on first use', async () => {
    const groupId = await getMyGroupId();
    expect(groupId).toBeTruthy();
    expect(store.docs.get('users/me')).toEqual({ groupId });
    expect(store.docs.get(`groups/${groupId}`)).toMatchObject({ name: "Jon's family", ownerId: 'me', memberIds: ['me'] });
  });

  it('creates a new family when the profile points at one the user is no longer in', async () => {
    putGroup(group('old', ['partner']));
    put('users/me', { groupId: 'old' });
    const groupId = await getMyGroupId();
    expect(groupId).not.toBe('old');
    expect(store.docs.get(`groups/${groupId}`)).toMatchObject({ memberIds: ['me'] });
  });

  it('moves old users/{uid}/recipes into the family once, with who added and favourited them', async () => {
    put('users/me/recipes/r1', recipe('r1', { isFavorite: true }));
    put('users/me/recipes/r2', recipe('r2'));
    const groupId = (await getMyGroupId())!;

    expect(recipesIn(groupId)).toEqual([
      { ...recipe('r1'), createdBy: 'me', favoritedBy: ['me'] },
      { ...recipe('r2'), createdBy: 'me', favoritedBy: [] },
    ]);
    expect(store.docs.get(`groups/${groupId}`)).toMatchObject({ legacyRecipesMoved: ['me'] });

    // A recipe deleted from the family doesn't come back from the old copy
    store.docs.delete(`groups/${groupId}/recipes/r2`);
    signIn('me');
    await getMyGroupId();
    expect(recipesIn(groupId).map(r => r.id)).toEqual(['r1']);
  });

  it("moves every member's old recipes into an existing family, keeping recipes it already has", async () => {
    putGroup(group('g', ['me', 'partner'], { legacyRecipesMoved: [] }));
    put('groups/g/recipes/shared', recipe('shared', { name: 'Edited in the family', createdBy: 'me' }));
    put('users/me/recipes/shared', recipe('shared'));
    put('users/partner/recipes/p1', recipe('p1', { isFavorite: true }));

    expect(await getMyGroupId()).toBe('g');
    expect(recipesIn('g')).toEqual([
      { ...recipe('p1'), createdBy: 'partner', favoritedBy: ['partner'] },
      recipe('shared', { name: 'Edited in the family', createdBy: 'me' }),
    ]);
    expect(store.docs.get('groups/g')).toMatchObject({ legacyRecipesMoved: ['me', 'partner'] });
  });
});

describe('joining a family', () => {
  beforeEach(() => {
    putGroup(group('solo', ['me']));
    put('groups/solo/recipes/mine', recipe('mine', { createdBy: 'me', favoritedBy: ['me'] }));
    put('groups/solo/recipes/both', recipe('both', { name: 'My copy', createdBy: 'me' }));
    put('groups/solo/dinners/2026-10-20', { date: '2026-10-20', meals: {} });
    putGroup(group('fam', ['partner']));
    put('groups/fam/recipes/both', recipe('both', { name: 'Their copy', createdBy: 'partner' }));
  });

  it('brings the recipes along and removes the old family of one', async () => {
    await joinGroup('codefam');

    expect(store.docs.get('users/me')).toEqual({ groupId: 'fam' });
    expect(store.docs.get('groups/fam')).toMatchObject({ memberIds: ['partner', 'me'], legacyRecipesMoved: ['partner', 'me'] });
    expect(recipesIn('fam')).toEqual([
      recipe('both', { name: 'Their copy', createdBy: 'partner' }),
      recipe('mine', { createdBy: 'me', favoritedBy: ['me'] }),
    ]);
    expect([...store.docs.keys()].filter(path => path.startsWith('groups/solo'))).toEqual([]);
    expect(await getMyGroupId()).toBe('fam');
  });

  it("can't join from a family with other members, or the family the user is in", async () => {
    await joinGroup('codefam');
    putGroup(group('other', ['stranger']));
    await expect(joinGroup('codeother')).rejects.toThrow('Leave your current family');
    await expect(joinGroup('codefam')).rejects.toThrow('already in this family');
  });
});

describe('leaving a family', () => {
  beforeEach(() => {
    putGroup(group('fam', ['partner', 'me']));
    put('groups/fam/recipes/mine', recipe('mine', { createdBy: 'me', favoritedBy: ['me', 'partner'] }));
    put('groups/fam/recipes/theirs', recipe('theirs', { createdBy: 'partner', favoritedBy: ['me'] }));
  });

  it('keeps every recipe in the family and starts a new one with copies of the ones the user added', async () => {
    await leaveGroup('fam');

    expect(store.docs.get('groups/fam')).toMatchObject({ memberIds: ['partner'] });
    expect(recipesIn('fam').map(r => r.id)).toEqual(['mine', 'theirs']);

    const groupId = (await getMyGroupId())!;
    expect(groupId).not.toBe('fam');
    expect(store.docs.get(`groups/${groupId}`)).toMatchObject({ memberIds: ['me'], legacyRecipesMoved: ['me'] });
    expect(recipesIn(groupId)).toEqual([recipe('mine', { createdBy: 'me', favoritedBy: ['me'] })]);
  });

  it("can't leave a family of one", async () => {
    putGroup(group('solo', ['me']));
    await expect(leaveGroup('solo')).rejects.toThrow('only one');
  });
});

describe('family recipes', () => {
  beforeEach(() => {
    putGroup(group('fam', ['me', 'partner']));
    put('groups/fam/recipes/r1', recipe('r1', { createdBy: 'partner', favoritedBy: ['partner'] }));
  });

  it('keeps favourites per member', async () => {
    expect((await getRecipes())[0].isFavorite).toBe(false);
    await setRecipeFavorite('r1', true);
    expect((await getRecipes())[0]).toMatchObject({ isFavorite: true, favoritedBy: ['partner', 'me'] });

    signIn('partner');
    await setRecipeFavorite('r1', false);
    expect((await getRecipes())[0]).toMatchObject({ isFavorite: false, favoritedBy: ['me'] });
  });

  it("lets any member edit a recipe, keeping who added it and without storing per-viewer fields", async () => {
    const [loaded] = await getRecipes();
    await saveRecipe({ ...loaded, name: 'Renamed', ownerName: 'Partner' });
    expect(store.docs.get('groups/fam/recipes/r1')).toEqual(recipe('r1', { name: 'Renamed', createdBy: 'partner', favoritedBy: ['partner'] }));
  });
});
