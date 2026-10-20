import { describe, expect, it, vi } from 'vitest';
import { createInFlight } from './inFlight';

const deferred = () => {
    let resolve!: (value: string) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<string>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

describe('createInFlight', () => {
    it('shares a run on its way while nothing changed, then starts afresh once it settles', async () => {
        const share = createInFlight<string, number>();
        const first = deferred();
        const start = vi.fn(() => first.promise);
        const a = share(() => 1, start);
        const b = share(() => 1, start);
        expect(b).toBe(a);
        expect(start).toHaveBeenCalledTimes(1);

        first.resolve('done');
        await a.promise;
        await Promise.resolve();
        share(() => 1, () => Promise.resolve('again'));
        expect(start).toHaveBeenCalledTimes(1);
    });

    it('starts a new run when the version changed since the one on its way started', () => {
        const share = createInFlight<string, number>();
        let version = 1;
        const a = share(() => version, () => deferred().promise);
        version = 2;
        const b = share(() => version, () => deferred().promise);
        expect(b).not.toBe(a);
        expect(b.version).toBe(2);
        // The older run is no longer the one shared
        expect(share(() => 2, () => deferred().promise)).toBe(b);
    });

    it('records the version as it is after starting, so a run that counts itself still matches', () => {
        const share = createInFlight<string, number>();
        let seq = 0;
        const start = vi.fn(() => { seq++; return deferred().promise; });
        const a = share(() => seq, start);
        expect(a.version).toBe(1);
        expect(share(() => seq, start)).toBe(a);
        expect(start).toHaveBeenCalledTimes(1);
    });

    it('keeps a run that succeeded for keepMs, while nothing changed', async () => {
        const now = Date.now();
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
        try {
            const share = createInFlight<string, number>(5000);
            const a = share(() => 1, () => Promise.resolve('read'));
            await a.promise;
            await Promise.resolve();
            clock.mockReturnValue(now + 4999);
            expect(share(() => 1, () => Promise.resolve('again'))).toBe(a);
            expect(share(() => 2, () => Promise.resolve('changed'))).not.toBe(a);
            const b = share(() => 2, () => Promise.resolve('changed'));
            await b.promise;
            await Promise.resolve();
            clock.mockReturnValue(now + 10_000);
            expect(share(() => 2, () => Promise.resolve('later'))).not.toBe(b);
        } finally {
            clock.mockRestore();
        }
    });

    it("doesn't keep a failed run", async () => {
        const share = createInFlight<string, number>(5000);
        const failing = deferred();
        const a = share(() => 1, () => failing.promise);
        failing.reject(new Error('offline'));
        await expect(a.promise).rejects.toThrow('offline');
        await Promise.resolve();
        expect(share(() => 1, () => Promise.resolve('ok'))).not.toBe(a);
    });
});
