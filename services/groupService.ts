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
import { Group, Recipe } from "../types";

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
    await updateDoc(getUserRef(user.uid), { groupId });

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

    // 2. Add user to memberIds
    await updateDoc(groupDoc.ref, {
        memberIds: arrayUnion(user.uid)
    });

    // 3. Update User Profile
    await updateDoc(getUserRef(user.uid), { groupId: group.id });

    return { ...group, memberIds: [...group.memberIds, user.uid] };
};

export const leaveGroup = async (groupId: string): Promise<void> => {
    const user = getCurrentUser();

    // 1. Remove user from group members
    await updateDoc(getGroupRef(groupId), {
        memberIds: arrayRemove(user.uid)
    });

    // 2. Clear groupId from User Profile
    await updateDoc(getUserRef(user.uid), { groupId: null });
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

// --- Recipe Sharing ---

export const shareRecipeToGroup = async (groupId: string, recipe: Recipe): Promise<void> => {
    const sharedRecipeRef = doc(db, "groups", groupId, "shared_recipes", recipe.id);
    await setDoc(sharedRecipeRef, {
        ...recipe,
        isShared: true,
        sharedBy: auth.currentUser?.uid,
        sharedAt: Date.now()
    });
};

export const getGroupRecipes = async (groupId: string): Promise<Recipe[]> => {
    const recipesRef = collection(db, "groups", groupId, "shared_recipes");
    const snap = await getDocs(recipesRef);
    return snap.docs.map(d => d.data() as Recipe);
};

export const deleteGroupRecipe = async (groupId: string, recipeId: string): Promise<void> => {
    await deleteDoc(doc(db, "groups", groupId, "shared_recipes", recipeId));
};
