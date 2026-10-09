import { db, auth } from "./firebase";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    writeBatch
} from "firebase/firestore";
import { Group, Recipe, UserStats } from "../types";
import { MAX_FAMILY_GROUP_SIZE } from "../constants";

// --- Collection Refs ---
const getGroupRef = (groupId: string) => doc(db, "groups", groupId);
const getUserRef = (uid: string) => doc(db, "users", uid);
const getInviteRef = (code: string) => doc(db, "groupInvites", code);

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
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    return user;
};

// --- Group Management ---

export const createGroup = async (groupName: string): Promise<string> => {
    const user = getCurrentUser();
    const groupId = crypto.randomUUID();
    const inviteCode = generateInviteCode();

    const group: Group = {
        id: groupId,
        name: groupName,
        ownerId: user.uid,
        createdAt: Date.now(),
        inviteCode,
        memberIds: [user.uid]
    };

    // Group doc, invite lookup and profile in one batch: the groupInvites rule
    // checks the group as it will be after this write.
    const batch = writeBatch(db);
    batch.set(getGroupRef(groupId), group);
    batch.set(getInviteRef(inviteCode), { groupId });
    batch.set(getUserRef(user.uid), { groupId }, { merge: true });
    await batch.commit();

    return groupId;
};

export const joinGroup = async (inviteCode: string): Promise<Group> => {
    const user = getCurrentUser();

    // 1. Resolve the code. Groups themselves are readable by members only.
    const inviteSnap = await getDoc(getInviteRef(normalizeInviteCode(inviteCode)));
    if (!inviteSnap.exists()) {
        throw new Error("Invalid invite code");
    }
    const { groupId } = inviteSnap.data() as { groupId: string };

    // 2. Add user to memberIds. The rules reject this if the group is full.
    try {
        await updateDoc(getGroupRef(groupId), {
            memberIds: arrayUnion(user.uid)
        });
    } catch {
        throw new Error(`Could not join this family. It may be full (max ${MAX_FAMILY_GROUP_SIZE} members).`);
    }

    // 3. Update User Profile
    await setDoc(getUserRef(user.uid), { groupId }, { merge: true });

    const group = await getGroup(groupId);
    if (!group) throw new Error("Group not found");
    return group;
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

export const leaveGroup = async (groupId: string): Promise<void> => {
    const user = getCurrentUser();

    // 1. Remove user from group members
    await updateDoc(getGroupRef(groupId), {
        memberIds: arrayRemove(user.uid)
    });

    // 2. Clear groupId from User Profile
    await setDoc(getUserRef(user.uid), { groupId: null }, { merge: true });
};

export const getGroup = async (groupId: string): Promise<Group | null> => {
    const snap = await getDoc(getGroupRef(groupId));
    return snap.exists() ? (snap.data() as Group) : null;
};

export const getUserGroup = async (): Promise<Group | null> => {
    const user = getCurrentUser();
    // Check user profile first (optimization)
    const userSnap = await getDoc(getUserRef(user.uid));
    const userData = userSnap.data();

    if (userData?.groupId) {
        return getGroup(userData.groupId);
    }
    return null;
};

export const getGroupMembersDetails = async (memberIds: string[]): Promise<{ id: string, name: string }[]> => {
    try {
        const promises = memberIds.map(async (uid) => {
            // Stats are stored in users/{uid}/data/stats
            const statsRef = doc(db, "users", uid, "data", "stats");
            const snap = await getDoc(statsRef);
            let name = "Unknown Member";
            if (snap.exists()) {
                const stats = snap.data() as UserStats;
                if (stats.name) name = stats.name;
            }
            return { id: uid, name };
        });
        return await Promise.all(promises);
    } catch (e) {
        console.error("Error fetching member details:", e);
        return [];
    }
};

// --- Family Recipe Visibility ---

export const getFamilyMemberRecipes = async (providedGroup?: Group | null): Promise<Recipe[]> => {
    const user = getCurrentUser();
    const group = providedGroup !== undefined ? providedGroup : await getUserGroup();

    if (!group) return [];

    // Get member details for names
    // Optimization: getGroupMembersDetails also does fetching.
    // If we only need names for the recipes, we might be able to get them from the recipe itself
    // BUT the data model says `ownerName` is on the recipe.
    // However, the previous code fetched member details to Populate `ownerName` map.
    // Let's keep that but parallelize it too if possible, distinct from recipe fetching.

    // We can fetch details AND recipes in parallel.

    const [memberDetails, memberRecipesResults] = await Promise.all([
        getGroupMembersDetails(group.memberIds),
        Promise.all(
            group.memberIds
                .filter(mid => mid !== user.uid)
                .map(async (memberId) => {
                    try {
                        const recipesRef = collection(db, "users", memberId, "recipes");
                        const snapshot = await getDocs(recipesRef);
                        return snapshot.docs.map(doc => ({
                            ...doc.data() as Recipe,
                            ownerId: memberId,
                            // We will fill ownerName after we get the details mapping
                        }));
                    } catch (e) {
                        console.error(`Failed to fetch recipes for member ${memberId}:`, e);
                        return [];
                    }
                })
        )
    ]);

    const memberNameMap = new Map(memberDetails.map(m => [m.id, m.name]));

    // Flatten and enrich with names
    const allFamilyRecipes = memberRecipesResults.flat().map(recipe => ({
        ...recipe,
        ownerName: recipe.ownerId ? (memberNameMap.get(recipe.ownerId) || "Family Member") : "Family Member"
    }));

    return allFamilyRecipes;
};

export const copyRecipeToMyLibrary = async (recipe: Recipe): Promise<Recipe> => {
    const user = getCurrentUser();

    // Create a copy with new ID, removing family ownership fields
    const copiedRecipe: Recipe = {
        ...recipe,
        id: crypto.randomUUID(),
        ownerId: undefined,
        ownerName: undefined,
        isShared: false,
        sharedBy: undefined,
        sharedAt: undefined
    };

    // Clean up undefined fields
    Object.keys(copiedRecipe).forEach(key => {
        if (copiedRecipe[key as keyof Recipe] === undefined) {
            delete copiedRecipe[key as keyof Recipe];
        }
    });

    // Save to user's recipes
    const recipeRef = doc(db, "users", user.uid, "recipes", copiedRecipe.id);
    await setDoc(recipeRef, copiedRecipe);

    return copiedRecipe;
};

// --- Recipe Sharing (Deprecated) ---

/**
 * @deprecated Use getFamilyMemberRecipes() instead.
 */
export const shareRecipeToGroup = async (groupId: string, recipe: Recipe): Promise<void> => {
    const sharedRecipeRef = doc(db, "groups", groupId, "shared_recipes", recipe.id);
    await setDoc(sharedRecipeRef, {
        ...recipe,
        isShared: true,
        sharedBy: auth.currentUser?.uid,
        sharedAt: Date.now()
    });
};

/**
 * @deprecated Use getFamilyMemberRecipes() instead.
 */
export const getGroupRecipes = async (groupId: string): Promise<Recipe[]> => {
    const recipesRef = collection(db, "groups", groupId, "shared_recipes");
    const snap = await getDocs(recipesRef);
    return snap.docs.map(d => d.data() as Recipe);
};

/**
 * @deprecated Use family visibility model instead.
 */
export const deleteGroupRecipe = async (groupId: string, recipeId: string): Promise<void> => {
    await deleteDoc(doc(db, "groups", groupId, "shared_recipes", recipeId));
};
