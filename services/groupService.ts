import { auth, db, currentUid } from "./firebase";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    updateDoc,
    arrayUnion,
    arrayRemove,
    deleteDoc,
    query,
    where,
    writeBatch,
    DocumentReference
} from "firebase/firestore";
import { Group, Recipe } from "../types";
import { MAX_FAMILY_GROUP_SIZE } from "../constants";

// --- Collection Refs ---
const getGroupRef = (groupId: string) => doc(db, "groups", groupId);
const getUserRef = (uid: string) => doc(db, "users", uid);
const getInviteRef = (code: string) => doc(db, "groupInvites", code);
export const familyRecipesRef = (groupId: string) => collection(db, "groups", groupId, "recipes");
const familyRecipeRef = (groupId: string, recipeId: string) => doc(db, "groups", groupId, "recipes", recipeId);

// --- Helpers ---
// No 0/O or 1/I/L, so codes are easy to read aloud and type.
const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 8;

const generateInviteCode = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
    // 256 % 31 bias is negligible for an invite code.
    return Array.from(bytes, b => INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length]).join("");
};

const normalizeInviteCode = (code: string) => code.trim().toUpperCase().replace(/[\s-]/g, "");

const isCurrentInviteFormat = (code: string) =>
    code.length === INVITE_CODE_LENGTH && [...code].every(c => INVITE_CODE_ALPHABET.includes(c));

const getCurrentUser = () => {
    const uid = currentUid();
    if (!uid) throw new Error("User not authenticated");
    return { uid };
};

// --- Family recipes ---
// Every recipe belongs to the user's family: groups/{groupId}/recipes/{id}. Any member can
// edit or delete one; createdBy says who added it and favoritedBy who favourited it.

/** A recipe as stored in the family: no per-viewer or plan-owner fields. */
export const toStoredRecipe = (recipe: Recipe, uid: string): Recipe => {
    const { isFavorite, ownerId: _ownerId, ownerName: _ownerName, isShared: _isShared, sharedBy: _sharedBy, sharedAt: _sharedAt, ...rest } = recipe;
    const favoritedBy = recipe.favoritedBy ?? (isFavorite ? [uid] : []);
    return { ...rest, createdBy: recipe.createdBy ?? uid, favoritedBy };
};

// Firestore batches hold at most 500 writes.
const BATCH_SIZE = 400;

const commitInBatches = async <T,>(items: T[], add: (batch: ReturnType<typeof writeBatch>, item: T) => void) => {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        items.slice(i, i + BATCH_SIZE).forEach(item => add(batch, item));
        await batch.commit();
    }
};

const writeFamilyRecipes = (groupId: string, recipes: Recipe[]) =>
    commitInBatches(recipes, (batch, recipe) => batch.set(familyRecipeRef(groupId, recipe.id), recipe));

const deleteDocs = (refs: DocumentReference[]) =>
    commitInBatches(refs, (batch, ref) => batch.delete(ref));

const readFamilyRecipes = async (groupId: string): Promise<Recipe[]> =>
    (await getDocs(familyRecipesRef(groupId))).docs.map(d => ({ ...d.data() as Recipe, id: d.id }));

/**
 * Copies the recipes members kept under users/{uid}/recipes, from before recipes belonged to
 * the family, into the family. Runs once per member (tracked in legacyRecipesMoved); any member
 * can do it, since family members can read each other's old recipes. The originals are kept.
 */
const moveLegacyRecipes = async (group: Group) => {
    const pending = group.memberIds.filter(id => !group.legacyRecipesMoved?.includes(id));
    if (pending.length === 0) return;

    const existing = new Set((await getDocs(familyRecipesRef(group.id))).docs.map(d => d.id));
    const moved: string[] = [];
    const recipes: Recipe[] = [];
    await Promise.all(pending.map(async memberId => {
        try {
            const snapshot = await getDocs(collection(db, "users", memberId, "recipes"));
            snapshot.docs.forEach(d => {
                if (existing.has(d.id)) return;
                existing.add(d.id);
                recipes.push(toStoredRecipe({ ...d.data() as Recipe, id: d.id }, memberId));
            });
            moved.push(memberId);
        } catch (e) {
            console.error(`Couldn't read the old recipes of member ${memberId}; trying again next time`, e);
        }
    }));

    await writeFamilyRecipes(group.id, recipes);
    if (moved.length) await updateDoc(getGroupRef(group.id), { legacyRecipesMoved: arrayUnion(...moved) });
};

// --- Group Management ---
// Every user has a family. One is created the first time it's needed (a family of one), and
// leaving a family starts a new one.

const defaultFamilyName = () => {
    const firstName = auth.currentUser?.displayName?.trim().split(/\s+/)[0];
    return firstName ? `${firstName}'s family` : "My family";
};

const createFamily = async (uid: string, extra: Partial<Group> = {}): Promise<Group> => {
    const groupId = crypto.randomUUID();
    const inviteCode = generateInviteCode();

    const group: Group = {
        ...extra,
        id: groupId,
        name: defaultFamilyName(),
        ownerId: uid,
        createdAt: Date.now(),
        inviteCode,
        memberIds: [uid]
    };

    // Group doc, invite lookup and profile in one batch: the groupInvites rule
    // checks the group as it will be after this write.
    const batch = writeBatch(db);
    batch.set(getGroupRef(groupId), group);
    batch.set(getInviteRef(inviteCode), { groupId });
    batch.set(getUserRef(uid), { groupId }, { merge: true });
    await batch.commit();

    return group;
};

/** The user's family, created if they have none (or their profile points at one they're not in). */
const loadOrCreateFamily = async (uid: string): Promise<Group> => {
    const groupId = (await getDoc(getUserRef(uid))).data()?.groupId;
    if (typeof groupId === "string" && groupId) {
        try {
            const snap = await getDoc(getGroupRef(groupId));
            const group = snap.exists() ? snap.data() as Group : null;
            if (group?.memberIds.includes(uid)) return group;
        } catch (e) {
            // A group the user isn't in (or that was deleted) is denied. Anything else, such as
            // being offline, must not create a second family.
            if ((e as { code?: string })?.code !== "permission-denied") throw e;
        }
    }
    return createFamily(uid);
};

// The current user's groupId, read once per session (plans and recipes need it on every load).
let myGroupId: { uid: string; promise: Promise<string | null> } | null = null;

/** The user's family groupId, creating the family and moving old recipes into it on first use. */
export const getMyGroupId = (): Promise<string | null> => {
    const uid = currentUid();
    if (!uid) return Promise.resolve(null);
    if (myGroupId?.uid !== uid) {
        myGroupId = {
            uid,
            promise: loadOrCreateFamily(uid)
                .then(async group => {
                    await moveLegacyRecipes(group).catch(e => console.error("Error moving recipes into the family:", e));
                    return group.id;
                })
                .catch(e => { console.error("Error loading the family:", e); myGroupId = null; return null; }), // retry next time
        };
    }
    return myGroupId.promise;
};

/** Drops the cached groupId, so the next call reads the profile again. */
export const forgetMyGroupId = () => { myGroupId = null; };

/**
 * Joins the family behind an invite code. Only from a family of one: the user's recipes move
 * into the new family and the old one is deleted.
 */
export const joinGroup = async (inviteCode: string): Promise<Group> => {
    const user = getCurrentUser();
    const current = await getUserGroup();

    // 1. Resolve the code. Groups themselves are readable by members only.
    const inviteSnap = await getDoc(getInviteRef(normalizeInviteCode(inviteCode)));
    if (!inviteSnap.exists()) {
        throw new Error("Invalid invite code");
    }
    const { groupId } = inviteSnap.data() as { groupId: string };
    if (current?.id === groupId) throw new Error("You're already in this family.");
    if (current && current.memberIds.length > 1) throw new Error("Leave your current family before joining another.");

    // 2. Add user to memberIds, unless an earlier attempt already did. The rules reject this if the group is full.
    const alreadyMember = (await getGroup(groupId).catch(() => null))?.memberIds.includes(user.uid);
    if (!alreadyMember) {
        try {
            await updateDoc(getGroupRef(groupId), {
                memberIds: arrayUnion(user.uid)
            });
        } catch {
            throw new Error(`Could not join this family. It may be full (max ${MAX_FAMILY_GROUP_SIZE} members).`);
        }
    }

    // 3. Bring the user's recipes along. Recipes the family already has (same id) are kept as they are.
    if (current) {
        const [mine, theirs] = await Promise.all([readFamilyRecipes(current.id), readFamilyRecipes(groupId)]);
        const existing = new Set(theirs.map(r => r.id));
        await writeFamilyRecipes(groupId, mine.filter(r => !existing.has(r.id)));
        // Their old users/{uid}/recipes are already in the recipes just moved
        if (current.legacyRecipesMoved?.includes(user.uid)) {
            await updateDoc(getGroupRef(groupId), { legacyRecipesMoved: arrayUnion(user.uid) });
        }
    }

    // 4. Update User Profile
    await setDoc(getUserRef(user.uid), { groupId }, { merge: true });
    forgetMyGroupId();

    // 5. Delete the old family of one. Not fatal: nobody can see it any more.
    if (current) {
        try {
            const [recipes, dinners] = await Promise.all([
                getDocs(familyRecipesRef(current.id)),
                getDocs(collection(db, "groups", current.id, "dinners")),
            ]);
            await deleteDocs([...recipes.docs, ...dinners.docs].map(d => d.ref));
            if (current.ownerId === user.uid) await deleteDoc(getGroupRef(current.id));
            else await updateDoc(getGroupRef(current.id), { memberIds: arrayRemove(user.uid) });
        } catch (e) {
            console.error("Error removing the old family:", e);
        }
    }

    const group = await getGroup(groupId);
    if (!group) throw new Error("Group not found");
    return group;
};

export const FAMILY_NAME_MAX_LENGTH = 50;

/** Renames the family. Any member can. */
export const renameGroup = async (groupId: string, name: string): Promise<string> => {
    const trimmed = name.trim().slice(0, FAMILY_NAME_MAX_LENGTH);
    if (!trimmed) throw new Error("Give your family a name.");
    await updateDoc(getGroupRef(groupId), { name: trimmed });
    return trimmed;
};

/**
 * Gives a group created before groupInvites existed a code in the current
 * format and publishes its lookup doc, so the code works for joining.
 * Returns the group with its current code.
 */
export const ensureInviteCode = async (group: Group): Promise<Group> => {
    if (isCurrentInviteFormat(group.inviteCode)) return group;

    const inviteCode = generateInviteCode();
    const batch = writeBatch(db);
    batch.update(getGroupRef(group.id), { inviteCode });
    batch.set(getInviteRef(inviteCode), { groupId: group.id });
    await batch.commit();

    return { ...group, inviteCode };
};

/**
 * Leaves a family of two or more. The family keeps every recipe; the user starts a new family
 * of their own with copies of the recipes they added (same ids, so their plans still resolve).
 */
export const leaveGroup = async (groupId: string): Promise<void> => {
    const user = getCurrentUser();
    const group = await getGroup(groupId);
    if (!group) throw new Error("Group not found");
    if (group.memberIds.length <= 1) throw new Error("You're the only one in this family.");

    // 1. The recipes this user added, read while still a member
    const snapshot = await getDocs(query(familyRecipesRef(groupId), where("createdBy", "==", user.uid)));
    const mine = snapshot.docs.map(d => {
        const recipe = { ...d.data() as Recipe, id: d.id };
        return { ...recipe, favoritedBy: (recipe.favoritedBy || []).filter(id => id === user.uid) };
    });

    // 2. A new family with those copies. Their old users/{uid}/recipes stay behind.
    const family = await createFamily(user.uid, { legacyRecipesMoved: [user.uid] });
    await writeFamilyRecipes(family.id, mine);

    // 3. Remove user from the old family's members
    await updateDoc(getGroupRef(groupId), {
        memberIds: arrayRemove(user.uid)
    });
    forgetMyGroupId();
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
    const snap = await getDoc(getGroupRef(groupId));
    return snap.exists() ? (snap.data() as Group) : null;
};

/** The user's family (always one once signed in; null only when it can't be loaded). */
export const getUserGroup = async (): Promise<Group | null> => {
    const groupId = await getMyGroupId();
    return groupId ? getGroup(groupId) : null;
};

export const getGroupMembersDetails = async (memberIds: string[]): Promise<{ id: string, name: string }[]> => {
    try {
        const promises = memberIds.map(async (uid) => {
            // Names come from the public profile; stats (weight) are owner-only
            const snap = await getDoc(doc(db, "users", uid, "profile", "public"));
            const name = (snap.data()?.name as string | undefined) || "Family member";
            return { id: uid, name };
        });
        return await Promise.all(promises);
    } catch (e) {
        console.error("Error fetching member details:", e);
        return [];
    }
};
