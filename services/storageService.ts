import { CoachReadState, EatingOutDish, Recipe, DayPlan, UserStats, DailyLog, FoodLogItem, PantryInventory, EnhancedShoppingState, FastingState, FastingEntry, DailySummary, WorkoutItem, PlannedMeal, PlannedMealMeta, MealSlot } from "../types";
import { getCacheKey, saveToCache, getCachedDayPlan, getCachedDailyLog, getCachedUserStats, getCachedFastingState, getCachedEatingOutDishes } from "../utils/cacheService";
import { getUserGroup, getGroupMembersDetails, getMyGroupId, familyRecipesRef, toStoredRecipe } from "./groupService";
import { DEFAULT_USER_STATS } from "../constants";
import { currentUid, db } from "./firebase";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, deleteField, arrayUnion, arrayRemove, query, where, orderBy, limit, onSnapshot, DocumentData, QuerySnapshot } from "firebase/firestore";

// Helper to get current user ID or throw
const getUserId = () => {
  const uid = currentUid();
  if (!uid) throw new Error("User not authenticated");
  return uid;
};

// Helper for references
const getCollectionRef = (name: string) => collection(db, 'users', getUserId(), name);
const getDocRef = (collectionName: string, docId: string) => doc(db, 'users', getUserId(), collectionName, docId);

// --- Local Caching Helpers (SWR Strategy) ---
// Delegated to utils/cacheService.ts
export { getCachedDayPlan, getCachedDailyLog, getCachedUserStats, getCachedFastingState };

// --- Recipes ---
// Recipes belong to the family: groups/{groupId}/recipes/{id} (see groupService).

/** A stored family recipe as the app uses it: legacy shapes fixed up, isFavorite for this user. */
const fromStoredRecipe = (data: DocumentData, id: string): Recipe => {
  const recipe = { ...data, id } as Recipe & { type?: string };
  // Migration on read: If tags are missing but type exists, convert type to tags
  if (!recipe.tags && recipe.type) {
    // Normalize meal types to tags
    let tag = recipe.type;
    if (tag === 'lunch' || tag === 'dinner') tag = 'main meal';
    recipe.tags = [tag];
  }
  return { ...recipe, isFavorite: !!currentUid() && (recipe.favoritedBy || []).includes(currentUid()!) };
};

const familyRecipeRef = async (id: string) => {
  const groupId = await getMyGroupId();
  if (!groupId) throw new Error("Couldn't load your family");
  return doc(db, 'groups', groupId, 'recipes', id);
};

export const getRecipes = async (limitCount?: number): Promise<Recipe[]> => {
  try {
    const groupId = await getMyGroupId();
    if (!groupId) throw new Error("Couldn't load your family");
    const recipesRef = familyRecipesRef(groupId);
    const snapshot = await getDocs(limitCount ? query(recipesRef, limit(limitCount)) : recipesRef);
    const recipes = snapshot.docs.map(d => fromStoredRecipe(d.data(), d.id));

    if (!limitCount) {
      saveToCache(getCacheKey('recipes'), recipes);
    }

    return recipes;
  } catch (e) {
    console.error("Error fetching recipes", e);
    return [];
  }
};

export const saveRecipe = async (recipe: Recipe) => {
  // Reject Base64 images (after migration)
  if (recipe.image?.startsWith('data:')) {
    throw new Error('Base64 images are not allowed. Please upload to Firebase Storage first.');
  }
  await setDoc(await familyRecipeRef(recipe.id), toStoredRecipe(recipe, getUserId()));
};

/** Favourites are per member, so this only adds or removes the current user. */
export const setRecipeFavorite = async (id: string, favorite: boolean) => {
  const uid = getUserId();
  await updateDoc(await familyRecipeRef(id), { favoritedBy: favorite ? arrayUnion(uid) : arrayRemove(uid) });
};

export const deleteRecipe = async (id: string) => {
  await deleteDoc(await familyRecipeRef(id));
};

// --- Base64 Image Migration (Database Normalization) ---

import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { localDateString, parseLocalDate } from '../utils/dateUtils';
import { QUICK_MEAL_DESCRIPTION, isQuickMeal } from '../utils/planUtils';
import { rememberDish } from '../utils/eatingOutHistory';

/**
 * Migrates all Base64 images in recipes to Firebase Storage.
 * Replaces data URLs with permanent CDN URLs, eliminating bloat in Firestore.
 */
export const migrateBase64ImagesToStorage = async (): Promise<{ success: boolean; migratedCount: number; errors: string[] }> => {
  try {
    const uid = getUserId();
    const recipes = await getRecipes();

    let migratedCount = 0;
    const errors: string[] = [];

    for (const recipe of recipes) {
      if (recipe.image?.startsWith('data:')) {
        try {
          console.log(`Migrating image for ${recipe.name}...`);

          // 1. Convert Base64 to Blob
          const response = await fetch(recipe.image);
          const blob = await response.blob();

          // 2. Determine file extension from MIME type
          const mimeType = blob.type || 'image/jpeg';
          const ext = mimeType.split('/')[1] || 'jpg';

          // 3. Upload to Firebase Storage
          const storageRef = ref(storage, `users/${uid}/recipe-images/${recipe.id}.${ext}`);
          await uploadBytes(storageRef, blob);

          // 4. Get public URL
          const downloadURL = await getDownloadURL(storageRef);

          // 5. Update recipe (bypass validation for migration)
          const updatedRecipe = { ...recipe, image: downloadURL };
          await setDoc(await familyRecipeRef(recipe.id), toStoredRecipe(updatedRecipe, uid));

          migratedCount++;
          console.log(`✅ Migrated ${recipe.name}: ${(blob.size / 1024).toFixed(1)}KB`);
        } catch (err: any) {
          const errorMsg = `Failed to migrate ${recipe.name}: ${err.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

    console.log(`✅ Migration complete: ${migratedCount} images moved to Firebase Storage`);
    return { success: true, migratedCount, errors };
  } catch (e: any) {
    console.error("Image migration failed:", e);
    return { success: false, migratedCount: 0, errors: [e.message] };
  }
};



// --- Planning ---
const PLAN_DOC = 'plan'; // Keeping reference for legacy migration and export

// Refactored to use 'days' collection to avoid 1MB document limit.
// Legacy 'data/plan' document is deprecated.

// --- DayPlan Meal Normalization (Database Optimization) ---

/**
 * Converts a full Recipe UI object to a lightweight PlannedMeal for storage.
 * - Library recipes are stored as a reference to the family's recipe
 * - Custom meals store their own minimal data
 * Per-instance fields (slot, sides, portions, packed, leftover) are stored on both.
 */
const dehydrateMeal = (meal: Recipe): PlannedMeal => {
  const meta: PlannedMealMeta = {
    slot: meal.slot,
    instanceId: meal.instanceId,
    isPacked: meal.isPacked || undefined,
    isLeftover: meal.isLeftover || undefined,
    sides: meal.sides?.length ? meal.sides.map(side => dehydrateMeal(side)) : undefined,
    familyMeal: meal.familyMeal || undefined,
    addedBy: meal.addedBy,
    notEating: meal.notEating?.length ? meal.notEating : undefined,
  };

  const isLibraryRecipe = !isQuickMeal(meal) && (!!meal.originalRecipeId || !!meal.id);

  if (isLibraryRecipe) {
    return {
      type: 'reference',
      recipeId: meal.originalRecipeId || meal.id!,
      servings: meal.servings || 1,
      ...meta,
    };
  }

  return {
    type: 'custom',
    id: meal.id || crypto.randomUUID(),
    name: meal.name,
    // A live budget is saved as planned; it's recomputed from the day each time it's shown
    calories: meal.quick?.noCalories ? undefined : (meal.quick?.budget && meal.quick.plannedBudget !== undefined ? meal.quick.plannedBudget : meal.calories),
    caloriesEstimated: meal.quick?.estimated || undefined,
    budget: meal.quick?.budget || undefined,
    autoBudget: (meal.quick?.budget && meal.quick.autoBudget) || undefined,
    budgeted: meal.quick?.budgeted,
    place: meal.quick?.place,
    dish: meal.quick?.dish,
    kind: meal.quick?.kind,
    shopping: meal.ingredients?.length ? meal.ingredients : undefined,
    protein: meal.protein,
    fat: meal.fat,
    carbs: meal.carbs,
    tags: meal.tags || [],
    servings: meal.servings || 1,
    ...meta,
  };
};

// Helper to get a single family recipe
export const getRecipe = async (id: string): Promise<Recipe | null> => {
  try {
    const docSnap = await getDoc(await familyRecipeRef(id));
    if (docSnap.exists()) return fromStoredRecipe(docSnap.data(), docSnap.id);
    return null;
  } catch (e) {
    console.error(`Error fetching recipe ${id}`, e);
    return null;
  }
};

/**
 * Hydrates PlannedMeal[] (from Firestore) back to Recipe[] (for UI display).
 * References are fetched from the family's recipes (also for other members' plans: same family).
 */
const hydratePlannedMeals = async (plannedMeals: PlannedMeal[]): Promise<Recipe[]> => {
  if (!plannedMeals || plannedMeals.length === 0) return [];

  // Fetch every referenced recipe (including sides) once, in parallel
  const recipeIds = new Set<string>();
  const collect = (meals: PlannedMeal[]) => meals.forEach(meal => {
    if (meal?.type === 'reference') recipeIds.add(meal.recipeId);
    if (meal?.sides) collect(meal.sides);
  });
  collect(plannedMeals);
  const fetched = await Promise.all([...recipeIds].map(async id => [id, await getRecipe(id)] as const));
  const recipeMap = new Map(fetched);

  const hydrateOne = (meal: PlannedMeal): Recipe => {
    // Legacy day docs may still hold full recipes
    if (!meal.type) return meal as unknown as Recipe;

    const meta: Partial<Recipe> = {
      slot: meal.slot,
      instanceId: meal.instanceId,
      isPacked: meal.isPacked,
      isLeftover: meal.isLeftover,
      familyMeal: meal.familyMeal,
      addedBy: meal.addedBy,
      notEating: meal.notEating,
      sides: meal.sides ? meal.sides.map(hydrateOne) : undefined,
    };

    if (meal.type === 'reference') {
      const original = recipeMap.get(meal.recipeId);
      if (!original) {
        console.warn(`Recipe ${meal.recipeId} not found in library`);
        return {
          id: meal.recipeId,
          name: 'Recipe deleted',
          description: 'This recipe may have been deleted',
          isMissing: true,
          calories: 0, protein: 0, fat: 0, carbs: 0,
          ingredients: [], instructions: [], tags: [],
          servings: meal.servings || 1,
          ...meta,
        };
      }
      return {
        ...original,
        servings: meal.servings || original.servings,
        ...(meal.overrides || {}),
        ...meta,
      };
    }

    return {
      id: meal.id,
      name: meal.name,
      description: QUICK_MEAL_DESCRIPTION,
      calories: meal.calories ?? 0,
      quick: {
        kind: meal.kind,
        estimated: meal.caloriesEstimated || undefined,
        budget: meal.budget || undefined,
        autoBudget: (meal.budget && meal.autoBudget) || undefined,
        budgeted: meal.budgeted,
        place: meal.place,
        dish: meal.dish,
        noCalories: meal.calories === undefined || undefined,
      },
      protein: meal.protein || 0,
      fat: meal.fat || 0,
      carbs: meal.carbs || 0,
      ingredients: meal.shopping || [],
      instructions: [],
      tags: meal.tags || [],
      servings: meal.servings || 1,
      ...meta,
    };
  };

  return plannedMeals.filter(Boolean).map(hydrateOne);
};

// --- Family meals ---
// With a family group, meals marked as family meals (any slot; new dinners start out as one) are
// shared: they live in groups/{groupId}/dinners/{date} (named when only dinners were shared) as
// { date, meals: { [instanceId]: PlannedMeal & { position } } } and appear in every member's day
// plan with familyMeal set. Each meal is its own map entry, so members editing different meals at
// once don't overwrite each other. A member who isn't eating one adds their uid to its notEating,
// which only saveFamilyMealOut writes; the meal then sits in their plan's familyMealsOut.

type StoredFamilyMeal = PlannedMeal & { position?: number };

/** A loaded family meal: its stored form without notEating, and whether the user is out of it */
type LoadedFamilyMeal = { stored: string; out: boolean };

/** What each loaded family-meal doc held, by `${groupId}/${date}`, so saves only write real changes. */
const loadedFamilyMeals = new Map<string, Map<string, LoadedFamilyMeal>>();

const familyMealsRef = (groupId: string, date: string) => doc(db, 'groups', groupId, 'dinners', date);

/** A family meal's stored form, apart from who isn't eating it (saved on its own) */
const storedFamilyMeal = (meal: Recipe) => {
  const { notEating, ...stored } = dehydrateMeal(meal);
  return { stored, notEating };
};

const hydrateFamilyMeals = async (groupId: string, date: string, stored?: Record<string, StoredFamilyMeal>): Promise<Recipe[]> => {
  // An entry with no type is a notEating change that landed after its meal was removed
  const entries = Object.values(stored || {}).filter(entry => entry.type).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const me = currentUid();
  const meals = (await hydratePlannedMeals(entries)).map(meal => ({ ...meal, slot: meal.slot || 'dinner' as const, familyMeal: true }));
  loadedFamilyMeals.set(`${groupId}/${date}`, new Map(meals.map(meal => [meal.instanceId!, {
    stored: JSON.stringify(storedFamilyMeal(meal).stored),
    out: !!me && !!meal.notEating?.includes(me),
  }])));
  return meals;
};

/** Family meals for a date range, keyed by date. Empty without a family group. */
export const getFamilyMealsInRange = async (startDate: string, endDate: string): Promise<Record<string, Recipe[]>> => {
  const groupId = await getMyGroupId();
  if (!groupId) return {};
  try {
    const snapshot = await getDocs(query(
      collection(db, 'groups', groupId, 'dinners'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    ));
    const result: Record<string, Recipe[]> = {};
    await Promise.all(snapshot.docs.map(async d => {
      const data = d.data() as { date: string; meals?: Record<string, StoredFamilyMeal> };
      result[data.date] = await hydrateFamilyMeals(groupId, data.date, data.meals);
    }));
    return result;
  } catch (e) {
    console.error('Error fetching family meals:', e);
    return {};
  }
};

/** A family meal another member planned, noticed while the app was open */
export interface FamilyMealChange {
  date: string;
  name: string;
  /** Uid of the member who planned it */
  by: string;
  slot: MealSlot;
}

/**
 * A day plan with its family meals replaced by `familyMeals`: the ones the user is eating go in its
 * meals, the ones they aren't in familyMealsOut.
 */
export const withFamilyMeals = (plan: DayPlan, familyMeals: Recipe[]): DayPlan => {
  const me = currentUid();
  const isOut = (meal: Recipe) => !!me && !!meal.notEating?.includes(me);
  const out = familyMeals.filter(isOut);
  return {
    ...plan,
    meals: [...plan.meals.filter(meal => !meal.familyMeal), ...familyMeals.filter(meal => !isOut(meal))],
    familyMealsOut: out.length ? out : undefined,
  };
};

/**
 * Keeps the family meals for a date range live. `onUpdate` gets the family meals of each date that
 * changed (an empty list when a date's were all removed), and the ones other members added since
 * the first update, so they can be pointed out. The cached day plans are kept up to date too.
 * Returns the unsubscribe function; nothing happens without a family group.
 */
export const subscribeFamilyMeals = (
  startDate: string,
  endDate: string,
  onUpdate: (dinners: Record<string, Recipe[]>, added: FamilyMealChange[]) => void,
): (() => void) => {
  let stopped = false;
  let unsubscribe: (() => void) | undefined;
  // Instance ids seen per date by this subscription (its own, so other listeners can't hide a change)
  const seen = new Map<string, Set<string>>();
  let first = true;
  let queue = Promise.resolve();

  const handle = async (groupId: string, snapshot: QuerySnapshot<DocumentData>) => {
    const isFirst = first;
    first = false;
    const me = currentUid();
    const dinners: Record<string, Recipe[]> = {};
    const added: FamilyMealChange[] = [];
    await Promise.all(snapshot.docChanges().map(async change => {
      const data = change.doc.data() as { date?: string; meals?: Record<string, StoredFamilyMeal> };
      const date = data.date || change.doc.id;
      const meals = change.type === 'removed' ? [] : await hydrateFamilyMeals(groupId, date, data.meals);
      if (change.type === 'removed') loadedFamilyMeals.delete(`${groupId}/${date}`);
      dinners[date] = meals;
      const before = seen.get(date) || new Set<string>();
      if (!isFirst) meals.forEach(meal => {
        if (!before.has(meal.instanceId!) && meal.addedBy && meal.addedBy !== me) added.push({ date, name: meal.name, by: meal.addedBy, slot: meal.slot || 'dinner' });
      });
      seen.set(date, new Set(meals.map(meal => meal.instanceId!)));
      const cached = getCachedDayPlan(date);
      if (cached) saveToCache(getCacheKey('dayPlan', date), withFamilyMeals(cached, meals));
    }));
    if (!stopped && Object.keys(dinners).length > 0) onUpdate(dinners, added);
  };

  getMyGroupId().then(groupId => {
    if (!groupId || stopped) return;
    unsubscribe = onSnapshot(
      query(collection(db, 'groups', groupId, 'dinners'), where('date', '>=', startDate), where('date', '<=', endDate)),
      snapshot => {
        // This device's saves come through too (they match the plan already, and are never announced).
        // One at a time and in order, as hydrating recipes is async
        queue = queue.then(() => handle(groupId, snapshot)).catch(e => console.error('Error updating family meals:', e));
      },
      e => console.warn('Live family meals stopped:', e),
    );
  }).catch(e => console.warn('Could not start live family meals:', e));

  return () => { stopped = true; unsubscribe?.(); };
};

/**
 * Writes the family meals the user is eating that changed since they were loaded. Never removes one
 * this session hasn't seen, or one the user isn't eating (those aren't in their plan's meals).
 * Who isn't eating a meal is only written for a new one (a swap carries it over).
 */
const saveFamilyMeals = async (date: string, meals: Recipe[]) => {
  const groupId = await getMyGroupId();
  if (!groupId) return;
  const key = `${groupId}/${date}`;
  const before = loadedFamilyMeals.get(key) || new Map<string, LoadedFamilyMeal>();
  const after = new Map<string, LoadedFamilyMeal>();
  const changes: Record<string, unknown> = {};

  meals.forEach((meal, position) => {
    const instanceId = meal.instanceId || crypto.randomUUID();
    const { stored, notEating } = storedFamilyMeal({ ...meal, instanceId });
    const json = JSON.stringify(stored);
    const loaded = before.get(instanceId);
    after.set(instanceId, { stored: json, out: false });
    if (loaded?.stored !== json) changes[instanceId] = loaded ? { ...stored, position } : { ...stored, notEating, position };
  });
  before.forEach((loaded, instanceId) => {
    if (after.has(instanceId)) return;
    if (loaded.out) after.set(instanceId, loaded);
    else changes[instanceId] = deleteField();
  });

  if (Object.keys(changes).length === 0) return;
  await setDoc(familyMealsRef(groupId, date), { date, meals: changes }, { merge: true });
  loadedFamilyMeals.set(key, after);
};

/**
 * Saves that the user is (out: true) or is again (false) not eating a family meal. `plan` already
 * has the change (see setFamilyMealOut in planUtils) and is cached as is.
 */
export const saveFamilyMealOut = async (plan: DayPlan, instanceId: string, out: boolean) => {
  const [groupId, me] = [await getMyGroupId(), currentUid()];
  if (!groupId || !me) return;
  // Marked first, so saving the plan neither removes the meal nor writes it as new
  const loaded = loadedFamilyMeals.get(`${groupId}/${plan.date}`)?.get(instanceId);
  if (loaded) loaded.out = out;
  await Promise.all([
    setDoc(familyMealsRef(groupId, plan.date), {
      date: plan.date,
      meals: { [instanceId]: { notEating: out ? arrayUnion(me) : arrayRemove(me) } },
    }, { merge: true }),
    // The rest of the plan (its calories and eaten marks) as usual
    saveDayPlan(plan),
  ]);
};

/** Gives meals without an instanceId one, so they can be ticked off and moved individually. */
const withInstanceIds = (meals: Recipe[]) =>
  meals.map(meal => meal.instanceId ? meal : { ...meal, instanceId: crypto.randomUUID() });

export const getDayPlan = async (date: string): Promise<DayPlan> => {
  try {
    const [dayDoc, familyMeals] = await Promise.all([
      getDoc(doc(db, 'users', getUserId(), 'days', date)),
      getFamilyMealsInRange(date, date),
    ]);

    const stored = dayDoc.exists()
      ? dayDoc.data() as { date: string; meals: PlannedMeal[]; completedMealIds: string[]; tips?: string; totalCalories?: number; type?: 'fast' | 'non-fast' }
      : null;
    const ownMeals = stored?.meals ? await hydratePlannedMeals(stored.meals) : [];

    const fullPlan = withFamilyMeals({
      ...(stored || {}),
      date,
      completedMealIds: stored?.completedMealIds || [],
      meals: ownMeals,
    }, familyMeals[date] || []);

    saveToCache(getCacheKey('dayPlan', date), fullPlan);
    return fullPlan;
  } catch (e) {
    console.error("Error getting day plan:", e);
    return { date, meals: [], completedMealIds: [] };
  }
};

export const saveDayPlan = async (dayPlan: DayPlan) => {
  const plan: DayPlan = { ...dayPlan, meals: withInstanceIds(dayPlan.meals) };

  // 1. Optimistic Cache Update
  saveToCache(getCacheKey('dayPlan', plan.date), plan);

  // 2. Own meals go in the user's day doc (normalized), family meals in the group
  const { familyMealsOut: _out, ...day } = plan;
  const ownMeals = plan.meals.filter(meal => !meal.familyMeal);
  const familyMeals = plan.meals.filter(meal => meal.familyMeal);
  const totalCalories = plan.meals.reduce((sum, meal) =>
    sum + (meal.calories || 0) + (meal.sides || []).reduce((s, side) => s + (side.calories || 0), 0), 0);

  await Promise.all([
    setDoc(doc(db, 'users', getUserId(), 'days', plan.date), { ...day, meals: ownMeals.map(meal => dehydrateMeal(meal)), totalCalories }),
    saveFamilyMeals(plan.date, familyMeals),
  ]);
};

/**
 * Migrates existing DayPlan documents from full Recipe[] to normalized PlannedMeal[].
 * Run once to reduce storage bloat on existing plans.
 */
export const migrateDayPlansToNormalized = async (): Promise<{ success: boolean; migratedCount: number; error?: string }> => {
  try {
    const uid = getUserId();
    const daysCollection = collection(db, 'users', uid, 'days');
    const snapshot = await getDocs(daysCollection);

    let migratedCount = 0;

    for (const planDoc of snapshot.docs) {
      const planData = planDoc.data();

      // Check if meals exist and are not already normalized
      if (planData.meals && planData.meals.length > 0) {
        const firstMeal = planData.meals[0];

        // If firstMeal has 'type' field, it's already normalized (PlannedMeal)
        if (firstMeal.type === 'reference' || firstMeal.type === 'custom') {
          console.log(`Skipping ${planDoc.id}: already normalized`);
          continue;
        }

        // Convert Recipe[] to PlannedMeal[]
        const dehydratedMeals = planData.meals.map((meal: Recipe) => dehydrateMeal(meal));

        // Update document
        await setDoc(planDoc.ref, {
          ...planData,
          meals: dehydratedMeals
        });

        migratedCount++;
        console.log(`Migrated ${planDoc.id}: ${planData.meals.length} meals → references`);
      }
    }

    console.log(`✅ DayPlan migration complete: ${migratedCount} plans normalized`);
    return { success: true, migratedCount };
  } catch (e: any) {
    console.error("DayPlan migration failed:", e);
    return { success: false, migratedCount: 0, error: e.message };
  }
};

/**
 * Cleans up deprecated data structures (run once after migration).
 */
export const cleanupLegacyData = async (): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  try {
    const uid = getUserId();
    let deletedCount = 0;

    // 1. Delete deprecated monolithic plan document
    try {
      const legacyPlanRef = getDocRef('data', 'plan');
      const legacyPlanSnap = await getDoc(legacyPlanRef);
      if (legacyPlanSnap.exists()) {
        await deleteDoc(legacyPlanRef);
        deletedCount++;
        console.log('Deleted legacy plan document');
      }
    } catch (e) {
      console.warn('Legacy plan document not found or already deleted');
    }

    // 2. Delete deprecated shared_recipes collections (if user has groups)
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.data();

      if (userData?.groupId) {
        const sharedRecipesRef = collection(db, 'groups', userData.groupId, 'shared_recipes');
        const sharedRecipesSnap = await getDocs(sharedRecipesRef);

        if (!sharedRecipesSnap.empty) {
          for (const recipeDoc of sharedRecipesSnap.docs) {
            await deleteDoc(recipeDoc.ref);
            deletedCount++;
          }
          console.log(`Deleted ${sharedRecipesSnap.size} deprecated shared recipes`);
        }
      }
    } catch (e) {
      console.warn('No group data or shared recipes to clean');
    }

    console.log(`✅ Legacy cleanup complete: ${deletedCount} items deleted`);
    return { success: true, deletedCount };
  } catch (e: any) {
    console.error("Legacy cleanup failed:", e);
    return { success: false, deletedCount: 0, error: e.message };
  }
};

// Helper to get plan for a range of dates (efficient batch fetch), family meals included.
// Every date in the range gets a plan; days are nourish days unless typed 'fast'.
export const getDayPlansInRange = async (startDate: string, endDate: string): Promise<Record<string, DayPlan>> => {
  try {
    const [snapshot, familyMeals] = await Promise.all([
      getDocs(query(
        getCollectionRef('days'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      )),
      getFamilyMealsInRange(startDate, endDate),
    ]);

    const plans: Record<string, DayPlan> = {};
    await Promise.all(snapshot.docs.map(async d => {
      const raw = d.data() as { date: string; meals: PlannedMeal[]; completedMealIds: string[]; tips?: string; totalCalories?: number; type?: 'fast' | 'non-fast' };
      plans[raw.date] = {
        ...raw,
        completedMealIds: raw.completedMealIds || [],
        meals: raw.meals ? await hydratePlannedMeals(raw.meals) : [],
      };
    }));

    // Fallback: legacy plan doc for dates with no day doc (unmigrated users)
    try {
      const legacyDoc = await getDoc(doc(db, 'users', getUserId(), 'data', 'plan'));
      if (legacyDoc.exists()) {
        const legacyData = legacyDoc.data();
        for (let d = parseLocalDate(startDate); d <= parseLocalDate(endDate); d.setDate(d.getDate() + 1)) {
          const dateStr = localDateString(d);
          if (!plans[dateStr] && legacyData[dateStr]) plans[dateStr] = legacyData[dateStr] as DayPlan;
        }
      }
    } catch (e) {
      console.warn("Legacy plan fallback failed:", e);
    }

    for (let d = parseLocalDate(startDate); d <= parseLocalDate(endDate); d.setDate(d.getDate() + 1)) {
      const dateStr = localDateString(d);
      const plan = plans[dateStr] || { date: dateStr, meals: [], completedMealIds: [] };
      plans[dateStr] = withFamilyMeals(plan, familyMeals[dateStr] || []);
      saveToCache(getCacheKey('dayPlan', dateStr), plans[dateStr]);
    }

    return plans;
  } catch (e) {
    console.error("Error fetching day plans in range:", e);
    return {};
  }
};
/**
 * Dates each library recipe is planned on in a range (own days plus family meals), read from
 * the stored references without hydrating recipes. Keyed by recipe id; dates ascending.
 */
export const getRecipePlanDates = async (startDate: string, endDate: string): Promise<Record<string, string[]>> => {
  const dates: Record<string, string[]> = {};
  const add = (date: string, meals: unknown[]) => meals.forEach(raw => {
    const meal = raw as PlannedMeal & { id?: string };
    const id = meal?.type === 'reference' ? meal.recipeId : !meal?.type ? meal?.id : undefined;
    if (id) (dates[id] ||= []).push(date);
  });

  const inRange = (name: string) => query(getCollectionRef(name), where('date', '>=', startDate), where('date', '<=', endDate));
  const groupId = await getMyGroupId();
  const [days, dinners] = await Promise.all([
    getDocs(inRange('days')),
    groupId
      ? getDocs(query(collection(db, 'groups', groupId, 'dinners'), where('date', '>=', startDate), where('date', '<=', endDate))).catch(() => null)
      : Promise.resolve(null),
  ]);
  days.forEach(d => { const data = d.data(); add(data.date, data.meals || []); });
  dinners?.forEach(d => { const data = d.data(); add(data.date, Object.values(data.meals || {})); });

  Object.values(dates).forEach(list => list.sort());
  return dates;
};

// Purely local helper to stitch together a range from existing cache
export const getCachedPlansInRange = (startDate: string, endDate: string): Record<string, DayPlan> | null => {
  const plans: Record<string, DayPlan> = {};
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = localDateString(d);
    const cachedDay = getCachedDayPlan(dateStr);
    if (cachedDay) {
      plans[dateStr] = cachedDay;
    }
  }

  // Return what we have if we have anything
  if (Object.keys(plans).length > 0) return plans;
  return null;
};

/**
 * Fetches DayPlans for all family members for a range of dates (for the shopping list).
 * The user's plan is the base (type, tips, completed meals); other members' meals are added,
 * tagged with their owner. Family meals are included once (also the ones the user isn't eating).
 */
export const getFamilyPlansInRange = async (startDate: string, endDate: string): Promise<Record<string, DayPlan>> => {
  const uid = currentUid();
  if (!uid) return {};

  try {
    const group = await getUserGroup();
    if (!group || group.memberIds.length < 2) return getDayPlansInRange(startDate, endDate);

    const [memberDetails, familyMeals] = await Promise.all([
      getGroupMembersDetails(group.memberIds),
      getFamilyMealsInRange(startDate, endDate),
    ]);
    const memberNameMap = new Map(memberDetails.map(m => [m.id, m.name]));

    const allMemberPlans = await Promise.all(group.memberIds.map(async memberId => {
      const snapshot = await getDocs(query(
        collection(db, 'users', memberId, 'days'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      ));
      const memberPlans: Record<string, DayPlan> = {};
      await Promise.all(snapshot.docs.map(async d => {
        const raw = d.data() as { date: string; meals: PlannedMeal[]; completedMealIds?: string[]; type?: 'fast' | 'non-fast'; tips?: string };
        const meals = raw.meals ? await hydratePlannedMeals(raw.meals) : [];
        memberPlans[raw.date] = {
          ...raw,
          completedMealIds: raw.completedMealIds || [],
          meals: meals.map(meal => ({
            ...meal,
            ownerId: memberId,
            ownerName: memberNameMap.get(memberId) || 'Family member',
            isShared: memberId !== uid,
          })),
        } as DayPlan;
      }));
      return { memberId, memberPlans };
    }));

    const merged: Record<string, DayPlan> = {};
    for (let d = parseLocalDate(startDate); d <= parseLocalDate(endDate); d.setDate(d.getDate() + 1)) {
      const date = localDateString(d);
      merged[date] = { date, meals: [], completedMealIds: [] };
    }

    allMemberPlans.forEach(({ memberId, memberPlans }) => {
      Object.entries(memberPlans).forEach(([date, plan]) => {
        const target = merged[date] || (merged[date] = { date, meals: [], completedMealIds: [] });
        if (memberId === uid) {
          target.type = plan.type;
          target.tips = plan.tips;
          target.completedMealIds.push(...plan.completedMealIds);
        }
        target.meals.push(...plan.meals);
      });
    });

    Object.entries(familyMeals).forEach(([date, meals]) => {
      const target = merged[date] || (merged[date] = { date, meals: [], completedMealIds: [] });
      target.meals.push(...meals);
    });

    return merged;
  } catch (e) {
    console.error("Error fetching family plans:", e);
    return getDayPlansInRange(startDate, endDate);
  }
};

// --- Stats (Weight) ---
// Let's use a subcollection 'data' doc 'stats' for cleaner separation if needed,
// but for now keeping it simple: store on user doc or specific doc.
// Going with 'data/stats' to match other singletons
const STATS_DOC = 'stats';

// Family members see each other's name and avatar through users/{uid}/profile/public. Stats
// (weight history and goals) stay owner-only, so these are copied out whenever they might have changed.
let syncedProfile: { uid: string; json: string } | null = null;
const syncPublicProfile = (stats: Pick<UserStats, 'name' | 'avatar'>) => {
  const uid = getUserId();
  const profile = { name: stats.name?.trim() ?? '', ...(stats.avatar ? { avatar: stats.avatar } : {}) };
  const json = JSON.stringify(profile);
  if (syncedProfile?.uid === uid && syncedProfile.json === json) return;
  syncedProfile = { uid, json };
  setDoc(getDocRef('profile', 'public'), profile).catch(e => {
    syncedProfile = null; // retry on the next load or save
    console.warn('Could not update public profile', e);
  });
};

export const getUserStats = async (): Promise<UserStats> => {
  try {
    const d = await getDoc(getDocRef('data', STATS_DOC));
    if (d.exists()) {
      const stats = d.data() as UserStats;
      // Update Cache
      saveToCache(getCacheKey('stats'), stats);
      syncPublicProfile(stats);
      return stats;
    }
    // Try legacy
    const legacy = localStorage.getItem("fast800_stats");
    if (legacy) return JSON.parse(legacy);

    return DEFAULT_USER_STATS;
  } catch (e) {
    console.error("Error getting user stats", e);
    return DEFAULT_USER_STATS;
  }
};

export const saveUserStats = async (stats: UserStats) => {
  // Optimistic Cache
  saveToCache(getCacheKey('stats'), stats);
  await setDoc(getDocRef('data', STATS_DOC), stats);
  syncPublicProfile(stats);
};


// --- Eating-out history ---
const EATING_OUT_DOC = 'eatingOut';

/** Dishes eaten out before, newest first. */
export const getEatingOutDishes = async (): Promise<EatingOutDish[]> => {
  try {
    const d = await getDoc(getDocRef('data', EATING_OUT_DOC));
    const dishes = d.exists() ? ((d.data().dishes as EatingOutDish[]) ?? []) : [];
    saveToCache(getCacheKey('eatingOutDishes'), dishes);
    return dishes;
  } catch (e) {
    console.error('Error getting eating-out history', e);
    return getCachedEatingOutDishes() ?? [];
  }
};

/** Replace the whole history, after the user edits or deletes entries. */
export const saveEatingOutDishes = async (dishes: EatingOutDish[]) => {
  saveToCache(getCacheKey('eatingOutDishes'), dishes);
  await setDoc(getDocRef('data', EATING_OUT_DOC), { dishes });
};

/** Remember a dish that was eaten (adds it, or counts it again). Returns the new history. */
export const recordEatingOutDish = async (
  entry: { place: string; dish: string; calories: number; protein?: number },
  date: string,
): Promise<EatingOutDish[]> => {
  const current = await getEatingOutDishes();
  const dishes = rememberDish(current, entry, date);
  if (dishes === current) return current;
  saveToCache(getCacheKey('eatingOutDishes'), dishes);
  await setDoc(getDocRef('data', EATING_OUT_DOC), { dishes });
  return dishes;
};


// --- Pantry Inventory ---
const PANTRY_DOC = 'pantry';

export const getPantryInventory = async (): Promise<PantryInventory> => {
  const d = await getDoc(getDocRef('data', PANTRY_DOC));
  return d.exists() ? d.data() as PantryInventory : { items: [], lastUpdated: Date.now() };
};

export const savePantryInventory = async (inventory: PantryInventory) => {
  await setDoc(getDocRef('data', PANTRY_DOC), inventory);
};

export const addToPantry = async (ingredientName: string, persistent: boolean = true) => {
  const inventory = await getPantryInventory();

  const existingIndex = inventory.items.findIndex(item => item.name === ingredientName);
  if (existingIndex >= 0) {
    inventory.items[existingIndex] = {
      name: ingredientName,
      markedAt: Date.now(),
      persistent
    };
  } else {
    inventory.items.push({
      name: ingredientName,
      markedAt: Date.now(),
      persistent
    });
  }

  inventory.lastUpdated = Date.now();
  await savePantryInventory(inventory);
};

export const removeFromPantry = async (ingredientName: string) => {
  const inventory = await getPantryInventory();
  inventory.items = inventory.items.filter(item => item.name !== ingredientName);
  inventory.lastUpdated = Date.now();
  await savePantryInventory(inventory);
};

// Note: This was sync, now async. Usage sites must await.
export const isInPantry = async (ingredientName: string): Promise<boolean> => {
  const inventory = await getPantryInventory();
  return inventory.items.some(item => item.name === ingredientName);
};

// --- Enhanced Shopping State ---
const SHOPPING_DOC = 'shopping';

export const getEnhancedShoppingState = async (): Promise<EnhancedShoppingState> => {
  const d = await getDoc(getDocRef('data', SHOPPING_DOC));
  return d.exists() ? d.data() as EnhancedShoppingState : {
    pantryChecks: {},
    purchased: [],
    removed: [],
    lastGeneratedDate: '',
    cachedPurchasableItems: [],
    cachedParsedIngredients: [],
    cachedAggregatedIngredients: [],
    ingredientsHash: '',
    selectedMealIds: []
  };
};

export const saveEnhancedShoppingState = async (state: EnhancedShoppingState) => {
  await setDoc(getDocRef('data', SHOPPING_DOC), state);
};

export const migrateShoppingState = async () => {
  // Can't easily migrate old sync local storage here efficiently without reading it.
  // We assume migration happens via 'sync data' feature.
};

// --- Daily Logs ---
// Using a collection 'logs' where docId = date
/** Food items logged since a date (inclusive), oldest day first. */
export const getFoodItemsSince = async (startDate: string): Promise<FoodLogItem[]> => {
  const snapshot = await getDocs(query(getCollectionRef('logs'), where('date', '>=', startDate), orderBy('date', 'asc')));
  return snapshot.docs.flatMap(d => (d.data() as DailyLog).items || []);
};

export const getDailyLog = async (date: string): Promise<DailyLog> => {
  try {
    const d = await getDoc(getDocRef('logs', date));
    if (d.exists()) {
      const log = d.data() as DailyLog;
      if (!log.workouts) log.workouts = [];
      if (typeof log.waterIntake === 'undefined') log.waterIntake = 0;

      // Update Cache
      saveToCache(getCacheKey('dailyLog', date), log);
      return log;
    }
    const emptyLog = { date, items: [], workouts: [], waterIntake: 0 };
    saveToCache(getCacheKey('dailyLog', date), emptyLog);
    return emptyLog;
  } catch (e) {
    console.error("Error getting daily log", e);
    return { date, items: [], workouts: [], waterIntake: 0 };
  }
};

export const saveDailyLog = async (log: DailyLog) => {
  // Optimistic Cache
  const normalized: DailyLog = { ...log };
  normalized.workouts = normalized.workouts || [];
  normalized.waterIntake = typeof normalized.waterIntake === 'number' ? normalized.waterIntake : 0;
  saveToCache(getCacheKey('dailyLog', normalized.date), normalized);
  await setDoc(getDocRef('logs', normalized.date), normalized);
};

// --- Daily Summaries ---

/**
 * @deprecated Use getDailySummaries() instead (reads from optimized summaries collection)
 */
export const getAllDailySummaries = async (daysBack: number = 90): Promise<DailySummary[]> => {
  console.warn('getAllDailySummaries is deprecated, use getDailySummaries instead');
  return getDailySummaries(daysBack);
};

export const getRecentWorkouts = async (limitCount: number = 5, daysBack: number = 30): Promise<WorkoutItem[]> => {
  // Only fetch recent logs to avoid loading all historical data
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffDateString = localDateString(cutoffDate);

  const logsQuery = query(
    getCollectionRef('logs'),
    where('date', '>=', cutoffDateString),
    orderBy('date', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(logsQuery);
  const allWorkouts: WorkoutItem[] = [];

  snapshot.forEach(doc => {
    const log = doc.data() as DailyLog;
    if (log.workouts) {
      allWorkouts.push(...log.workouts);
    }
  });

  // Sort by timestamp descending
  allWorkouts.sort((a, b) => b.timestamp - a.timestamp);

  // Deduplicate by type (keeping most recent)
  const uniqueWorkouts = new Map<string, WorkoutItem>();
  allWorkouts.forEach(w => {
    const key = w.type.toLowerCase().trim();
    if (!uniqueWorkouts.has(key)) {
      uniqueWorkouts.set(key, w);
    }
  });

  return Array.from(uniqueWorkouts.values()).slice(0, limitCount);
};

// ... (Daily Summaries omitted as they are typically historical)

// --- Guidance read state ---
const COACH_DOC = 'coach';

export const getCoachRead = async (): Promise<CoachReadState> => {
  try {
    const d = await getDoc(getDocRef('data', COACH_DOC));
    const read: CoachReadState = d.exists() ? (d.data().read ?? {}) : {};
    saveToCache(getCacheKey('coachRead'), read);
    return read;
  } catch (e) {
    console.error("Error getting guidance read state", e);
    return {};
  }
};

export const saveCoachRead = async (read: CoachReadState) => {
  saveToCache(getCacheKey('coachRead'), read);
  await setDoc(getDocRef('data', COACH_DOC), { read });
};

// --- Fasting ---
const FASTING_DOC = 'fasting';
const FASTING_HISTORY_DOC = 'fasting_history'; // Actually maybe a collection?
// History is array in localStorage. Let's keep it as an array in a doc for now.

export const getFastingState = async (): Promise<FastingState> => {
  try {
    const d = await getDoc(getDocRef('data', FASTING_DOC));

    if (d.exists()) {
      const data = d.data() as any;

      // Migration: Convert old format to new
      if ('isFasting' in data || 'startTime' in data || 'endTime' in data) {
        console.log('Migrating old fasting state format to new lastAteTime format...');

        const newState: FastingState = {
          // If they were fasting, assume they ate before starting the fast
          // If they were in eating window, use endTime as last ate time
          lastAteTime: data.endTime || (data.startTime ? data.startTime - (60 * 60 * 1000) : null),
          config: data.config || { protocol: '16:8', targetFastHours: 16 }
        };

        // Save migrated state
        await saveFastingState(newState);
        return newState;
      }

      return data as FastingState;
    }

    const defaultState: FastingState = {
      lastAteTime: null,
      config: { protocol: '16:8', targetFastHours: 16 }
    };
    saveToCache(getCacheKey('fasting'), defaultState);
    return defaultState;
  } catch (e) {
    console.error("Error getting fasting state", e);
    return {
      lastAteTime: null,
      config: { protocol: '16:8', targetFastHours: 16 }
    };
  }
};

export const saveFastingState = async (state: FastingState) => {
  // Optimistic Cache
  saveToCache(getCacheKey('fasting'), state);
  await setDoc(getDocRef('data', FASTING_DOC), state);
};

export const getFastingHistory = async (): Promise<FastingEntry[]> => {
  const d = await getDoc(getDocRef('data', FASTING_HISTORY_DOC));
  return d.exists() ? (d.data() as any).entries || [] : [];
};

export const addFastingEntry = async (entry: FastingEntry) => {
  const history = await getFastingHistory();
  history.push(entry);
  await setDoc(getDocRef('data', FASTING_HISTORY_DOC), { entries: history });
};


// --- Migration Helper ---

export const getLocalStorageDebugInfo = () => {
  const keys = [
    "fast800_recipes",
    "fast800_plan",
    "fast800_stats",
    "fast800_enhanced_shopping",
    "fast800_pantry",
    "fast800_logs",
    "fast800_fasting_state",
    "fast800_fasting_history"
  ];

  const info: Record<string, string> = {};

  keys.forEach(key => {
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          info[key] = `Found (${parsed.length} items)`;
        } else if (typeof parsed === 'object') {
          info[key] = `Found (${Object.keys(parsed).length} keys)`;
        } else {
          info[key] = "Found";
        }
      } catch (e) {
        info[key] = "Error parsing";
      }
    } else {
      info[key] = "Missing";
    }
  });

  return info;
};

// Call this once on login if account is new/empty, or if forced
export const migrateFromLocalStorage = async (force: boolean = false): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if we already have data (unless forced)
    if (!force) {
      // OPTIMIZATION: Check local cache first to avoid hanging on network requests during startup
      // This is critical for users on restricted networks (e.g. Work Wi-Fi) where Firestore might time out
      const cachedStats = getCachedUserStats();
      if (cachedStats && cachedStats.currentWeight !== 0 && cachedStats.currentWeight !== DEFAULT_USER_STATS.currentWeight) {
        console.log("Data exists in Local Cache, skipping migration.");
        return { success: true };
      }

      // If no cache, try Firestore (this might hang if network is bad, but unavoidable for first run)
      const stats = await getUserStats();
      if (stats.currentWeight !== 0 && stats.currentWeight !== DEFAULT_USER_STATS.currentWeight) {
        console.log("Data exists in Firestore, skipping migration.");
        return { success: true };
      }
    }

    console.log(`Starting migration from local storage (Force: ${force})...`);


    // Recipes
    try {
      const storedRecipes = localStorage.getItem("fast800_recipes");
      if (storedRecipes) {
        const recipes = JSON.parse(storedRecipes);
        console.log(`Migrating ${recipes.length} recipes...`);
        for (const r of recipes) {
          await saveRecipe(r);
        }
      }
    } catch (e) { console.error("Error migrating recipes:", e); }

    // Plan
    try {
      const storedPlan = localStorage.getItem("fast800_plan");
      if (storedPlan) {
        const plan = JSON.parse(storedPlan);
        console.log(`Migrating plan...`);
        const ref = getDocRef('data', PLAN_DOC);
        await setDoc(ref, plan, { merge: true }); // Plan is Record<string, DayPlan>
      }
    } catch (e) { console.error("Error migrating plan:", e); }

    // Stats
    try {
      const storedStats = localStorage.getItem("fast800_stats");
      if (storedStats) {
        console.log(`Migrating stats...`);
        await saveUserStats(JSON.parse(storedStats));
      }
    } catch (e) { console.error("Error migrating stats:", e); }

    // Shopping
    try {
      const storedShopping = localStorage.getItem("fast800_enhanced_shopping");
      if (storedShopping) {
        console.log(`Migrating shopping list...`);
        await saveEnhancedShoppingState(JSON.parse(storedShopping));
      }
    } catch (e) { console.error("Error migrating shopping:", e); }

    // Pantry
    try {
      const storedPantry = localStorage.getItem("fast800_pantry");
      if (storedPantry) {
        console.log(`Migrating pantry...`);
        await savePantryInventory(JSON.parse(storedPantry));
      }
    } catch (e) { console.error("Error migrating pantry:", e); }

    // Logs
    try {
      const storedLogs = localStorage.getItem("fast800_logs");
      if (storedLogs) {
        const logs = JSON.parse(storedLogs);
        console.log(`Migrating ${Object.keys(logs).length} daily logs...`);
        for (const date in logs) {
          await saveDailyLog(logs[date]);
        }
      }
    } catch (e) { console.error("Error migrating logs:", e); }

    // Fasting
    try {
      const storedFasting = localStorage.getItem("fast800_fasting_state");
      if (storedFasting) {
        console.log(`Migrating fasting state...`);
        await saveFastingState(JSON.parse(storedFasting));
      }
      const storedHistory = localStorage.getItem("fast800_fasting_history");
      if (storedHistory) {
        console.log(`Migrating fasting history...`);
        await setDoc(getDocRef('data', FASTING_HISTORY_DOC), { entries: JSON.parse(storedHistory) });
      }
    } catch (e) { console.error("Error migrating fasting:", e); }

    console.log("Migration complete.");
    return { success: true };
  } catch (e: any) {
    console.error("FATAL: Error during migration process", e);
    return { success: false, error: e.message || "Unknown error" };
  }
};

// Every doc in one of the user's collections, keyed by doc id (dates for
// days, logs and summaries).
const getCollectionDocs = async (name: string): Promise<Record<string, DocumentData>> => {
  const snapshot = await getDocs(getCollectionRef(name));
  const docs: Record<string, DocumentData> = {};
  snapshot.forEach(d => { docs[d.id] = d.data(); });
  return docs;
};

export const exportAllData = async (): Promise<string> => {
  try {
    const [stats, recipes, days, logs, summaries, shopping, pantry, fasting, fastingHistory] = await Promise.all([
      getUserStats(),
      getRecipes(),
      // Stored as-is (PlannedMeal references); the recipes above resolve them.
      getCollectionDocs('days'),
      // Full logs exist only for days not yet archived into summaries.
      getCollectionDocs('logs'),
      getCollectionDocs('summaries'),
      getDoc(getDocRef('data', SHOPPING_DOC)).then(d => d.exists() ? d.data() : null),
      getDoc(getDocRef('data', PANTRY_DOC)).then(d => d.exists() ? d.data() : null),
      getDoc(getDocRef('data', FASTING_DOC)).then(d => d.exists() ? d.data() : null),
      getFastingHistory(),
    ]);

    const exportData = {
      stats,
      recipes,
      days,
      logs,
      summaries,
      shopping,
      pantry,
      fasting,
      fastingHistory,
      version: 2,
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  } catch (e) {
    console.error("Export failed:", e);
    return "";
  }
};

// --- Daily Log Archival (Database Normalization) ---

/** The lightweight summary kept for a finished day (analytics, streaks, burn estimate). */
const summarizeLog = (log: DailyLog): DailySummary => {
  const items = log.items || [];
  const workouts = log.workouts || [];
  const caloriesConsumed = items.reduce((sum, item) => sum + (item.calories || 0), 0);
  const caloriesBurned = workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  const withProtein = items.filter(item => typeof item.protein === 'number');
  return {
    date: log.date,
    caloriesConsumed,
    caloriesBurned,
    netCalories: caloriesConsumed - caloriesBurned,
    workoutCount: workouts.length,
    workoutTypes: Array.from(new Set(workouts.map(w => w.type))),
    waterIntake: log.waterIntake || 0,
    maxFastingHours: log.maxFastingHours || 0,
    ...(withProtein.length ? { proteinConsumed: Math.round(withProtein.reduce((sum, item) => sum + (item.protein || 0), 0)) } : {}),
    ...(log.status ? { status: log.status } : {}),
  };
};

/**
 * Archives yesterday's full DailyLog into a lightweight DailySummary.
 * This compresses historical data by 95% (removes item and workout arrays).
 * Should be called once per day (e.g., at midnight or on first app load of new day).
 */
export const archiveYesterdaysLog = async (): Promise<{ archived: boolean; date?: string; itemCount?: number }> => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = localDateString(yesterday);

    // 1. Check if already archived
    const summaryRef = getDocRef('summaries', dateStr);
    const summarySnap = await getDoc(summaryRef);
    if (summarySnap.exists()) {
      console.log(`${dateStr} already archived`);
      return { archived: false };
    }

    // 2. Load full log
    const log = await getDailyLog(dateStr);

    // Skip if no data exists
    if (log.items.length === 0 && log.workouts.length === 0 && log.waterIntake === 0) {
      console.log(`${dateStr} has no data to archive`);
      return { archived: false };
    }

    // 3. Compute summary
    const summary = summarizeLog({ ...log, date: dateStr });

    // 4. Save summary to new collection
    await setDoc(summaryRef, summary);

    // 5. Delete full log (items + workouts arrays)
    const logRef = getDocRef('logs', dateStr);
    await deleteDoc(logRef);

    console.log(`✅ Archived ${dateStr}: ${log.items.length} food items + ${log.workouts.length} workouts → summary`);
    return { archived: true, date: dateStr, itemCount: log.items.length };
  } catch (e) {
    console.error("Archival failed:", e);
    return { archived: false };
  }
};

/**
 * Get daily summaries from the new lightweight 'summaries' collection.
 * Falls back to computing from 'logs' if summary doesn't exist (for today or unmigrated data).
 */
export const getDailySummaries = async (daysBack: number = 90): Promise<DailySummary[]> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffDateString = localDateString(cutoffDate);

    // 1. Fetch from summaries collection (new, lightweight)
    const summariesQuery = query(
      getCollectionRef('summaries'),
      where('date', '>=', cutoffDateString),
      orderBy('date', 'asc')
    );
    const summariesSnap = await getDocs(summariesQuery);
    const summariesMap = new Map<string, DailySummary>();
    summariesSnap.forEach(doc => {
      const summary = doc.data() as DailySummary;
      summariesMap.set(summary.date, summary);
    });

    // 2. Fetch from logs collection (fallback for today and unmigrated data)
    const logsQuery = query(
      getCollectionRef('logs'),
      where('date', '>=', cutoffDateString),
      orderBy('date', 'asc')
    );
    const logsSnap = await getDocs(logsQuery);

    logsSnap.forEach(doc => {
      const log = doc.data() as DailyLog;
      // Only compute if we don't have a summary yet; a stored summary still takes the day's status
      const stored = summariesMap.get(log.date);
      if (!stored) summariesMap.set(log.date, summarizeLog(log));
      else if (log.status) summariesMap.set(log.date, { ...stored, status: log.status });
    });

    // 3. Return sorted array
    return Array.from(summariesMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.error("Error fetching daily summaries:", e);
    return [];
  }
};

/**
 * Migrates ALL historical logs to summaries (run once during deployment).
 */
export const migrateAllLogsToSummaries = async (): Promise<{ success: boolean; migratedCount: number; error?: string }> => {
  try {
    const logsSnap = await getDocs(getCollectionRef('logs'));
    const today = localDateString();

    let migratedCount = 0;

    for (const logDoc of logsSnap.docs) {
      const log = logDoc.data() as DailyLog;

      // Skip today (keep full detail)
      if (log.date === today) {
        console.log(`Skipping ${log.date} (today)`);
        continue;
      }

      // Check if already has summary
      const summarySnap = await getDoc(getDocRef('summaries', log.date));
      if (summarySnap.exists()) {
        console.log(`Skipping ${log.date} (already archived)`);
        continue;
      }

      // Compute and save summary
      const summary = summarizeLog(log);

      await setDoc(getDocRef('summaries', log.date), summary);
      await deleteDoc(logDoc.ref);

      migratedCount++;
      console.log(`Migrated ${log.date}: ${log.items?.length || 0} items → summary`);
    }

    console.log(`✅ Migration complete: ${migratedCount} logs archived`);
    return { success: true, migratedCount };
  } catch (e: any) {
    console.error("Migration failed:", e);
    return { success: false, migratedCount: 0, error: e.message };
  }
};

export const importAllData = async (jsonString: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const data = JSON.parse(jsonString);
    console.log("Importing data...", data);

    if (!data || typeof data !== 'object') {
      throw new Error("Invalid JSON structure: Root must be an object");
    }

    if (data.stats) await saveUserStats(data.stats);

    if (data.recipes && Array.isArray(data.recipes)) {
      for (const r of data.recipes) {
        await saveRecipe(r);
      }
    }

    // Version 1 backups: legacy single plan doc
    if (data.plan) {
      await setDoc(getDocRef('data', PLAN_DOC), data.plan);
    }

    if (data.days) {
      for (const date in data.days) {
        await setDoc(getDocRef('days', date), data.days[date]);
      }
    }

    if (data.logs) {
      for (const date in data.logs) {
        await saveDailyLog(data.logs[date]);
      }
    }

    if (data.summaries) {
      for (const date in data.summaries) {
        await setDoc(getDocRef('summaries', date), data.summaries[date]);
      }
    }

    if (data.shopping) await saveEnhancedShoppingState(data.shopping);
    if (data.pantry) await savePantryInventory(data.pantry);
    if (data.fasting) await saveFastingState(data.fasting);
    if (Array.isArray(data.fastingHistory)) {
      await setDoc(getDocRef('data', FASTING_HISTORY_DOC), { entries: data.fastingHistory });
    }

    console.log("Import complete");
    return { success: true };
  } catch (e: any) {
    console.error("Import failed:", e);
    return { success: false, error: e.message || "Unknown import error" };
  }
};
