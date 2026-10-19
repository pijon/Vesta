// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommittedMealIntake, DayPlan, PlannedMealIntakeResult, Recipe, ResolvedPlannedMealIntake, UserSetupSnapshot, UserStats } from './types';
import { DEFAULT_USER_STATS } from './constants';
import { getCachedUserSetup, saveCachedUserSetup } from './utils/cacheService';
import { localDateString } from './utils/dateUtils';

const remote = vi.hoisted(() => ({
  uid: 'a', loading: false, developer: false,
  load: vi.fn<(uid: string) => Promise<UserSetupSnapshot>>(),
  complete: vi.fn(), change: vi.fn(), name: vi.fn(), avatar: vi.fn(),
  logRead: vi.fn(), migration: vi.fn(),
  todayMeals: [] as Recipe[], commit: vi.fn(), remove: vi.fn(), results: [] as PlannedMealIntakeResult[], errors: [] as string[],
  SetupRequired: class extends Error { constructor(public experience: 'planning' | 'tracking') { super('Complete setup'); } },
}));
vi.mock('./contexts/AuthContext', () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => children, useAuth: () => ({ user: remote.loading ? null : { uid: remote.uid }, uid: remote.uid, loading: remote.loading, logout: async () => {}, isDeveloper: remote.developer }) }));
vi.mock('./contexts/DevModeContext', () => ({ DevModeProvider: ({ children }: { children: React.ReactNode }) => children, useDevMode: () => ({ isFeatureEnabled: () => remote.developer, isDevMode: remote.developer, featureFlags: {}, toggleFeatureFlag: () => {}, resetFlags: () => {} }) }));
vi.mock('./services/firebase', () => ({ currentUid: () => remote.uid, auth: { authStateReady: async () => {}, get currentUser() { return remote.loading ? null : { uid: remote.uid }; } } }));
vi.mock('./services/userPreferencesService', () => ({ getUserSetup: (uid: string) => remote.load(uid), completeUserSetup: (...args: unknown[]) => remote.complete(...args), saveUserExperience: (...args: unknown[]) => remote.change(...args), saveUserProfileName: (...args: unknown[]) => remote.name(...args), saveUserProfileAvatar: (...args: unknown[]) => remote.avatar(...args), UserSetupRequiredError: remote.SetupRequired }));
vi.mock('./hooks/useTheme', () => ({ useTheme: () => ({ preference: 'light', setPreference: () => {} }) }));
vi.mock('./components/ReloadPrompt', () => ({ ReloadPrompt: () => null }));
vi.mock('./components/LoginScreen', () => ({ LoginScreen: () => React.createElement('p', null, 'Sign in') }));
vi.mock('./services/mealLogService', () => ({
  commitPlannedMealIntake: (...args: unknown[]) => remote.commit(...args),
  removePlannedMealIntake: (...args: unknown[]) => remote.remove(...args),
  deletePlannedMealIntake: async () => { throw new Error('not used'); },
  restorePlannedMealIntake: async () => { throw new Error('not used'); },
  updatePlannedMealIntake: async () => { throw new Error('not used'); },
}));
vi.mock('./services/geminiService', () => ({ estimateMealCalories: async () => 450 }));
type TodayStubProps = {
  stats: UserStats; todayPlan: DayPlan; onUpdateStats: (stats: UserStats) => Promise<void>;
  onRequestPlannedIntake: (entries: { meal: Recipe; at: number }[]) => Promise<PlannedMealIntakeResult>;
  onRemovePlannedIntake: (meal: Recipe) => Promise<void>;
};
vi.mock('./components/TrackToday', () => ({ TrackToday: ({ stats, todayPlan, onUpdateStats, onRequestPlannedIntake, onRemovePlannedIntake }: TodayStubProps) => {
  const navigate = useNavigate();
  return React.createElement('div', null,
    React.createElement('p', null, `Nutrition dashboard: ${stats.name}`),
    React.createElement('p', null, `Eaten: ${todayPlan.completedMealIds.join(',') || 'none'}`),
    React.createElement('button', { onClick: () => { void onRequestPlannedIntake(todayPlan.meals.map(meal => ({ meal, at: Date.now() }))).then(r => remote.results.push(r), e => remote.errors.push(String(e))); } }, 'Eat all'),
    React.createElement('button', { onClick: () => { void onRemovePlannedIntake(todayPlan.meals[0]).catch(e => remote.errors.push(String(e))); } }, 'Untick first'),
    React.createElement('button', { onClick: async () => { await onUpdateStats({ ...stats, goalWeight: 72, nonFastDayCalories: 2100 }); navigate('/settings'); } }, 'Update goals'));
} }));
vi.mock('./components/PlanToday', () => ({ PlanToday: ({ todayPlan }: { todayPlan: DayPlan }) => React.createElement('p', null, `Meal today: ${todayPlan.meals.map(m => m.name).join(', ') || 'nothing'}`) }));
vi.mock('./components/TrackAnalytics', () => ({ TrackAnalytics: () => React.createElement('p', null, 'Nutrition analytics') }));
vi.mock('./components/ShoppingList', () => ({ ShoppingList: () => React.createElement('p', null, 'Shared shopping') }));
vi.mock('./components/FamilyView', () => ({ FamilyView: ({ onSaveAvatar }: { onSaveAvatar: (avatar: { seed: string; tint: 'water' }) => Promise<void> }) => {
  const navigate = useNavigate();
  return React.createElement('div', null,
    React.createElement('p', null, 'Shared family'),
    React.createElement('button', { onClick: () => void onSaveAvatar({ seed: 'Sam', tint: 'water' }) }, 'Save avatar'),
    React.createElement('button', { onClick: () => navigate('/settings') }, 'Open settings'));
} }));
vi.mock('./components/Planner', () => ({ Planner: ({ experience, onRequestPlannedIntake }: { experience?: string; onRequestPlannedIntake?: unknown }) =>
  React.createElement('p', null, experience === 'planning' ? `Meal planner${onRequestPlannedIntake ? ' with logging' : ''}` : 'Nutrition planner') }));
vi.mock('./components/RecipeLibrary', () => ({ RecipeLibrary: () => React.createElement('p', null, 'Recipe library') }));
vi.mock('./components/FoodEntryModal', () => ({ FoodEntryModal: () => null }));
vi.mock('./components/WorkoutEntryModal', () => ({ WorkoutEntryModal: () => null }));
vi.mock('./components/WeightEntryModal', () => ({ WeightEntryModal: () => null }));
vi.mock('./components/ReminderSettings', () => ({ ReminderSettings: () => null }));
vi.mock('./components/EatingOutHistorySettings', () => ({ EatingOutHistorySettings: () => null }));
vi.mock('./services/activityService', () => ({ subscribeFamilyUpdates: () => () => {} }));
vi.mock('./services/pageData', () => ({ prewarmPages: async () => {} }));
vi.mock('./services/storageService', () => ({
  getDayPlan: async (date: string) => ({ date, meals: date === localDateString() ? remote.todayMeals : [], completedMealIds: [] }),
  getUserStats: async () => ({ ...DEFAULT_USER_STATS, name: 'Alex' }),
  getDailyLog: async (date: string) => { remote.logRead(); return { date, items: [], workouts: [], waterIntake: 0 }; },
  getFastingState: async () => ({ lastAteTime: null, config: { protocol: '16:8', targetFastHours: 16 } }),
  getCoachRead: async () => ({}), getRecentWorkouts: async () => [],
  saveUserStats: async () => {}, saveDailyLog: async () => {}, saveFastingState: async () => {}, addFastingEntry: async () => {}, saveCoachRead: async () => {},
  migrateFromLocalStorage: () => remote.migration(), subscribeFamilyMeals: () => () => {}, withFamilyMeals: (plan: unknown) => plan,
  exportAllData: async () => '{}', importAllData: async () => ({ success: true }), getLocalStorageDebugInfo: () => ({}),
}));

const { App } = await import('./App');
let root: Root;
let container: HTMLDivElement;
const setup = (uid = 'a', experience: 'planning' | 'tracking' = 'tracking'): UserSetupSnapshot => ({
  uid, preferences: { version: 1, experience, profileSetupComplete: true, trackingSetupComplete: experience === 'tracking' },
  stats: experience === 'planning' ? { name: uid === 'a' ? 'Sam' : 'Robin' } : { ...DEFAULT_USER_STATS, name: uid === 'a' ? 'Alex' : 'Robin', weightHistory: [] },
});
const render = async (path = '/') => {
  if (path === '/settings') await import('./components/SettingsView');
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App))));
};
beforeEach(() => {
  Object.assign(remote, { uid: 'a', loading: false, developer: false });
  remote.load.mockReset().mockImplementation(async uid => setup(uid));
  for (const fn of [remote.complete, remote.change, remote.name, remote.avatar, remote.logRead, remote.migration, remote.commit, remote.remove]) fn.mockReset();
  remote.todayMeals = []; remote.results = []; remote.errors = [];
  remote.commit.mockImplementation(async (_uid: string, date: string, entries: ResolvedPlannedMealIntake[]): Promise<CommittedMealIntake> => ({
    log: { date, items: [], workouts: [], waterIntake: 0 }, completedMealIds: entries.map(e => e.key),
    fasting: { lastAteTime: null, config: { protocol: '16:8', targetFastHours: 16 } },
    items: entries.map(e => ({ id: `item-${e.key}`, name: e.meal.name, calories: e.calories, timestamp: e.at, planInstanceId: e.key })),
  }));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('scrollTo', () => {});
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe('account-owned setup boundary', () => {
  it('does not mount tracker pages for a remembered uid while auth is restoring', async () => {
    remote.loading = true;
    await render();
    expect(container.textContent).not.toContain('Nutrition');
    expect(remote.load).not.toHaveBeenCalled();
    expect(remote.logRead).not.toHaveBeenCalled();
  });

  it('opens a returning user from the cached setup while auth is restoring, without reading as them yet', async () => {
    saveCachedUserSetup(setup('a', 'planning'));
    remote.loading = true;
    await render();
    expect(container.textContent).toContain('Meal today');
    expect(remote.load).not.toHaveBeenCalled();
  });

  it('keeps the cached setup when the server cannot be reached', async () => {
    saveCachedUserSetup(setup('a', 'planning'));
    remote.load.mockRejectedValue(new Error('Connection lost'));
    await render();
    expect(container.textContent).toContain('Meal today');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('caches the confirmed setup for the next launch', async () => {
    await render();
    expect(getCachedUserSetup('a')).toEqual(setup('a'));
  });

  it('preserves explicit tracking completion even with empty weight history', async () => {
    await render();
    expect(container.textContent).toContain('Nutrition dashboard: Alex');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(remote.migration).not.toHaveBeenCalled();
  });

  it('keeps saved planning protected on a tracking deep link with the flag off', async () => {
    remote.load.mockResolvedValue(setup('a', 'planning'));
    await render('/analytics');
    expect(container.textContent).toContain('Meal today');
    expect(container.textContent).not.toContain('Nutrition');
    expect(remote.logRead).not.toHaveBeenCalled();
    expect(remote.migration).not.toHaveBeenCalled();
  });

  it('treats failed loading as retryable and never as new-user setup', async () => {
    remote.load.mockRejectedValueOnce(new Error('Connection lost'));
    await render();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Connection lost');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(remote.logRead).not.toHaveBeenCalled();
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Retry')!.click());
    expect(container.textContent).toContain('Nutrition dashboard: Alex');
  });

  it('ignores an old account load that resolves after the next account signs in', async () => {
    let finish!: (value: UserSetupSnapshot) => void;
    remote.load.mockImplementationOnce(() => new Promise<UserSetupSnapshot>(r => { finish = r; }));
    await render();
    remote.uid = 'b';
    await render();
    expect(container.textContent).toContain('Nutrition dashboard: Robin');
    await act(async () => finish(setup('a', 'planning')));
    expect(container.textContent).toContain('Nutrition dashboard: Robin');
    expect(container.textContent).not.toContain('Meal today');
  });

  it('opens missing tracking setup without committing the mode and supports cancellation', async () => {
    remote.developer = true;
    remote.load.mockResolvedValue(setup('a', 'planning'));
    remote.change.mockRejectedValue(new remote.SetupRequired('tracking'));
    await render('/settings');
    await act(async () => container.querySelector<HTMLInputElement>('input[value="tracking"]')!.click());
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[value="planning"]')?.checked).toBe(true);
    expect(remote.complete).not.toHaveBeenCalled();
    expect(remote.logRead).not.toHaveBeenCalled();
  });

  it('completes a new planning setup and reloads without weight questions', async () => {
    remote.developer = true;
    remote.load.mockResolvedValue({ uid: 'a', preferences: null, stats: null });
    // Once saved, the server has the planning setup
    remote.complete.mockImplementation(async () => { remote.load.mockResolvedValue(setup('a', 'planning')); return setup('a', 'planning'); });
    await render();
    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="planning"]')!.click();
      const name = container.querySelector<HTMLInputElement>('input[placeholder="Your first name"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Sam');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(remote.complete).toHaveBeenCalledWith('a', { experience: 'planning', name: 'Sam' }, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(container.textContent).toContain('Meal today');
    expect(remote.logRead).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    root = createRoot(container);
    remote.load.mockResolvedValue(setup('a', 'planning'));
    await render();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain('Meal today');
  });

  it('ignores an old completion after the next adult signs in', async () => {
    remote.developer = true;
    remote.load.mockResolvedValueOnce({ uid: 'a', preferences: null, stats: { name: 'Sam' } });
    let finish!: (value: UserSetupSnapshot) => void;
    remote.complete.mockImplementationOnce(() => new Promise<UserSetupSnapshot>(r => { finish = r; }));
    await render();
    await act(async () => container.querySelector<HTMLInputElement>('input[value="planning"]')!.click());
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    remote.uid = 'b';
    await render();
    expect(container.textContent).toContain('Nutrition dashboard: Robin');
    await act(async () => finish(setup('a', 'planning')));
    expect(container.textContent).toContain('Nutrition dashboard: Robin');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('reopens setup with goals saved during this session', async () => {
    remote.developer = true;
    const initial = setup();
    initial.stats = { ...initial.stats, currentWeight: 80, goalWeight: 75 };
    remote.load.mockResolvedValue(initial);
    await render();
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Update goals')!.click());
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Preview welcome'))!.click());
    const submit = async () => { await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); };
    await submit();
    const numbers = [...container.querySelectorAll<HTMLInputElement>('[role="dialog"] input')];
    expect(numbers.map(input => input.value)).toContain('72');
    await submit();
    expect([...container.querySelectorAll<HTMLInputElement>('[role="dialog"] input')].map(input => input.value)).toContain('2100');
  });

  it('ignores a planning refresh resolving after a later tracking switch', async () => {
    remote.developer = true;
    const planning = setup('a', 'planning');
    planning.preferences!.trackingSetupComplete = true;
    remote.load.mockResolvedValue(planning);
    remote.change.mockResolvedValue(setup('a', 'tracking'));
    await render('/settings');
    let finish!: (value: UserSetupSnapshot) => void;
    remote.load.mockImplementationOnce(() => new Promise<UserSetupSnapshot>(resolve => { finish = resolve; }));
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Refresh'))!.click());
    remote.load.mockResolvedValue(setup('a', 'tracking'));
    await act(async () => container.querySelector<HTMLInputElement>('input[value="tracking"]')!.click());
    await act(async () => finish(planning));
    expect(container.textContent).toContain('Your goals');
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
  });


  it('ignores an avatar result that predates a later mode switch', async () => {
    remote.developer = true;
    const planning = setup('a', 'planning');
    planning.preferences!.trackingSetupComplete = true;
    remote.load.mockResolvedValue(planning);
    remote.change.mockResolvedValue(setup('a', 'tracking'));
    let finish!: (value: UserSetupSnapshot) => void;
    remote.avatar.mockImplementationOnce(() => new Promise<UserSetupSnapshot>(resolve => { finish = resolve; }));
    await render('/family');
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Save avatar')!.click());
    await act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === 'Open settings')!.click());
    remote.load.mockResolvedValue(setup('a', 'tracking'));
    await act(async () => container.querySelector<HTMLInputElement>('input[value="tracking"]')!.click());
    await act(async () => finish(planning));
    expect(container.textContent).toContain('Your goals');
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
  });

  it('lets a regular adult switch in Settings after setup and keep the choice after reload', async () => {
    let stored = setup();
    remote.load.mockImplementation(async () => stored);
    remote.change.mockImplementation(async (_uid: string, experience: 'planning' | 'tracking') => {
      stored = { ...stored, preferences: { ...stored.preferences!, experience } };
      return stored;
    });
    await render('/settings');
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
    const planning = container.querySelector<HTMLInputElement>('input[value="planning"]');
    expect(planning).not.toBeNull();
    await act(async () => planning!.click());
    expect(remote.change).toHaveBeenCalledWith('a', 'planning');
    expect(container.textContent).not.toContain('Your goals');
    expect(container.querySelector<HTMLInputElement>('input[value="planning"]')?.checked).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(container);
    await render('/settings');
    expect(container.querySelector<HTMLInputElement>('input[value="planning"]')?.checked).toBe(true);
    await act(async () => container.querySelector<HTMLInputElement>('input[value="tracking"]')!.click());
    expect(remote.change).toHaveBeenLastCalledWith('a', 'tracking');
    expect(container.textContent).toContain('Your goals');
    expect(remote.complete).not.toHaveBeenCalled();
  });

  it("loads Plan meals' Today from the plan, without reading the diary", async () => {
    remote.load.mockResolvedValue(setup('a', 'planning'));
    remote.todayMeals = [{ id: 'r1', instanceId: 'd1', name: 'Chili', calories: 600, ingredients: [], tags: [], servings: 1, slot: 'dinner' }];
    await render('/today');
    expect(container.textContent).toContain('Meal today: Chili');
    expect(remote.logRead).not.toHaveBeenCalled();
  });

  it('gives Plan meals a meal Today and the Planner, without logging or Analytics', async () => {
    remote.load.mockResolvedValue(setup('a', 'planning'));
    await render('/mealplanner');
    expect(container.textContent).toContain('Meal planner');
    expect(container.textContent).not.toContain('with logging');
    const navLabels = [...container.querySelectorAll('nav[aria-label="Main"] button')].map(b => b.textContent);
    expect(navLabels.some(label => label?.includes('Planner'))).toBe(true);
    expect(navLabels.some(label => label?.includes('Today'))).toBe(true);
    expect(navLabels.some(label => label?.includes('Analytics'))).toBe(false);
  });

  it('gives Plan meals Shopping as a nav item of its own', async () => {
    remote.load.mockResolvedValue(setup('a', 'planning'));
    await render('/shopping');
    const nav = container.querySelector('nav[aria-label="Main"]')!;
    // The sidebar's own items (its foot holds your avatar and Settings)
    expect([...nav.querySelectorAll('button')].map(b => b.textContent).filter(t => !t?.includes('Settings'))).toEqual(['Today', 'Planner', 'Recipes', 'Shopping', 'Family']);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Shopping');
    expect(container.querySelector('nav[aria-label="Family"]')).toBeNull();
    expect(container.textContent).toContain('Shared shopping');
  });

  it('keeps the shopping list under Family for tracking', async () => {
    await render('/shopping');
    const nav = container.querySelector('nav[aria-label="Main"]')!;
    expect([...nav.querySelectorAll('button')].map(b => b.textContent)).not.toContain('Shopping');
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe('Family');
    expect(container.querySelector('nav[aria-label="Family"]')).not.toBeNull();
  });

  it('switches at once while the choice saves, keeping Settings on screen', async () => {
    let finish!: (value: UserSetupSnapshot) => void;
    remote.change.mockImplementation(() => new Promise<UserSetupSnapshot>(r => { finish = r; }));
    await render('/settings');
    const settings = container.querySelector('[aria-label="Experience"]');
    await act(async () => container.querySelector<HTMLInputElement>('input[value="planning"]')!.click());
    // Not saved yet, but already showing Plan meals: no Analytics in the nav, the same Settings section
    expect(container.querySelector<HTMLInputElement>('input[value="planning"]')?.checked).toBe(true);
    expect(container.querySelector('[aria-label="Experience"]')).toBe(settings);
    const navLabels = [...container.querySelectorAll('nav[aria-label="Main"] button')].map(b => b.textContent);
    expect(navLabels.some(label => label?.includes('Analytics'))).toBe(false);
    await act(async () => finish(setup('a', 'planning')));
    expect(container.querySelector('[aria-label="Experience"]')?.textContent).toContain('Saved');
  });

  it('keeps the choice usable while it saves, and saves a quick second switch after the first', async () => {
    const saves: { experience: string; finish: (value: UserSetupSnapshot) => void }[] = [];
    remote.change.mockImplementation((_uid: string, experience: 'planning' | 'tracking') =>
      new Promise<UserSetupSnapshot>(finish => saves.push({ experience, finish })));
    await render('/settings');
    await act(async () => container.querySelector<HTMLInputElement>('input[value="planning"]')!.click());
    const tracking = container.querySelector<HTMLInputElement>('input[value="tracking"]')!;
    expect(tracking.disabled).toBe(false);
    expect(container.querySelector('[aria-label="Experience"]')?.textContent).toContain('Saving');
    await act(async () => tracking.click());
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
    // One save at a time: the second waits for the first
    expect(saves.map(save => save.experience)).toEqual(['planning']);
    await act(async () => saves[0].finish(setup('a', 'planning')));
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
    expect(saves.map(save => save.experience)).toEqual(['planning', 'tracking']);
    await act(async () => saves[1].finish(setup('a', 'tracking')));
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
    expect(container.querySelector('[aria-label="Experience"]')?.textContent).toContain('Saved');
  });

  it('goes back to the saved choice when the latest switch fails after an earlier one saved', async () => {
    // Saved as planning by someone who has set up tracking before, so switching back needs no setup
    const planningWithTracking = { ...setup('a', 'planning'), preferences: { ...setup('a', 'planning').preferences!, trackingSetupComplete: true } };
    let stored = setup('a');
    remote.load.mockImplementation(async () => stored);
    remote.change
      .mockImplementationOnce(async () => (stored = planningWithTracking))
      .mockImplementationOnce(async () => { throw new Error('Offline'); });
    await render('/settings');
    await act(async () => container.querySelector<HTMLInputElement>('input[value="planning"]')!.click());
    await act(async () => container.querySelector<HTMLInputElement>('input[value="tracking"]')!.click());
    expect(container.querySelector<HTMLInputElement>('input[value="planning"]')?.checked).toBe(true);
    expect(container.querySelector('[aria-label="Experience"] [role="alert"]')?.textContent).toContain('Offline');
  });

  it('switches back and says so when the choice cannot be saved', async () => {
    remote.change.mockRejectedValue(new Error('Offline'));
    await render('/settings');
    await act(async () => container.querySelector<HTMLInputElement>('input[value="planning"]')!.click());
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
    expect(container.querySelector('[aria-label="Experience"] [role="alert"]')?.textContent).toContain('Offline');
    expect(getCachedUserSetup('a')?.preferences?.experience).toBe('tracking');
  });

});

describe('planned meals eaten', () => {
  const known: Recipe = { id: 'r1', instanceId: 'known-1', name: 'Chili', calories: 600, calorieStatus: 'known', ingredients: [], tags: [], servings: 1, slot: 'dinner' };
  const unknown: Recipe = { id: 'r2', instanceId: 'unknown-1', name: 'Soup', calories: 0, calorieStatus: 'unknown', ingredients: [], tags: [], servings: 1, slot: 'lunch' };
  const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text);
  const sheet = () => document.querySelector('[role="dialog"]');
  const typeCalories = async (value: string) => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder="kcal"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const submit = async () => { await act(async () => button('Log it')!.click()); };
  const committed = () => remote.commit.mock.calls.map(call => (call[2] as ResolvedPlannedMealIntake[]).map(e => `${e.key}:${e.calories}:${e.source}`));

  it('logs a fully known meal without asking, then shows it eaten', async () => {
    remote.todayMeals = [known];
    await render();
    await act(async () => button('Eat all')!.click());
    expect(sheet()).toBeNull();
    expect(committed()).toEqual([['known-1:600:recipe']]);
    expect(remote.results).toEqual([expect.objectContaining({ status: 'saved', loggedKeys: ['known-1'], skippedKeys: [] })]);
    expect(container.textContent).toContain('Eaten: known-1');
  });

  it('asks for unknown calories before writing anything, and accepts an explicit zero', async () => {
    remote.todayMeals = [unknown];
    await render();
    await act(async () => button('Eat all')!.click());
    expect(sheet()?.textContent).toContain('How much was Soup?');
    expect(remote.commit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Eaten: none');
    await typeCalories('0');
    await submit();
    expect(committed()).toEqual([['unknown-1:0:manual']]);
    expect(sheet()).toBeNull();
    expect(container.textContent).toContain('Eaten: unknown-1');
  });

  it('writes nothing when the question is closed', async () => {
    remote.todayMeals = [unknown, known];
    await render();
    await act(async () => button('Eat all')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click());
    await act(async () => { await new Promise(r => setTimeout(r, 400)); });
    expect(remote.commit).not.toHaveBeenCalled();
    expect(remote.results).toEqual([{ status: 'cancelled' }]);
    expect(container.textContent).toContain('Eaten: none');
  });

  it('logs the rest of a batch once when one meal is skipped', async () => {
    remote.todayMeals = [unknown, known];
    await render();
    await act(async () => button('Eat all')!.click());
    await act(async () => button('Skip this meal')!.click());
    expect(committed()).toEqual([['known-1:600:recipe']]);
    expect(remote.results).toEqual([expect.objectContaining({ status: 'saved', loggedKeys: ['known-1'], skippedKeys: ['unknown-1'] })]);
    expect(container.textContent).toContain('Eaten: known-1');
  });

  it('keeps the answer after a failed save and retries it', async () => {
    remote.todayMeals = [unknown];
    remote.commit.mockRejectedValueOnce(new Error('Offline'));
    await render();
    await act(async () => button('Eat all')!.click());
    await typeCalories('350');
    await submit();
    expect(sheet()?.textContent).toContain('Offline');
    expect(container.textContent).toContain('Eaten: none');
    await submit();
    expect(committed()).toEqual([['unknown-1:350:manual'], ['unknown-1:350:manual']]);
    expect(container.textContent).toContain('Eaten: unknown-1');
  });

  it('shows the tick while saving, and takes it back if the save fails', async () => {
    remote.todayMeals = [known];
    let fail!: (error: Error) => void;
    remote.commit.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    await render();
    await act(async () => button('Eat all')!.click());
    expect(container.textContent).toContain('Eaten: known-1');
    await act(async () => fail(new Error('Offline')));
    expect(container.textContent).toContain('Eaten: none');
    expect(remote.errors).toEqual(['Error: Offline']);
  });

  it('unticks at once, and puts the tick back if removing fails', async () => {
    remote.todayMeals = [known];
    await render();
    await act(async () => button('Eat all')!.click());
    expect(container.textContent).toContain('Eaten: known-1');
    let fail!: (error: Error) => void;
    remote.remove.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    await act(async () => button('Untick first')!.click());
    expect(container.textContent).toContain('Eaten: none');
    await act(async () => fail(new Error('Offline')));
    expect(container.textContent).toContain('Eaten: known-1');
  });

  it('ignores a second tap while the first is still asking', async () => {
    remote.todayMeals = [unknown];
    await render();
    await act(async () => button('Eat all')!.click());
    await act(async () => button('Eat all')!.click());
    expect(remote.results).toEqual([{ status: 'cancelled' }]);
    await typeCalories('200');
    await submit();
    expect(remote.commit).toHaveBeenCalledTimes(1);
  });
});
