import { CoachReadState, DayPlan, DailyLog, UserStats, FastingState, Recipe, EatingOutDish, UserSetupSnapshot } from "../types";
import { parseUserPreferences } from "./userPreferences";

const CACHE_PREFIX = 'fast800_cache_';

export const getCacheKey = (type: string, id?: string) => `${CACHE_PREFIX}${type}${id ? `_${id}` : ''}`;

export const getUserCacheKey = (uid: string, type: string, id?: string) =>
    `${CACHE_PREFIX}user_${encodeURIComponent(uid)}_${type}${id ? `_${id}` : ''}`;

export const getFromCache = <T>(key: string): T | null => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.warn(`Error reading cache for ${key}`, e);
        return null;
    }
};

export const saveToCache = <T>(key: string, data: T) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`Error saving cache for ${key}`, e);
    }
};

export const getCachedDayPlan = (date: string): DayPlan | null => getFromCache<DayPlan>(getCacheKey('dayPlan', date));
export const getCachedDailyLog = (date: string): DailyLog | null => getFromCache<DailyLog>(getCacheKey('dailyLog', date));
export const getCachedUserStats = (uid?: string): UserStats | null => uid ? getFromCache<UserStats>(getUserCacheKey(uid, 'stats')) : null;
export const getCachedFastingState = (): FastingState | null => getFromCache<FastingState>(getCacheKey('fasting'));
export const getCachedCoachRead = (): CoachReadState | null => getFromCache<CoachReadState>(getCacheKey('coachRead'));
export const getCachedRecipes = (): Recipe[] | null => getFromCache<Recipe[]>(getCacheKey('recipes'));

/** The last confirmed setup, so a launch can open the right experience before the server answers */
export const getCachedUserSetup = (uid: string): UserSetupSnapshot | null => {
    const cached = getFromCache<UserSetupSnapshot>(getUserCacheKey(uid, 'setup'));
    if (!cached || cached.uid !== uid) return null;
    try {
        const stats = cached.stats && typeof cached.stats === 'object' && !Array.isArray(cached.stats) ? cached.stats : null;
        return { uid, preferences: parseUserPreferences(cached.preferences), stats };
    } catch {
        return null; // unreadable or from an older shape: wait for the server instead
    }
};
export const saveCachedUserSetup = (snapshot: UserSetupSnapshot) => {
    // Without preferences the account still needs setting up, which only the server can confirm
    if (snapshot.preferences) saveToCache(getUserCacheKey(snapshot.uid, 'setup'), snapshot);
};

export const getCachedEatingOutDishes = (): EatingOutDish[] | null => getFromCache<EatingOutDish[]>(getCacheKey('eatingOutDishes'));
