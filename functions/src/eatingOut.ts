/** What the eating-out nudge reads from a stored meal (users/{uid}/days/{date}.meals[]). */
export interface StoredMeal {
  type?: string;
  kind?: string;
  name?: string;
  calories?: number;
  budget?: boolean;
  autoBudget?: boolean;
  slot?: string;
  tags?: string[];
  instanceId?: string;
}

export interface StoredDay {
  meals?: StoredMeal[];
  completedMealIds?: string[];
}

/** When each slot's meal is usually eaten, in minutes after midnight (same times as the app's SLOT_TIMES). */
const SLOT_MINUTES: Record<string, number> = { breakfast: 7 * 60 + 30, lunch: 12 * 60 + 30, snack: 15 * 60 + 30, dinner: 18 * 60 + 30 };

const slotOf = (meal: StoredMeal) => {
  if (meal.slot && meal.slot in SLOT_MINUTES) return meal.slot;
  const tags = (meal.tags ?? []).map(t => t.toLowerCase());
  return (['breakfast', 'lunch', 'snack'] as const).find(s => tags.includes(s)) ?? 'dinner';
};

export interface EatingOutNudge {
  instanceId: string;
  slot: string;
  title: string;
  body: string;
}

/**
 * Eating-out meals to nudge about now: not logged as eaten, past their usual time plus the delay
 * (and not by more than `graceMinutes`), and not already nudged.
 */
export const dueEatingOutNudges = (
  day: StoredDay | undefined,
  nowMinutes: number,
  delayMinutes: number,
  alreadySent: string[],
  graceMinutes: number,
): EatingOutNudge[] => {
  const eaten = new Set(day?.completedMealIds ?? []);
  const nudges: EatingOutNudge[] = [];
  for (const meal of day?.meals ?? []) {
    if (meal.type !== 'custom' || meal.kind !== 'out' || !meal.instanceId) continue;
    if (eaten.has(meal.instanceId) || alreadySent.includes(meal.instanceId)) continue;
    const slot = slotOf(meal);
    const at = SLOT_MINUTES[slot] + delayMinutes;
    if (nowMinutes < at || nowMinutes >= at + graceMinutes) continue;
    const label = slot === 'snack' ? 'snack' : slot;
    nudges.push(meal.budget
      ? {
          instanceId: meal.instanceId, slot,
          title: `How was ${label} out?`,
          // An automatic budget has moved with the day since it was planned, so the saved figure would be stale
          body: meal.autoBudget ? 'Tell Vesta where you ate and keep today accurate.' : `Tell Vesta where you ate. You budgeted ${Math.round(meal.calories ?? 0)} kcal.`,
        }
      : {
          instanceId: meal.instanceId, slot,
          title: `Log ${label} out`,
          body: `What did you have${meal.name ? ` (planned: ${meal.name})` : ''}? A quick log keeps today accurate.`,
        });
  }
  return nudges;
};
