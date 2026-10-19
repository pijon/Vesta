// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UserExperience } from '../types';
import { ExperienceChoice } from './ExperienceChoice';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

describe('experience choice', () => {
  it('requires an explicit choice and lets the adult change it', async () => {
    const Form = () => {
      const [value, setValue] = useState<UserExperience | null>(null);
      return React.createElement(ExperienceChoice, { value, onChange: setValue });
    };
    await act(async () => root.render(React.createElement(Form)));
    const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(inputs.length).toBe(2);
    expect(inputs.every(input => !input.checked)).toBe(true);
    await act(async () => inputs[0].click());
    expect(inputs[0].checked).toBe(true);
    await act(async () => inputs[1].click());
    expect(inputs[1].checked).toBe(true);
    expect(inputs[0].checked).toBe(false);
    expect(container.querySelector('legend')?.textContent).toBeTruthy();
  });

  it('keeps concurrent forms separate and blocks changes while disabled', async () => {
    let changes = 0;
    await act(async () => root.render(React.createElement('div', null,
      React.createElement(ExperienceChoice, { value: 'planning', onChange: () => { changes++; }, disabled: true }),
      React.createElement(ExperienceChoice, { value: 'tracking', onChange: () => {} }),
    )));
    const inputs = [...container.querySelectorAll<HTMLInputElement>('input')];
    expect(new Set(inputs.map(input => input.id)).size).toBe(4);
    expect(inputs[0].name).not.toBe(inputs[2].name);
    await act(async () => inputs[1].click());
    expect(changes).toBe(0);
    for (const input of inputs) expect(container.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
  });
});
