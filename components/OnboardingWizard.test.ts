// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingWizard } from './OnboardingWizard';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const button = (label: string) => [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === label)!;
const click = async (label: string) => { await act(async () => button(label).click()); };

describe('purpose-specific onboarding', () => {
  it('completes planning with only a name and no hidden health requirements', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(React.createElement(OnboardingWizard, {
      stats: { name: 'Sam' }, initialExperience: 'planning', allowExperienceChoice: true, intent: 'required', onComplete: complete,
    })));
    expect(container.querySelectorAll('input:not([type="radio"])').length).toBe(1);
    expect(container.textContent).not.toContain('Your weight');
    await click('Start using Vesta');
    expect(complete).toHaveBeenCalledWith({ experience: 'planning', name: 'Sam' });
  });

  it('keeps the real tracking answers and submits only after all steps', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    await act(async () => root.render(React.createElement(OnboardingWizard, {
      stats: { name: 'Alex', currentWeight: 82, goalWeight: 75 }, initialExperience: 'tracking', allowExperienceChoice: false, intent: 'required', onComplete: complete,
    })));
    await click('Continue');
    expect(container.textContent).toContain("today's weigh-in");
    await click('Continue');
    expect(complete).not.toHaveBeenCalled();
    await click('Start using Vesta');
    expect(complete).toHaveBeenCalledWith({ experience: 'tracking', name: 'Alex', currentWeight: 82, goalWeight: 75, nonFastDayCalories: 2000, dailyCalorieGoal: 800, dailyWaterGoal: 2000 });
  });

  it('keeps failed answers, disables duplicate submits, and allows retry', async () => {
    let fail!: (error: Error) => void;
    const complete = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; })).mockResolvedValue(undefined);
    await act(async () => root.render(React.createElement(OnboardingWizard, {
      stats: { name: 'Sam' }, initialExperience: 'planning', allowExperienceChoice: true, intent: 'switch', onComplete: complete,
    })));
    await click('Start using Vesta');
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="status"]')).not.toBeNull();
    await act(async () => fail(new Error('Connection lost')));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Connection lost');
    expect(container.querySelector<HTMLInputElement>('input[placeholder="Your first name"]')?.value).toBe('Sam');
    await click('Start using Vesta');
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('requires a new adult to choose and makes optional reruns cancelable without saving', async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    const cancel = vi.fn();
    await act(async () => root.render(React.createElement(OnboardingWizard, {
      stats: { name: 'Sam' }, allowExperienceChoice: true, intent: 'rerun', onComplete: complete, onCancel: cancel,
    })));
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click());
    expect(cancel).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
  });
});
