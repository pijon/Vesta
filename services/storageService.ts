import { Recipe, DayPlan, UserStats, ShoppingState, DailyLog, PantryInventory, EnhancedShoppingState, FastingState, FastingEntry, DailySummary, WorkoutItem, PlannedMeal, RecipeReference, CustomMealInstance } from "../types";
import { DEFAULT_USER_STATS } from "../constants";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit } from "firebase/firestore";

// Helper to get current user ID or throw
const getUserId = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
};

// Helper for references
const getUserRef = () => doc(db, 'users', getUserId());
const getCollectionRef = (name: string) => collection(db, 'users', getUserId(), name);
const getDocRef = (collectionName: string, docId: string) => doc(db, 'users', getUserId(), collectionName, docId);

export const getUserData = async () => {
  const userDoc = await getDoc(getUserRef());
  return userDoc.data();
};

// --- Recipes ---
// Saved as individual documents in 'recipes' collection
// Saved as individual documents in 'recipes' collection
export const getRecipes = async (limitCount?: number): Promise<Recipe[]> => {
  try {
    let q;
    if (limitCount) {
      q = query(getCollectionRef('recipes'), limit(limitCount));
    } else {
      q = getCollectionRef('recipes');
    }

    const snapshot = await getDocs(q);
    let recipes = snapshot.docs.map(doc => {
      const data = doc.data() as any;
      // Migration on read: If tags are missing but type exists, convert type to tags
      if (!data.tags && data.type) {
        // Normalize meal types to tags
        let tag = data.type;
        if (tag === 'lunch' || tag === 'dinner') tag = 'main meal';
        return { ...data, tags: [tag] } as Recipe;
      }
      return data as Recipe;
    });

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
  await setDoc(getDocRef('recipes', recipe.id), recipe);
};

export const deleteRecipe = async (id: string) => {
  await deleteDoc(getDocRef('recipes', id));
};

// --- Base64 Image Migration (Database Normalization) ---

import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
          await setDoc(getDocRef('recipes', recipe.id), updatedRecipe);

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
 * - If meal is from library: store reference only
 * - If meal is custom: store minimal data
 */
const dehydrateMeal = (meal: Recipe): PlannedMeal => {
  // Check if this is a library recipe (has originalRecipeId or id matching library)
  const isLibraryRecipe = !!meal.originalRecipeId || (!!meal.id && meal.description !== 'Eat Out / Custom Meal');

  if (isLibraryRecipe) {
    // Store as RecipeReference
    const reference: RecipeReference = {
      type: 'reference',
      recipeId: meal.originalRecipeId || meal.id!,
      servings: meal.servings || 1
    };

    // Add overrides ONLY if user customized this instance
    // (We detect this if the meal has been manually edited)
    // For now, we'll skip overrides detection - can add later if needed

    return reference;
  } else {
    // Store as CustomMealInstance (one-off meal)
    const custom: CustomMealInstance = {
      type: 'custom',
      id: meal.id || crypto.randomUUID(),
      name: meal.name,
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      tags: meal.tags || [],
      servings: meal.servings || 1
    };

    return custom;
  }
};

// Helper to get a single recipe
export const getRecipe = async (id: string): Promise<Recipe | null> => {
  try {
    const docSnap = await getDoc(getDocRef('recipes', id));
    if (docSnap.exists()) return docSnap.data() as Recipe;
    return null;
  } catch (e) {
    console.error(`Error fetching recipe ${id}`, e);
    return null;
  }
};

// Helper to re-attach fields from library
const hydrateMeals = async (meals: Recipe[]): Promise<Recipe[]> => {
  if (!meals || meals.length === 0) return [];

  // 1. Identify meals that need hydration
  // We identify them if they have an ID and are missing 'instructions' or 'ingredients'
  const mealsToHydrate = meals.filter(m =>
    !!m.id &&
    m.description !== 'Eat Out / Custom Meal' &&
    (!m.instructions || m.instructions.length === 0 || !m.image)
    // ^ check for image too, as that's what we essentially want
  );

  // Optimization: If nothing needs hydration, return immediately
  if (mealsToHydrate.length === 0) return meals;

  // 2. Fetch specific recipes in parallel
  // Deduplicate IDs first: prefer originalRecipeId, fallback to id
  const idsToFetch = new Set<string>();
  mealsToHydrate.forEach(m => {
    if (m.originalRecipeId) idsToFetch.add(m.originalRecipeId);
    else if (m.id) idsToFetch.add(m.id);
  });
  const uniqueIds = Array.from(idsToFetch);

  // Fetch from DB (Promise.all)
  // TODO: Add a simple in-memory cache here if we find we are re-fetching same IDs frequently in a session
  console.log(`Hydrating ${uniqueIds.length} recipes...`);

  const fetchedRecipes = await Promise.all(
    uniqueIds.map(async id => {
      const r = await getRecipe(id);
      return r;
    })
  );

  const recipeMap = new Map();
  fetchedRecipes.forEach(r => {
    if (r) recipeMap.set(r.id, r);
  });

  // 3. Merge
  return meals.map(meal => {
    // If it has instructions, it's already full (or custom)
    if (meal.instructions && meal.instructions.length > 0) return meal;
    if (meal.description === 'Eat Out / Custom Meal') return meal;

    const lookupId = meal.originalRecipeId || meal.id;
    const original = recipeMap.get(lookupId);
    if (original) {
      // Merge: Original props + Overrides from the plan
      return {
        ...original,
        ...meal, // Overrides from plan
        ingredients: original.ingredients,
        instructions: original.instructions,
        image: original.image,
        description: original.description
      };
    }

    // If original not found (deleted?), keep what we have
    return meal;
  });
};

export const getDayPlan = async (date: string): Promise<DayPlan> => {
  try {
    const docRef = doc(db, 'users', getUserId(), 'days', date);
    const dayDoc = await getDoc(docRef);

    if (dayDoc.exists()) {
      const storedPlan = dayDoc.data() as DayPlan;

      // Hydrate PlannedMeal[] to Recipe[] for UI
      const hydratedMeals = storedPlan.meals ? await hydrateMeals(storedPlan.meals) : [];

      // Return plan with hydrated meals
      return {
        ...storedPlan,
        meals: hydratedMeals as any  // Temporary cast - UI expects Recipe[]
      };
    }

    // 2. Fallback to legacy (if not found in new, and legacy exists)
    // We don't want to load the huge blob on every missing day, but for migration safety:
    // Ideally we migrate once. For now, let's return empty and rely on a global migration.
    return { date, meals: [], completedMealIds: [] };
  } catch (e) {
    console.error("Error getting day plan:", e);
    return { date, meals: [], completedMealIds: [] };
  }
};


export const saveDayPlan = async (dayPlan: DayPlan) => {
  const docRef = doc(db, 'users', getUserId(), 'days', dayPlan.date);

  // Runtime conversion: Convert Recipe[] to PlannedMeal[] before saving
  const dehydratedMeals = dayPlan.meals.map(dehydrateMeal);
  const planToSave = { ...dayPlan, meals: dehydratedMeals };

  await setDoc(docRef, planToSave);
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

// Migration Helper
export const migrateLegacyPlanToCollection = async () => {
  try {
    const legacyRef = getDocRef('data', 'plan');
    const legacyDoc = await getDoc(legacyRef);

    if (legacyDoc.exists()) {
      const data = legacyDoc.data();
      console.log("Migrating legacy plan data...", Object.keys(data).length, "days found.");

      const batchSize = 100; // Firestore batch limit is 500
      const entries = Object.entries(data);

      // Process in chunks to avoid blowing up memory/batch limits
      for (let i = 0; i < entries.length; i += 50) {
        // We can just use Promise.all for parallel writes, simplest for now
        const chunk = entries.slice(i, i + 50);
        await Promise.all(chunk.map(async ([date, plan]) => {
          // Ensure it's a valid plan object
          if (date && (plan as DayPlan).meals) {
            const docRef = doc(db, 'users', getUserId(), 'days', date);
            await setDoc(docRef, plan as DayPlan);
          }
        }));
        console.log(`Migrated chunk ${i} - ${i + 50}`);
      }

      console.log("Migration finished. Deleting legacy doc.");
      await deleteDoc(legacyRef);
      return { success: true };
    }
    return { success: true, message: "No legacy data found" };
  } catch (e: any) {
    console.error("Migration failed:", e);
    return { success: false, error: e.message };
  }
};

// Helper to get plan for a range of dates (upcoming week)
export const getUpcomingPlan = async (days: number = 7): Promise<Record<string, DayPlan>> => {
  const plans: Record<string, DayPlan> = {};
  const today = new Date();

  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Fetch in parallel
  await Promise.all(dates.map(async date => {
    // getDayPlan handles hydration internally now
    const p = await getDayPlan(date);
    if (p.meals && p.meals.length > 0) {
      plans[date] = p;
    }
  }));

  return plans;
};

// Helper to get plan for a range of dates (efficient batch fetch)
export const getDayPlansInRange = async (startDate: string, endDate: string): Promise<Record<string, DayPlan>> => {
  try {
    const plans: Record<string, DayPlan> = {};
    const q = query(
      getCollectionRef('days'),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );

    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
      const plan = doc.data() as DayPlan;
      plans[plan.date] = plan;
    });

    // Bulk Hydration - Optimization
    // Instead of hydrating each isolated plan (which might re-fetch recipes N times),
    // we could collect all meals and hydrate once. 
    // However, for simplicity and since getRecipes likely caches/uses Firestore SDK cache, we will simply iterate.
    // NOTE: getDayPlan above handles single day hydration. Here we loaded raw data from query.
    // We MUST hydrate these plans.

    // Gather all all meals from all plans
    const allMeals: Recipe[] = [];
    Object.values(plans).forEach(p => {
      if (p.meals) allMeals.push(...p.meals);
    });

    // If we have any meals, let's pre-fetch library once to be efficient
    let allRecipes: Recipe[] = [];
    if (allMeals.length > 0) {
      try {
        allRecipes = await getRecipes();
      } catch (e) { console.warn("Hydration pre-fetch failed", e); }
    }
    const recipeMap = new Map(allRecipes.map(r => [r.id, r]));

    // Now hydrate in memory using the map directly to avoid N calls
    Object.values(plans).forEach(p => {
      if (p.meals) {
        p.meals = p.meals.map(meal => {
          if (meal.instructions && meal.instructions.length > 0) return meal;
          if (meal.description === 'Eat Out / Custom Meal') return meal;

          const lookupId = meal.originalRecipeId || meal.id;
          const original = recipeMap.get(lookupId);
          if (original) {
            return {
              ...original,
              ...meal,
              ingredients: original.ingredients,
              instructions: original.instructions,
              image: original.image, // Ensure image is restored
              description: original.description
            };
          }
          return meal;
        });
      }
    });

    // Fallback: Check legacy plan doc for missing dates in range
    // This ensures users with unmigrated data still see correct Day Types
    try {
      const legacyDoc = await getDoc(doc(db, 'users', getUserId(), 'data', 'plan'));
      if (legacyDoc.exists()) {
        const legacyData = legacyDoc.data();
        const start = new Date(startDate);
        const end = new Date(endDate);

        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          // Only use legacy if we don't have a new plan AND legacy has data
          if (!plans[dateStr] && legacyData[dateStr]) {
            plans[dateStr] = legacyData[dateStr] as DayPlan;
          }
        }
      }
    } catch (e) {
      console.warn("Legacy plan fallback failed:", e);
    }

    // Fallback: Default to 'fast' day if no data exists
    // Policy: "Default is a fast day"
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      if (!plans[dateStr]) {
        // No plan exists -> Default to Fast Day
        plans[dateStr] = {
          date: dateStr,
          meals: [],
          completedMealIds: [],
          type: 'fast'
        };
      } else if (!plans[dateStr].type) {
        // Plan exists but no type set -> Default to Fast Day
        plans[dateStr].type = 'fast';
      }
    }

    return plans;
  } catch (e) {
    console.error("Error fetching day plans in range:", e);
    return {};
  }
};

// Deprecated: Used only for explicit exports or legacy checks
export const getWeeklyPlan = async (): Promise<Record<string, DayPlan>> => {
  // Use collection fetch (careful with size)
  // For export purposes, we might need a range.
  return getUpcomingPlan(14); // Return 2 weeks just in case
};

// --- Stats (Weight) ---
const STATS_DOC = 'stats';
export const getUserStats = async (): Promise<UserStats> => {
  const d = await getDoc(getDocRef('data', STATS_DOC));
  if (d.exists()) {
    const stats = d.data() as UserStats;
    if (typeof stats.dailyWaterGoal === 'undefined') {
      stats.dailyWaterGoal = DEFAULT_USER_STATS.dailyWaterGoal;
    }
    return stats;
  }
  return DEFAULT_USER_STATS;
};

export const saveUserStats = async (stats: UserStats) => {
  await setDoc(getDocRef('data', STATS_DOC), stats);
};

// --- Shopping List State ---
// Obsolete? 'migrateShoppingState' handles migration. 
// We likely only care about EnhancedShoppingState now.
export const getShoppingState = async (): Promise<ShoppingState> => {
  // Legacy support not strictly needed if we migrate
  return { checked: [], removed: [] };
};

export const saveShoppingState = async (state: ShoppingState) => {
  // No-op
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
export const getDailyLog = async (date: string): Promise<DailyLog> => {
  const d = await getDoc(getDocRef('logs', date));
  if (d.exists()) {
    const log = d.data() as DailyLog;
    if (!log.workouts) log.workouts = [];
    if (typeof log.waterIntake === 'undefined') log.waterIntake = 0;
    return log;
  }
  return { date, items: [], workouts: [], waterIntake: 0 };
};

export const saveDailyLog = async (log: DailyLog) => {
  await setDoc(getDocRef('logs', log.date), log);
};

// --- Daily Summaries ---

/**
 * @deprecated Use getDailySummaries() instead (reads from optimized summaries collection)
 */
export const getAllDailySummaries = async (daysBack: number = 90): Promise<DailySummary[]> => {
  console.warn('getAllDailySummaries is deprecated, use getDailySummaries instead');
  return getDailySummaries(daysBack);
};

export const getRecentWorkouts = async (limit: number = 5, daysBack: number = 30): Promise<WorkoutItem[]> => {
  // Only fetch recent logs to avoid loading all historical data
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];

  const logsQuery = query(
    getCollectionRef('logs'),
    where('date', '>=', cutoffDateString),
    orderBy('date', 'desc')
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

  return Array.from(uniqueWorkouts.values()).slice(0, limit);
};

// --- Fasting ---
const FASTING_DOC = 'fasting';
const FASTING_HISTORY_DOC = 'fasting_history'; // Actually maybe a collection?
// History is array in localStorage. Let's keep it as an array in a doc for now.

export const getFastingState = async (): Promise<FastingState> => {
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

  return {
    lastAteTime: null,
    config: { protocol: '16:8', targetFastHours: 16 }
  };
};

export const saveFastingState = async (state: FastingState) => {
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
      const stats = await getUserStats();
      // Simple check: if weight is not 0 (default), assume data exists
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

export const exportAllData = async (): Promise<string> => {
  try {
    const stats = await getUserStats();

    // Fetch Recipes
    const recipesSnapshot = await getDocs(collection(db, `users/${auth.currentUser?.uid}/recipes`));
    const recipes = recipesSnapshot.docs.map(d => d.data());

    // Fetch Plan (Single Doc)
    const planRef = getDocRef('data', PLAN_DOC);
    const planSnapshot = await getDoc(planRef);
    const plan = planSnapshot.exists() ? planSnapshot.data() : {};

    // Fetch Logs (Collection)
    const logsSnapshot = await getDocs(collection(db, `users/${auth.currentUser?.uid}/daily_logs`));
    const logs: Record<string, any> = {};
    logsSnapshot.forEach(d => { logs[d.id] = d.data(); });

    // Fetch Shopping State
    const shoppingRef = getDocRef('data', SHOPPING_DOC);
    const shoppingSnapshot = await getDoc(shoppingRef);
    const shopping = shoppingSnapshot.exists() ? shoppingSnapshot.data() : null;

    // Fetch Pantry
    const pantryRef = getDocRef('data', PANTRY_DOC);
    const pantrySnapshot = await getDoc(pantryRef);
    const pantry = pantrySnapshot.exists() ? pantrySnapshot.data() : [];

    // Fetch Fasting
    const fastingRef = getDocRef('data', FASTING_DOC);
    const fastingSnapshot = await getDoc(fastingRef);
    const fasting = fastingSnapshot.exists() ? fastingSnapshot.data() : null;

    const exportData = {
      stats,
      recipes,
      plan,
      logs,
      shopping,
      pantry,
      fasting,
      version: 1,
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  } catch (e) {
    console.error("Export failed:", e);
    return "";
  }
};

// --- Daily Log Archival (Database Normalization) ---

/**
 * Archives yesterday's full DailyLog into a lightweight DailySummary.
 * This compresses historical data by 95% (removes item and workout arrays).
 * Should be called once per day (e.g., at midnight or on first app load of new day).
 */
export const archiveYesterdaysLog = async (): Promise<{ archived: boolean; date?: string; itemCount?: number }> => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

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
    const caloriesConsumed = log.items.reduce((sum, item) => sum + item.calories, 0);
    const caloriesBurned = log.workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);

    const summary: DailySummary = {
      date: dateStr,
      caloriesConsumed,
      caloriesBurned,
      netCalories: caloriesConsumed - caloriesBurned,
      workoutCount: log.workouts.length,
      waterIntake: log.waterIntake,
      maxFastingHours: log.maxFastingHours
    };

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
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

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
      // Only compute if we don't have a summary yet
      if (!summariesMap.has(log.date)) {
        const caloriesConsumed = (log.items || []).reduce((sum, item) => sum + item.calories, 0);
        const caloriesBurned = (log.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);

        summariesMap.set(log.date, {
          date: log.date,
          caloriesConsumed,
          caloriesBurned,
          netCalories: caloriesConsumed - caloriesBurned,
          workoutCount: (log.workouts || []).length,
          waterIntake: log.waterIntake || 0,
          maxFastingHours: log.maxFastingHours || 0
        });
      }
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
    const today = new Date().toISOString().split('T')[0];

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
      const caloriesConsumed = (log.items || []).reduce((sum, item) => sum + item.calories, 0);
      const caloriesBurned = (log.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);

      const summary: DailySummary = {
        date: log.date,
        caloriesConsumed,
        caloriesBurned,
        netCalories: caloriesConsumed - caloriesBurned,
        workoutCount: (log.workouts || []).length,
        waterIntake: log.waterIntake || 0,
        maxFastingHours: log.maxFastingHours || 0
      };

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

    if (data.plan) {
      await setDoc(getDocRef('data', PLAN_DOC), data.plan);
    }

    if (data.logs) {
      for (const date in data.logs) {
        await saveDailyLog(data.logs[date]);
      }
    }

    if (data.shopping) await saveEnhancedShoppingState(data.shopping);
    if (data.pantry) await savePantryInventory(data.pantry);
    if (data.fasting) await saveFastingState(data.fasting);

    console.log("Import complete");
    return { success: true };
  } catch (e: any) {
    console.error("Import failed:", e);
    return { success: false, error: e.message || "Unknown import error" };
  }
};