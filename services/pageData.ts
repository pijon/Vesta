import { calorieAvailability, isNutritionNumber } from '../utils/recipeNutrition';
import { Avatar, DailyLog, DayPlan, EatingOutDish, FoodLogItem, KnownFood, Recipe } from '../types';
import { getPlanHistoryInRange, getFamilyPlansInRange, getRecipePlanDates, getLogHistory, mergeSummaries, getRecipes, getEatingOutDishes } from './storageService';
import { getGroupMembersDetails, getUserGroup } from './groupService';
import { defineWarm, ensureWarm } from '../utils/prewarm';
import { localDateString } from '../utils/dateUtils';
import { normalizeFoodName } from '../utils/foodMatch';

/** Data the slower pages need, loaded in the background after sign-in (see utils/prewarm.ts). */

const daysFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateString(d);
};

/** Six months of logs and stored summaries, read once for everything below that needs them
 *  (summaries, streaks, frequent and known foods) */
const logHistoryData = defineWarm('logs:history', () => getLogHistory(180), 30_000);

/** Food items logged since a date (inclusive), oldest day first. */
const itemsSince = (logs: DailyLog[], startDate: string): FoodLogItem[] =>
  logs.filter(log => log.date >= startDate).flatMap(log => log.items || []);

/** Six months of daily summaries: the analytics periods (up to 90 days) and the 90 before, for comparisons. */
export const analyticsSummariesData = defineWarm('analytics:summaries', async () => mergeSummaries(await ensureWarm(logHistoryData)), 30_000);

/** Food logged over the analytics periods (last 90 days), for where the calories come from. */
export const analyticsLogsData = defineWarm('analytics:logs', async () =>
  (await ensureWarm(logHistoryData)).logs.filter(log => log.date >= daysFromToday(-95) && log.items?.length), 30_000);

/** Day types, planned meals and ticks over the analytics period (last ~90 days), read together. */
const planHistoryData = defineWarm('plans:history', () => getPlanHistoryInRange(daysFromToday(-95), daysFromToday(0)), 5 * 60_000);

/** Fast/nourish type of each day over the analytics period (last ~90 days). */
export const analyticsDayTypesData = defineWarm('analytics:dayTypes', async () => (await ensureWarm(planHistoryData)).types, 5 * 60_000);

/** Planned meals and what was ticked as eaten, by date, over the analytics period. */
export const analyticsPlannedDaysData = defineWarm('analytics:plannedDays', async () => (await ensureWarm(planHistoryData)).days, 5 * 60_000);

/** The family's plan for the next two weeks plus the saved list and pantry. */
/** The family's planned meals for the next two weeks, to add to the shopping list */
export const shoppingData = defineWarm('shopping:init', async () => ({
  plans: await getFamilyPlansInRange(daysFromToday(0), daysFromToday(14)) as Record<string, DayPlan>,
}), 30_000);

export interface FamilyInfo {
  memberCount: number;
  /** First names by uid */
  names: Map<string, string>;
  /** Chosen avatars by uid (members without one get a default from their uid) */
  avatars: Map<string, Avatar>;
}

/**
 * The user's family when it has other members (null in a family of one: nothing is shared then),
 * with member names.
 */
export const familyData = defineWarm<FamilyInfo | null>('family', async () => {
  const group = await getUserGroup();
  if (!group || group.memberIds.length < 2) return null;
  const members = await getGroupMembersDetails(group.memberIds);
  return {
    memberCount: group.memberIds.length,
    names: new Map(members.map(m => [m.id, m.name.split(' ')[0]])),
    avatars: new Map(members.flatMap(m => (m.avatar ? [[m.id, m.avatar] as const] : []))),
  };
}, 5 * 60_000);

export interface RecipeHistory {
  /** Most recent date (today or earlier) each recipe was planned */
  lastHad: Record<string, string>;
  /** Next date (today or later) each recipe is planned */
  next: Record<string, string>;
}

/** When recipes were last eaten and are next planned (90 days back, two weeks ahead). */
export const recipeHistoryData = defineWarm<RecipeHistory>('recipes:history', async () => {
  const today = daysFromToday(0);
  const dates = await getRecipePlanDates(daysFromToday(-90), daysFromToday(14));
  const history: RecipeHistory = { lastHad: {}, next: {} };
  Object.entries(dates).forEach(([id, list]) => {
    const past = list.filter(d => d <= today);
    const upcoming = list.filter(d => d >= today);
    if (past.length) history.lastHad[id] = past[past.length - 1];
    if (upcoming.length) history.next[id] = upcoming[0];
  });
  return history;
}, 60_000);

export interface FrequentFood {
  name: string;
  /** Calories the last time it was logged */
  calories: number;
  /** Protein the last time it was logged, when known */
  protein?: number;
  count: number;
}

/** Foods from the last two weeks for one-tap re-logging: most often logged first, then most recent. */
export const frequentFoodsData = defineWarm<FrequentFood[]>('today:frequentFoods', async () => {
  const items = itemsSince((await ensureWarm(logHistoryData)).logs, daysFromToday(-14));
  const byName = new Map<string, FrequentFood & { last: number }>();
  items.forEach(item => {
    const key = item.name.trim().toLowerCase();
    if (!key || !isNutritionNumber(item.calories)) return;
    const entry = byName.get(key);
    if (!entry) byName.set(key, { name: item.name.trim(), calories: item.calories, protein: item.protein, count: 1, last: item.timestamp });
    else {
      entry.count++;
      if (item.timestamp > entry.last) Object.assign(entry, { name: item.name.trim(), calories: item.calories, protein: item.protein, last: item.timestamp });
    }
  });
  // Repeats first (most often logged), then the most recent one-offs to fill the row
  const all = [...byName.values()];
  const repeats = all.filter(f => f.count >= 2).sort((a, b) => b.count - a.count || b.last - a.last);
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  // One-offs from today are already in the log just below
  const recent = all.filter(f => f.count < 2 && f.last < startOfToday).sort((a, b) => b.last - a.last);
  return [...repeats, ...recent]
    .slice(0, 8)
    .map(({ name, calories, protein, count }) => ({ name, calories, protein, count }));
}, 5 * 60_000);

/**
 * Foods the user has their own numbers for, so logging reuses them instead of asking the AI:
 * their recipes (per portion) and anything logged in the last 90 days (latest values).
 * A recipe wins over a logged food of the same name.
 */
export const knownFoodsData = defineWarm<KnownFood[]>('food:known', async () => {
  const [recipes, history] = await Promise.all([getRecipes(), ensureWarm(logHistoryData)]);
  const items = itemsSince(history.logs, daysFromToday(-90));
  const byName = new Map<string, KnownFood & { last: number }>();
  items.forEach(item => {
    const key = normalizeFoodName(item.name);
    if (!key || !isNutritionNumber(item.calories)) return;
    const entry = byName.get(key);
    if (!entry || item.timestamp > entry.last) {
      byName.set(key, { name: item.name.trim(), calories: item.calories, protein: item.protein, source: 'log', last: item.timestamp });
    }
  });
  recipes.forEach(r => {
    const key = normalizeFoodName(r.name);
    if (key && calorieAvailability(r) === 'known') byName.set(key, { name: r.name.trim(), calories: Math.round(r.calories), protein: typeof r.protein === 'number' ? Math.round(r.protein) : undefined, source: 'recipe', last: 0 });
  });
  return [...byName.values()].map(({ last: _last, ...food }) => food);
}, 10 * 60_000);

/** Starts every page's background load, one after another so start-up stays light. */
export const prewarmPages = async (shouldContinue: () => boolean = () => true): Promise<void> => {
  for (const warm of [frequentFoodsData, knownFoodsData, familyData, recipeHistoryData, analyticsSummariesData, shoppingData, analyticsDayTypesData, analyticsPlannedDaysData, analyticsLogsData]) {
    if (!shouldContinue()) return;
    try {
      await ensureWarm(warm as Parameters<typeof ensureWarm>[0]);
    } catch (e) {
      console.warn(`Background load failed: ${warm.key}`, e);
    }
    if (!shouldContinue()) return;
  }
};

/** Dishes eaten out before, for planning and logging eating out. */
export const eatingOutDishesData = defineWarm<EatingOutDish[]>('eatingOut:dishes', getEatingOutDishes, 60_000);
