import { DayPlan, Recipe } from '../types';
import { getDailySummaries, getDayPlansInRange, getEnhancedShoppingState, getFamilyPlansInRange, getPantryInventory, getRecipePlanDates, getFoodItemsSince } from './storageService';
import { getFamilyMemberRecipes, getGroupMembersDetails, getUserGroup } from './groupService';
import { defineWarm, ensureWarm } from '../utils/prewarm';
import { localDateString } from '../utils/dateUtils';

/** Data the slower pages need, loaded in the background after sign-in (see utils/prewarm.ts). */

const daysFromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateString(d);
};

export const analyticsSummariesData = defineWarm('analytics:summaries', () => getDailySummaries(), 30_000);

/** Fast/nourish type of each day over the analytics period (last ~90 days). */
export const analyticsDayTypesData = defineWarm('analytics:dayTypes', async () => {
  const plans = await getDayPlansInRange(daysFromToday(-95), daysFromToday(0));
  const types: Record<string, string> = {};
  Object.values(plans).forEach(plan => { if (plan.type) types[plan.date] = plan.type; });
  return types;
}, 5 * 60_000);

/** The family's plan for the next two weeks plus the saved list and pantry. */
export const shoppingData = defineWarm('shopping:init', async () => {
  const [plans, shoppingState, pantry] = await Promise.all([
    getFamilyPlansInRange(daysFromToday(0), daysFromToday(14)),
    getEnhancedShoppingState(),
    getPantryInventory(),
  ]);
  return { plans: plans as Record<string, DayPlan>, shoppingState, pantry };
}, 30_000);

export interface FamilyInfo {
  memberCount: number;
  /** First names by uid */
  names: Map<string, string>;
  recipes: Recipe[];
}

/** The user's family group (null without one), with member names and their recipes. */
export const familyData = defineWarm<FamilyInfo | null>('family', async () => {
  const group = await getUserGroup();
  if (!group) return null;
  const [members, recipes] = await Promise.all([getGroupMembersDetails(group.memberIds), getFamilyMemberRecipes(group)]);
  return { memberCount: group.memberIds.length, names: new Map(members.map(m => [m.id, m.name.split(' ')[0]])), recipes };
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
  count: number;
}

/** Foods from the last two weeks for one-tap re-logging: most often logged first, then most recent. */
export const frequentFoodsData = defineWarm<FrequentFood[]>('today:frequentFoods', async () => {
  const items = await getFoodItemsSince(daysFromToday(-14));
  const byName = new Map<string, FrequentFood & { last: number }>();
  items.forEach(item => {
    const key = item.name.trim().toLowerCase();
    if (!key || !(item.calories >= 0)) return;
    const entry = byName.get(key);
    if (!entry) byName.set(key, { name: item.name.trim(), calories: item.calories, count: 1, last: item.timestamp });
    else {
      entry.count++;
      if (item.timestamp > entry.last) Object.assign(entry, { name: item.name.trim(), calories: item.calories, last: item.timestamp });
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
    .map(({ name, calories, count }) => ({ name, calories, count }));
}, 5 * 60_000);

/** Starts every page's background load, one after another so start-up stays light. */
export const prewarmPages = async () => {
  for (const warm of [frequentFoodsData, familyData, recipeHistoryData, analyticsSummariesData, shoppingData, analyticsDayTypesData]) {
    try {
      await ensureWarm(warm as Parameters<typeof ensureWarm>[0]);
    } catch (e) {
      console.warn(`Background load failed: ${warm.key}`, e);
    }
  }
};
