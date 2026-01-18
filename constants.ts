export const APP_NAME = "Vesta";
export const DAILY_CALORIE_LIMIT = 800;
export const MAX_FAMILY_GROUP_SIZE = 10;

// Using the recommended models from the coding guidelines
export const GEMINI_TEXT_MODEL = 'gemini-3-flash-preview';
export const GEMINI_THINKING_MODEL = 'gemini-3-pro-preview';

export const PLACEHOLDER_IMAGE = "https://picsum.photos/400/300";

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
  nonFastDayCalories: 2000,
  dailyWorkoutCountGoal: 1
};

export const DEFAULT_FEATURE_FLAGS: import('./types').FeatureFlags = {
  // No flags currently active
};

export const DEFAULT_DEV_SETTINGS: import('./types').DevSettings = {
  featureFlags: DEFAULT_FEATURE_FLAGS,
};