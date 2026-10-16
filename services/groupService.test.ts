import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Recipe } from '../types';

const fake = vi.hoisted(() => ({ uid: 'me' }));

vi.mock('firebase/firestore', async () => (await import('../test/fakeFirestore')).fakeFirestore.api);
vi.mock('./firebase', () => ({ db: {}, auth: { currentUser: { displayName: 'Jon Lilja' } }, currentUid: () => fake.uid }));

const { fakeFirestore: store } = await import('../test/fakeFirestore');
const { familyAdmin, forgetMyGroupId, getGroupMembersDetails, getMyGroupId, joinGroup, leaveGroup, newInviteCode, removeMember, renameGroup } = await import('./groupService');
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

  it("also copies recipes others added that the user's own plans use, sides included", async () => {
    put('groups/fam/recipes/planned', recipe('planned', { createdBy: 'partner' }));
    put('groups/fam/recipes/side', recipe('side', { createdBy: 'partner' }));
    put('groups/fam/recipes/unused', recipe('unused', { createdBy: 'partner' }));
    put('users/me/days/2026-10-20', {
      date: '2026-10-20',
      meals: [{ type: 'reference', recipeId: 'planned', slot: 'lunch', sides: [{ type: 'reference', recipeId: 'side' }] }],
    });

    await leaveGroup('fam');

    const groupId = (await getMyGroupId())!;
    expect(recipesIn(groupId).map(r => r.id)).toEqual(['mine', 'planned', 'side']);
    expect(recipesIn(groupId).find(r => r.id === 'planned')).toMatchObject({ createdBy: 'partner', favoritedBy: [] });
    expect(recipesIn('fam').map(r => r.id)).toEqual(['mine', 'planned', 'side', 'theirs', 'unused']);
  });

  it('hands the family to the longest-standing member when its admin leaves', async () => {
    putGroup(group('big', ['me', 'partner', 'kid']));
    await leaveGroup('big');
    expect(store.docs.get('groups/big')).toMatchObject({ memberIds: ['partner', 'kid'], ownerId: 'partner' });
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

describe('renaming a family', () => {
  it('saves the trimmed name and rejects an empty one', async () => {
    putGroup(group('fam', ['me']));
    expect(await renameGroup('fam', '  The Liljas  ')).toBe('The Liljas');
    expect(store.docs.get('groups/fam')).toMatchObject({ name: 'The Liljas' });
    await expect(renameGroup('fam', '   ')).rejects.toThrow('Give your family a name');
    expect(store.docs.get('groups/fam')).toMatchObject({ name: 'The Liljas' });
  });
});

describe('removing a member', () => {
  beforeEach(() => {
    putGroup(group('fam', ['me', 'partner', 'kid']));
    put('groups/fam/recipes/theirs', recipe('theirs', { createdBy: 'partner' }));
  });

  it('removes them, keeps their recipes in the family and replaces the invite code', async () => {
    const updated = await removeMember(group('fam', ['me', 'partner', 'kid']), 'partner');

    expect(store.docs.get('groups/fam')).toMatchObject({ memberIds: ['me', 'kid'], inviteCode: updated.inviteCode });
    expect(updated.memberIds).toEqual(['me', 'kid']);
    expect(updated.inviteCode).not.toBe('CODEFAM');
    expect(store.docs.has('groupInvites/CODEFAM')).toBe(false);
    expect(store.docs.get(`groupInvites/${updated.inviteCode}`)).toEqual({ groupId: 'fam' });
    expect(recipesIn('fam').map(r => r.id)).toEqual(['theirs']);
  });

  it('gives the removed member a family of their own next time, with the recipes they added or planned', async () => {
    put('groups/fam/recipes/mine', recipe('mine', { createdBy: 'me', favoritedBy: ['me', 'partner'] }));
    put('groups/fam/recipes/kids', recipe('kids', { createdBy: 'kid' }));
    put('users/partner/days/2026-10-20', { date: '2026-10-20', meals: [{ type: 'reference', recipeId: 'mine', slot: 'lunch' }] });

    await removeMember(group('fam', ['me', 'partner', 'kid']), 'partner');
    expect(recipesIn('fam').map(r => r.id)).toEqual(['kids', 'mine', 'theirs']);

    signIn('partner');
    const groupId = await getMyGroupId();
    expect(groupId).not.toBe('fam');
    expect(store.docs.get(`groups/${groupId}`)).toMatchObject({ memberIds: ['partner'] });
    expect(recipesIn(groupId!)).toEqual([
      recipe('mine', { createdBy: 'me', favoritedBy: ['partner'] }),
      recipe('theirs', { createdBy: 'partner', favoritedBy: [] }),
    ]);
    // Collected once: nothing is left waiting in the old family
    expect([...store.docs.keys()].filter(path => path.startsWith('groups/fam/departures/'))).toEqual([]);
  });

  it('is for the admin only, and not for removing yourself', async () => {
    signIn('partner');
    await expect(removeMember(group('fam', ['me', 'partner', 'kid']), 'kid')).rejects.toThrow('Only the family admin');
    signIn('me');
    await expect(removeMember(group('fam', ['me', 'partner', 'kid']), 'me')).rejects.toThrow('Leave family');
  });

  it('treats the longest-standing member as admin when the owner has left', () => {
    expect(familyAdmin(group('fam', ['partner', 'kid'], { ownerId: 'gone' }))).toBe('partner');
    expect(familyAdmin(group('fam', ['partner', 'kid'], { ownerId: 'kid' }))).toBe('kid');
  });
});

describe('a new invite code', () => {
  it('replaces the old one, which stops working', async () => {
    putGroup(group('fam', ['me', 'partner']));
    const updated = await newInviteCode(group('fam', ['me', 'partner']));
    expect(store.docs.has('groupInvites/CODEFAM')).toBe(false);
    expect(store.docs.get('groups/fam')).toMatchObject({ inviteCode: updated.inviteCode });
    signIn('stranger');
    putGroup(group('solo', ['stranger']));
    await expect(joinGroup('codefam')).rejects.toThrow('Invalid invite code');
  });
});

describe('avatars', () => {
  it("reads members' names and avatars from their public profiles", async () => {
    put('users/me/profile/public', { name: 'Jon', avatar: { seed: 'ab12cd34', tint: 'water' } });
    put('users/partner/profile/public', { name: 'Anna' });
    expect(await getGroupMembersDetails(['me', 'partner', 'kid'])).toEqual([
      { id: 'me', name: 'Jon', avatar: { seed: 'ab12cd34', tint: 'water' } },
      { id: 'partner', name: 'Anna' },
      { id: 'kid', name: 'Family member' },
    ]);
  });
});
