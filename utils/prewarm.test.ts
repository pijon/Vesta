import { beforeEach, describe, expect, it } from 'vitest';
import { clearWarm, defineWarm, ensureWarm, holdWarmUntil, peekWarm } from './prewarm';

beforeEach(clearWarm);

describe('account boundaries for prewarmed data', () => {
  it('does not repopulate a cleared store with an old successful load', async () => {
    let finish!: (value: string) => void;
    const warm = defineWarm('profile', () => new Promise<string>(resolve => { finish = resolve; }));
    const old = ensureWarm(warm);
    clearWarm();
    finish('Alex');
    await old;
    expect(peekWarm(warm)).toBeUndefined();
  });

  it('does not let an old rejection overwrite the new account entry', async () => {
    let fail!: (error: Error) => void;
    const oldWarm = defineWarm('profile', () => new Promise<string>((_resolve, reject) => { fail = reject; }));
    const old = ensureWarm(oldWarm).catch(() => {});
    clearWarm();
    let loads = 0;
    const fresh = defineWarm('profile', async () => { loads++; return 'Sam'; });
    await ensureWarm(fresh);
    fail(new Error('old account offline'));
    await old;
    expect(peekWarm(fresh)).toBe('Sam');
    await ensureWarm(fresh);
    expect(loads).toBe(1);
  });

  it('does not let a late success replace a new in-flight request', async () => {
    let finishOld!: (value: string) => void;
    let finishNew!: (value: string) => void;
    const oldWarm = defineWarm('profile', () => new Promise<string>(r => { finishOld = r; }));
    const old = ensureWarm(oldWarm);
    clearWarm();
    const fresh = defineWarm('profile', () => new Promise<string>(r => { finishNew = r; }));
    const current = ensureWarm(fresh);
    finishOld('Alex');
    await old;
    expect(peekWarm(fresh)).toBeUndefined();
    finishNew('Sam');
    await current;
    expect(peekWarm(fresh)).toBe('Sam');
  });
});

describe('holding loads for the launch refresh', () => {
  it('starts loads only once the hold ends, and right away after it', async () => {
    let release!: () => void;
    holdWarmUntil(new Promise<void>(resolve => { release = resolve; }));
    let loads = 0;
    const held = ensureWarm(defineWarm('held', async () => { loads++; return 'x'; }));
    await Promise.resolve();
    expect(loads).toBe(0);
    release();
    expect(await held).toBe('x');
    expect(loads).toBe(1);
    ensureWarm(defineWarm('after', async () => { loads++; return 'y'; }));
    expect(loads).toBe(2);
  });

  it('lets loads go when the refresh fails', async () => {
    holdWarmUntil(Promise.reject(new Error('offline')));
    expect(await ensureWarm(defineWarm('failed', async () => 'z'))).toBe('z');
  });
});
