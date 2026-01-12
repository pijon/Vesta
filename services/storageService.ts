import { Recipe, DayPlan, UserStats, ShoppingState, DailyLog, PantryInventory, EnhancedShoppingState, FastingState, FastingEntry, DailySummary, WorkoutItem } from "../types";
import { DEFAULT_USER_STATS } from "../constants";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, where, orderBy } from "firebase/firestore";

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


// --- Recipes ---
// Saved as individual documents in 'recipes' collection
export const getRecipes = async (): Promise<Recipe[]> => {
  try {
    const snapshot = await getDocs(getCollectionRef('recipes'));
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
  await setDoc(getDocRef('recipes', recipe.id), recipe);
};

export const deleteRecipe = async (id: string) => {
  await deleteDoc(getDocRef('recipes', id));
};

export const migrateRecipesToTags = async () => {
  const recipes = await getRecipes();
  const batchSize = 100;

  // Create batches
  for (let i = 0; i < recipes.length; i += batchSize) {
    const chunk = recipes.slice(i, i + batchSize);
    await Promise.all(chunk.map(r => saveRecipe(r)));
  }
  console.log(`Migrated ${recipes.length} recipes to use tags.`);
};

// --- Planning ---
const PLAN_DOC = 'plan'; // Keeping reference for legacy migration and export

// Refactored to use 'days' collection to avoid 1MB document limit.
// Legacy 'data/plan' document is deprecated.

export const getDayPlan = async (date: string): Promise<DayPlan> => {
  try {
    const docRef = doc(db, 'users', getUserId(), 'days', date);
    const dayDoc = await getDoc(docRef);

    if (dayDoc.exists()) {
      return dayDoc.data() as DayPlan;
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
  await setDoc(docRef, dayPlan);
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
    const p = await getDayPlan(date);
    if (p.meals && p.meals.length > 0) {
      plans[date] = p;
    }
  }));

  return plans;
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
    ingredientsHash: ''
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

export const getAllDailySummaries = async (daysBack: number = 90): Promise<DailySummary[]> => {
  // Calculate cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffDateString = cutoffDate.toISOString().split('T')[0];

  // Query logs with date filtering to avoid fetching all historical data
  const logsQuery = query(
    getCollectionRef('logs'),
    where('date', '>=', cutoffDateString),
    orderBy('date', 'asc')
  );

  const snapshot = await getDocs(logsQuery);
  const summaries: DailySummary[] = [];

  snapshot.forEach(doc => {
    const log = doc.data() as DailyLog;
    const caloriesConsumed = (log.items || []).reduce((sum, item) => sum + item.calories, 0);
    const caloriesBurned = (log.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);

    summaries.push({
      date: log.date,
      caloriesConsumed,
      caloriesBurned,
      netCalories: caloriesConsumed - caloriesBurned,
      workoutCount: (log.workouts || []).length
    });
  });

  return summaries; // Already sorted by orderBy in query
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
  if (d.exists()) return d.data() as FastingState;

  return {
    isFasting: false,
    startTime: null,
    endTime: null,
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