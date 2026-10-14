export const MAX_FAMILY_GROUP_SIZE = 10;

// Both models are stable and available on the Gemini API free tier.
export const GEMINI_MODEL_PRIMARY = 'gemini-3.8-flash';
export const GEMINI_MODEL_STABLE = 'gemini-3.5-flash-lite';

// Fast model for simple, latency-sensitive operations (food logging, quick analysis)
export const GEMINI_FAST_MODEL = GEMINI_MODEL_STABLE;

export const DEFAULT_USER_STATS = {
  startWeight: 0, // Deprecated, will be set by onboarding
  currentWeight: 0,
  goalWeight: 0,
  name: '',
  dailyCalorieGoal: 800,
  dailyWorkoutCalorieGoal: 400, // Default burn target
  dailyWaterGoal: 2000,
  weightHistory: [], // Empty history triggers onboarding
  dietMode: 'daily' as const,
  nonFastDayCalories: 2000
};

export const DEFAULT_FEATURE_FLAGS: import('./types').FeatureFlags = {
  forceSundayReset: false,
  useGeminiExperimental: true, // Default to Gemini 3.8 Flash
  quickMeals: true,
};

/**
 * Longest gap between meals counted as a fast. A longer gap means meals weren't logged, so it's
 * not recorded as a fast (it once produced "fasts" of 1,600+ hours) and analytics ignores it.
 */
export const MAX_PLAUSIBLE_FAST_HOURS = 72;
/** Default for FastingConfig.fastBreakCalories: a coffee with a splash of milk keeps the fast */
export const DEFAULT_FAST_BREAK_CALORIES = 50;

/** Public Web Push (VAPID) key; must match VAPID_PUBLIC_KEY in functions/.env */
export const VAPID_PUBLIC_KEY = 'BPgElQDY9AsCh3kcZ1ArUy1vCmMPv7YixH7Cz071DKpHbXyXHabOpBMfI95PGVc6N6EVHj9g2YOzqUke4CbkDA4';
