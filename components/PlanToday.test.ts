// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DayPlan, Recipe } from '../types';

const spies = vi.hoisted(() => ({ saveFamilyMealOut: vi.fn(async () => {}) }));
vi.mock('../services/storageService', () => ({ saveFamilyMealOut: spies.saveFamilyMealOut }));
vi.mock('../services/pageData', () => ({ familyData: {} }));
vi.mock('../utils/prewarm', () => ({ usePrewarmed: () => null }));

const { PlanToday, upcomingMealIndex } = await import('./PlanToday');

const meal = (name: string, slot: Recipe['slot'], extra: Partial<Recipe> = {}): Recipe =>
  ({ id: name, instanceId: `${name}-1`, name, calories: 650, calorieStatus: 'known', ingredients: [], tags: [], servings: 1, slot, ...extra });
const breakfast = meal('Porridge', 'breakfast');
const dinner = meal('Chili', 'dinner', { familyMeal: true });
const at = (h: number, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  spies.saveFamilyMealOut.mockClear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

const renderToday = async (today: DayPlan, onPlanChange = vi.fn()) => {
  await act(async () => root.render(React.createElement(MemoryRouter, null, React.createElement(PlanToday, {
    uid: 'me', todayPlan: today, tomorrowPlan: { date: '2026-10-21', meals: [], completedMealIds: [] },
    onPlanChange, refreshData: async () => {}, onNavigate: () => {},
  }))));
  return onPlanChange;
};

describe('upcomingMealIndex', () => {
  const plan = { meals: [dinner, breakfast] };
  it('is the earliest meal whose time has not passed', () => {
    expect(upcomingMealIndex(plan, at(6))).toBe(1);
    expect(upcomingMealIndex(plan, at(12))).toBe(0);
    expect(upcomingMealIndex(plan, at(19, 30))).toBe(0); // dinner (18:30) is still next for a while
  });
  it('is none once the day is over', () => {
    expect(upcomingMealIndex(plan, at(22))).toBeUndefined();
  });
});

describe('Today for Plan meals', () => {
  it('offers to plan a meal on an empty day', async () => {
    await renderToday({ date: '2026-10-20', meals: [], completedMealIds: [] });
    expect(container.textContent).toContain('Nothing planned today');
    expect(container.textContent).toContain('Plan a meal');
  });

  it('shows the meals without calories, ticks or logging', async () => {
    await renderToday({ date: '2026-10-20', meals: [breakfast, dinner], completedMealIds: [] });
    expect(container.textContent).toContain('Porridge');
    expect(container.textContent).toContain('Chili');
    expect(container.textContent).not.toMatch(/kcal|calorie/i);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.textContent).not.toMatch(/eaten|log/i);
  });

  it('saves "not eating" for a family meal through the family path', async () => {
    const onPlanChange = await renderToday({ date: '2026-10-20', meals: [breakfast, dinner], completedMealIds: [] });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="I\'m not eating Chili"]')!.click());
    expect(spies.saveFamilyMealOut).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-20' }), 'Chili-1', true);
    const shown = onPlanChange.mock.calls[0][0] as DayPlan;
    expect(shown.meals.map(m => m.name)).toEqual(['Porridge']);
    expect(shown.familyMealsOut?.[0]).toMatchObject({ name: 'Chili', notEating: ['me'] });
  });

  it('keeps the plan and says so when that fails', async () => {
    spies.saveFamilyMealOut.mockRejectedValueOnce(new Error('Offline'));
    const onPlanChange = await renderToday({ date: '2026-10-20', meals: [dinner], completedMealIds: [] });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="I\'m not eating Chili"]')!.click());
    expect(onPlanChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Couldn't save that");
  });
});
