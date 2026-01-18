import { db, auth } from "./firebase";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    deleteDoc,
    query,
    where,
    updateDoc,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";
import { Group, Recipe, UserStats } from "../types";
import { MAX_FAMILY_GROUP_SIZE } from "../constants";

// --- Collection Refs ---
const getGroupsRef = () => collection(db, "groups");
const getGroupRef = (groupId: string) => doc(db, "groups", groupId);
const getUserRef = (uid: string) => doc(db, "users", uid);

// --- Helpers ---
const generateInviteCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

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

    // 1. Create Group Doc
    await setDoc(getGroupRef(groupId), group);

    // 2. Update User Profile with groupId
    await setDoc(getUserRef(user.uid), { groupId }, { merge: true });

    return groupId;
};

export const joinGroup = async (inviteCode: string): Promise<Group> => {
    const user = getCurrentUser();

    // 1. Find group by code
    const q = query(getGroupsRef(), where("inviteCode", "==", inviteCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        throw new Error("Invalid invite code");
    }

    const groupDoc = snapshot.docs[0];
    const group = groupDoc.data() as Group;

    if (group.memberIds.length >= MAX_FAMILY_GROUP_SIZE) {
        throw new Error(`Group is full (max ${MAX_FAMILY_GROUP_SIZE} members)`);
    }

    // 2. Add user to memberIds
    await updateDoc(groupDoc.ref, {
        memberIds: arrayUnion(user.uid)
    });

    // 3. Update User Profile
    await setDoc(getUserRef(user.uid), { groupId: group.id }, { merge: true });

    return { ...group, memberIds: [...group.memberIds, user.uid] };
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

export const getFamilyMemberRecipes = async (): Promise<Recipe[]> => {
    const user = getCurrentUser();
    const group = await getUserGroup();

    if (!group) return [];

    // Get member details for names
    const memberDetails = await getGroupMembersDetails(group.memberIds);
    const memberNameMap = new Map(memberDetails.map(m => [m.id, m.name]));

    const allFamilyRecipes: Recipe[] = [];

    // Fetch recipes from each family member (except self)
    for (const memberId of group.memberIds) {
        if (memberId === user.uid) continue; // Skip own recipes

        try {
            const recipesRef = collection(db, "users", memberId, "recipes");
            const snapshot = await getDocs(recipesRef);

            const memberRecipes = snapshot.docs.map(doc => ({
                ...doc.data() as Recipe,
                ownerId: memberId,
                ownerName: memberNameMap.get(memberId) || "Family Member"
            }));

            allFamilyRecipes.push(...memberRecipes);
        } catch (e) {
            console.error(`Failed to fetch recipes for member ${memberId}:`, e);
            // Continue with other members
        }
    }

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
