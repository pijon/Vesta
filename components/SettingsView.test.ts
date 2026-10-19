// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_STATS } from '../constants';
import type { UserPreferences } from '../types';

const session = vi.hoisted(() => ({ uid: 'a', developer: true, restoring: false }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: session.restoring ? null : { uid: session.uid, email: 'a@example.com' }, uid: session.uid, logout: async () => {} }) }));
vi.mock('../services/firebase', () => ({ currentUid: () => session.uid, auth: { get currentUser() { return session.restoring ? null : { uid: session.uid }; } } }));
vi.mock('../contexts/DevModeContext', () => ({ useDevMode: () => ({ isDevMode: session.developer, featureFlags: {}, isFeatureEnabled: () => session.developer, toggleFeatureFlag: () => {}, resetFlags: () => {} }) }));
vi.mock('../services/storageService', () => ({ exportAllData: async () => '{}', importAllData: async () => ({ success: true }), getLocalStorageDebugInfo: () => ({}), migrateFromLocalStorage: async () => ({ success: true }) }));
vi.mock('./ReminderSettings', () => ({ ReminderSettings: () => null }));
vi.mock('./EatingOutHistorySettings', () => ({ EatingOutHistorySettings: () => null }));
const { SettingsView } = await import('./SettingsView');
let root: Root;
let container: HTMLDivElement;
const preferences: UserPreferences = { version: 1, experience: 'tracking', profileSetupComplete: true, trackingSetupComplete: true };
const stats = { ...DEFAULT_USER_STATS, name: 'Alex', currentWeight: 82, goalWeight: 75 };
const base = () => ({ stats, onUpdateStats: vi.fn().mockResolvedValue(undefined), fastingConfig: { protocol: '16:8' as const, targetFastHours: 16 }, onUpdateFastingConfig: vi.fn().mockResolvedValue(undefined), onTestOnboarding: () => {}, themePreference: 'light' as const, onChangeTheme: () => {} });

beforeEach(() => {
  session.uid = 'a'; session.developer = true; session.restoring = false;
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const choose = async (value: string) => { await act(async () => container.querySelector<HTMLInputElement>(`input[type="radio"][value="${value}"]`)!.click()); };
const enter = async (selector: string, value: string) => {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(selector)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('independent experience settings', () => {
  it('allows a preference change independently of invalid health targets and surfaces failure', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('Could not save choice'));
    await act(async () => root.render(React.createElement(SettingsView, { ...base(), stats: { ...stats, dailyCalorieGoal: 0 }, experienceSettings: { preferences, onChange, onSaveName: async () => {} } })));
    await choose('planning');
    expect(onChange).toHaveBeenCalledWith('planning');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Could not save choice');
    expect(container.querySelector<HTMLInputElement>('input[value="tracking"]')?.checked).toBe(true);
  });

  it('does not report a pending or setup-required switch as saved', async () => {
    let finish!: (result: { status: 'setup-required' }) => void;
    const onChange = () => new Promise<{ status: 'setup-required' }>(r => { finish = r; });
    await act(async () => root.render(React.createElement(SettingsView, { ...base(), experienceSettings: { preferences, onChange, onSaveName: async () => {} } })));
    await choose('planning');
    expect(container.querySelector('[aria-label="Experience"]')?.textContent).toContain('Saving');
    await act(async () => finish({ status: 'setup-required' }));
    expect(container.querySelector('[aria-label="Experience"]')?.textContent).not.toContain('Saved');
  });

  it('never renders tracking controls or autosaves health defaults for planning', async () => {
    const props = base();
    await act(async () => root.render(React.createElement(SettingsView, { ...props, experienceSettings: { preferences: { ...preferences, experience: 'planning', trackingSetupComplete: false }, onChange: async () => ({ status: 'saved' }), onSaveName: async () => {} } })));
    expect(container.querySelector('[aria-label="Your targets"]')).toBeNull();
    expect(container.textContent).not.toContain('Your goals');
    expect(container.textContent).not.toContain('Gentle nudges');
    await act(async () => root.unmount());
    root = createRoot(container);
    expect(props.onUpdateStats).not.toHaveBeenCalled();
    expect(props.onUpdateFastingConfig).not.toHaveBeenCalled();
  });

  it('lets a regular adult change experience without a developer flag', async () => {
    session.developer = false;
    const onChange = vi.fn().mockResolvedValue({ status: 'saved' });
    await act(async () => root.render(React.createElement(SettingsView, { ...base(), experienceSettings: { preferences, onChange, onSaveName: async () => {} } })));
    expect(container.querySelector('input[type="radio"][value="planning"]')).not.toBeNull();
    await choose('planning');
    expect(onChange).toHaveBeenCalledWith('planning');
    expect(container.querySelector('[aria-label="Experience"]')?.textContent).toContain('Saved');
    expect(container.querySelector('#dev-heading')).toBeNull();
  });

  it('still switches when Settings first rendered while the session was being restored', async () => {
    session.restoring = true;
    const onChange = vi.fn().mockResolvedValue({ status: 'saved' });
    await act(async () => root.render(React.createElement(SettingsView, { ...base(), experienceSettings: { preferences, onChange, onSaveName: async () => {} } })));
    session.restoring = false;
    await choose('planning');
    expect(onChange).toHaveBeenCalledWith('planning');
  });

  it('waits for the health save and retains a rejected edit for retry', async () => {
    vi.useFakeTimers();
    let fail!: (error: Error) => void;
    const props = base();
    props.onUpdateStats.mockImplementationOnce(() => new Promise<void>((_r, reject) => { fail = reject; }));
    await act(async () => root.render(React.createElement(SettingsView, props)));
    await enter('#settings-goalWeight', '76');
    await act(async () => { vi.advanceTimersByTime(800); });
    const footer = container.querySelector('[aria-labelledby="goals-heading"] [role="status"]')!;
    expect(footer.textContent).toContain('Saving');
    expect(footer.textContent).not.toContain('Saved');
    await act(async () => fail(new Error('Stats were not saved')));
    expect(footer.querySelector('[role="alert"]')?.textContent).toContain('Stats were not saved');
    expect(container.querySelector<HTMLInputElement>('#settings-goalWeight')?.value).toBe('76');
  });

  it('does not flush a previous account edit during debounce or unmount', async () => {
    vi.useFakeTimers();
    const props = base();
    await act(async () => root.render(React.createElement(SettingsView, props)));
    await enter('#settings-goalWeight', '76');
    session.uid = 'b';
    await act(async () => { vi.advanceTimersByTime(1000); });
    await act(async () => root.unmount());
    root = createRoot(container);
    expect(props.onUpdateStats).not.toHaveBeenCalled();
  });
});
