import { CoachReadState, DayPlan, DailyLog, UserStats, FastingState, Recipe, EatingOutDish } from "../types";

const CACHE_PREFIX = 'fast800_cache_';

export const getCacheKey = (type: string, id?: string) => `${CACHE_PREFIX}${type}${id ? `_${id}` : ''}`;

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
export const getCachedUserStats = (): UserStats | null => getFromCache<UserStats>(getCacheKey('stats'));
export const getCachedFastingState = (): FastingState | null => getFromCache<FastingState>(getCacheKey('fasting'));
export const getCachedCoachRead = (): CoachReadState | null => getFromCache<CoachReadState>(getCacheKey('coachRead'));
export const getCachedRecipes = (): Recipe[] | null => getFromCache<Recipe[]>(getCacheKey('recipes'));

export const getCachedEatingOutDishes = (): EatingOutDish[] | null => getFromCache<EatingOutDish[]>(getCacheKey('eatingOutDishes'));
