/** A piece of work on its way, and the version of local state it started from */
export interface InFlight<T, V> { version: V; promise: Promise<T> }

/**
 * Shares work on its way: a caller gets the run already in flight if `version()` still gives what it
 * gave when that run started (nothing changed here since), and starts a new one otherwise. `version()`
 * is read again after `start()`, so a run that counts itself in the version (a sequence number) still
 * matches. Once a run settles the next caller starts afresh, unless it succeeded less than `keepMs` ago.
 */
export const createInFlight = <T, V>(keepMs = 0) => {
    let current: { run: InFlight<T, V>; expires: number } | null = null;
    return (version: () => V, start: () => Promise<T>): InFlight<T, V> => {
        if (current && Date.now() < current.expires && Object.is(current.run.version, version())) return current.run;
        const promise = start();
        const run: InFlight<T, V> = { version: version(), promise };
        const entry = { run, expires: Infinity };
        current = entry;
        promise.then(
            () => { entry.expires = Date.now() + keepMs; if (!keepMs && current === entry) current = null; },
            () => { if (current === entry) current = null; },
        );
        return run;
    };
};
