import { Recipe, DayPlan, UserStats, ShoppingState, DailyLog, PantryInventory, EnhancedShoppingState, FastingState, FastingEntry, DailySummary } from "../types";
import { DEFAULT_USER_STATS } from "../constants";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";

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
    let recipes = snapshot.docs.map(doc => doc.data() as Recipe);

    // Migration: Convert lunch/dinner to main meal (client-side fix)
    // Ideally we update the DB heavily, but for now just fix on read
    return recipes.map(r => {
      if ((r as any).type === 'lunch' || (r as any).type === 'dinner') {
        return { ...r, type: 'main meal' as const };
      }
      return r;
    });
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

// --- Planning ---
// Saved as a SINGLE document 'data/plan' for simplicity, or collection 'days'. 
// Current app loads ALL plans at once for Shopping List.
// Let's use a single document for now to match 'localstorage' structure.
const PLAN_DOC = 'plan';

export const getWeeklyPlan = async (): Promise<Record<string, DayPlan>> => {
  try {
    const d = await getDoc(getDocRef('data', PLAN_DOC));
    if (d.exists()) {
      return d.data() as Record<string, DayPlan>;
    }
  } catch (e) { console.error(e); }
  return {};
};

export const getDayPlan = async (date: string): Promise<DayPlan> => {
  // Optimization: If we really want single day, fetching the whole blob is bad.
  // But for MVP migration, we stick to the Plan blob.
  // TODO: Refactor to 'days' collection for scalability
  const plan = await getWeeklyPlan();
  return plan[date] || { date, meals: [], completedMealIds: [] };
};

export const saveDayPlan = async (dayPlan: DayPlan) => {
  // This is risky with concurrent edits on a single doc, but okay for single user.
  // We use setDoc with merge: true to just update that key?
  // No, firestore keys with dots... date is "2023-01-01".
  // We can use updateDoc({ [date]: dayPlan })
  const ref = getDocRef('data', PLAN_DOC);
  // Ensure doc exists first
  await setDoc(ref, { [dayPlan.date]: dayPlan }, { merge: true });
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
    cachedPurchasableItems: []
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

export const getAllDailySummaries = async (): Promise<DailySummary[]> => {
  const snapshot = await getDocs(getCollectionRef('logs'));
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

  return summaries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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