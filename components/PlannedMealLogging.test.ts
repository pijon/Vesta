// @vitest-environment jsdom
// Today's eaten actions go through App's one confirmation path: no shared plan write for a tick, and
// a meal shows as eaten only after a saved result.
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPlan, PlannedMealIntakeEntry, PlannedMealIntakeResult, Recipe } from '../types';
import { DEFAULT_USER_STATS } from '../constants';
import { localDateString } from '../utils/dateUtils';

const spies = vi.hoisted(() => ({ saveDayPlan: vi.fn(async () => {}) }));
vi.mock('../services/storageService', () => ({
  saveDayPlan: spies.saveDayPlan,
  saveFamilyMealOut: async () => {},
  getDailySummaries: async () => [],
}));
vi.mock('../services/pageData', () => ({ analyticsDayTypesData: {}, analyticsSummariesData: {}, frequentFoodsData: {}, checkInsData: {} }));
vi.mock('../utils/prewarm', () => ({ usePrewarmed: () => null }));
vi.mock('../hooks/useAchievements', () => ({ useAchievements: () => {} }));
vi.mock('../hooks/useWeeklyCheckIn', () => ({ useWeeklyCheckIn: () => ({ latest: null, history: [] }) }));
// The plate's tick and the "ate what was planned" card, reduced to buttons
vi.mock('./DualTrackSection', () => ({
  DualTrackSection: ({ todayPlan, onToggleMeal }: { todayPlan: DayPlan; onToggleMeal: (i: number) => void }) =>
    React.createElement('div', null, todayPlan.meals.map((meal, i) =>
      React.createElement('button', { key: meal.instanceId, onClick: () => onToggleMeal(i) }, `Tick ${meal.name}`))),
}));
vi.mock('./AtePlannedCard', () => ({
  AtePlannedCard: ({ plan, onLogAll }: { plan: DayPlan; onLogAll: (indices: number[]) => void }) =>
    React.createElement('button', { onClick: () => onLogAll(plan.meals.map((_, i) => i)) }, 'Log all'),
}));
for (const [path, name] of [['./CaloriesHero', 'CaloriesHero'], ['./TodayStrip', 'TodayStrip'], ['./TomorrowCard', 'TomorrowCard'], ['./WeekendPlanCard', 'WeekendPlanCard'], ['./WorkoutOverviewModal', 'WorkoutOverviewModal'], ['./EatingOutCard', 'EatingOutCard']] as const) {
  vi.doMock(path, () => ({ [name]: () => null }));
}
vi.mock('./CoachPanel', () => ({ CoachCard: () => null }));

const { TrackToday } = await import('./TrackToday');

const today = localDateString();
const meal = (name: string, instanceId: string): Recipe => ({ id: name, instanceId, name, calories: 400, calorieStatus: 'known', ingredients: [], tags: [], servings: 1, slot: 'lunch' });
const lunch = meal('Salad', 'lunch-1');
const dinner = meal('Chili', 'dinner-1');

let root: Root;
let container: HTMLDivElement;
const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!;

const renderToday = async (plan: DayPlan, handlers: {
  request: (entries: PlannedMealIntakeEntry[]) => Promise<PlannedMealIntakeResult>;
  remove?: (meal: Recipe) => Promise<void>;
  refresh?: () => Promise<void>;
}) => {
  const props = {
    todayPlan: plan, tomorrowPlan: { date: today, meals: [], completedMealIds: [] }, stats: { ...DEFAULT_USER_STATS, name: 'Alex' },
    dailyLog: { date: today, items: [], workouts: [], waterIntake: 0 },
    fastingState: { lastAteTime: null, config: { protocol: '16:8' as const, targetFastHours: 16 } },
    onUpdateStats: () => {}, onRequestPlannedIntake: handlers.request, onRemovePlannedIntake: handlers.remove ?? (async () => {}),
    onSetDayStatus: async () => ({ date: today, items: [], workouts: [], waterIntake: 0 }), onAddFoodLogItems: async () => {},
    onUpdateFoodItem: async () => {}, onDeleteFoodItem: async () => {}, onRestoreFoodItem: async () => {},
    onAddWorkout: async () => {}, onUpdateWorkout: async () => {}, onDeleteWorkout: async () => {}, onUpdateFastingConfig: async () => {},
    refreshData: handlers.refresh ?? (async () => {}), onNavigate: () => {}, onOpenFoodModal: () => {}, onOpenWorkoutModal: () => {},
    onOpenWeightModal: () => {}, onAddWater: async () => {}, coachRead: {}, onSetCoachRead: () => {},
  };
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(TrackToday, props))));
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  spies.saveDayPlan.mockClear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe("Today's eaten actions", () => {
  it('asks App to log a ticked meal and writes no plan itself', async () => {
    const request = vi.fn(async (): Promise<PlannedMealIntakeResult> => ({ status: 'saved', loggedKeys: ['lunch-1'], skippedKeys: [], items: [] }));
    const refresh = vi.fn(async () => {});
    await renderToday({ date: today, meals: [lunch], completedMealIds: [] }, { request, refresh });
    await act(async () => button('Tick Salad').click());
    expect(request).toHaveBeenCalledWith([expect.objectContaining({ meal: expect.objectContaining({ instanceId: 'lunch-1' }) })]);
    expect(spies.saveDayPlan).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it('shows no success and refreshes nothing when the question is cancelled', async () => {
    const request = vi.fn(async (_entries: PlannedMealIntakeEntry[]): Promise<PlannedMealIntakeResult> => ({ status: 'cancelled' }));
    const refresh = vi.fn(async () => {});
    await renderToday({ date: today, meals: [lunch, dinner], completedMealIds: [] }, { request, refresh });
    await act(async () => button('Log all').click());
    expect(request.mock.calls[0][0]).toHaveLength(2);
    expect(spies.saveDayPlan).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(container.querySelector('[role="status"]')?.textContent ?? '').not.toContain('Logged');
  });

  it('reports only the meals actually logged from a batch', async () => {
    const request = vi.fn(async (): Promise<PlannedMealIntakeResult> => ({
      status: 'saved', loggedKeys: ['dinner-1'], skippedKeys: ['lunch-1'],
      items: [{ id: 'i1', name: 'Chili', calories: 650, timestamp: Date.now(), planInstanceId: 'dinner-1' }],
    }));
    await renderToday({ date: today, meals: [lunch, dinner], completedMealIds: [] }, { request });
    await act(async () => button('Log all').click());
    expect(container.textContent).toContain('Logged 1 meal · 650 kcal');
  });

  it('unticks through App, and keeps the tick when that fails', async () => {
    const remove = vi.fn(async () => { throw new Error('Offline'); });
    const request = vi.fn(async (): Promise<PlannedMealIntakeResult> => ({ status: 'cancelled' }));
    await renderToday({ date: today, meals: [lunch], completedMealIds: ['lunch-1'] }, { request, remove });
    await act(async () => button('Tick Salad').click());
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ instanceId: 'lunch-1' }));
    expect(request).not.toHaveBeenCalled();
    expect(spies.saveDayPlan).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Offline');
  });
});
