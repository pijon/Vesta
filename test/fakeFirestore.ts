// An in-memory stand-in for the parts of Firestore the services use. Documents are stored
// as JSON, which drops undefined fields like the app's ignoreUndefinedProperties setting.
// Security rules are not modelled. Use it with:
//   vi.mock('firebase/firestore', async () => (await import('../test/fakeFirestore')).fakeFirestore.api);
type Data = Record<string, unknown>;
type Ref = { path: string };
type Where = { field: string; op: string; value: unknown };
type Query = Ref & { constraints?: Where[]; max?: number };

const docs = new Map<string, Data>();
const writes: string[] = [];
const DELETE = { deleteField: true };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const isObject = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v);
const isUnion = (v: unknown): v is { arrayUnion: unknown[] } => isObject(v) && 'arrayUnion' in v;
const isRemove = (v: unknown): v is { arrayRemove: unknown[] } => isObject(v) && 'arrayRemove' in v;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const merge = (target: Data, patch: Data) => {
  Object.entries(patch).forEach(([key, value]) => {
    const current = Array.isArray(target[key]) ? target[key] as unknown[] : [];
    if (value === DELETE) delete target[key];
    else if (isUnion(value)) target[key] = [...current, ...value.arrayUnion.filter(v => !current.some(c => same(c, v)))];
    else if (isRemove(value)) target[key] = current.filter(c => !value.arrayRemove.some(v => same(c, v)));
    // Like Firestore, an empty map is a value, not a merge: it replaces the field
    else if (isObject(value) && isObject(target[key]) && Object.keys(value).length > 0) merge(target[key] as Data, value);
    else if (isObject(value)) { target[key] = {}; merge(target[key] as Data, value); }
    else if (value !== undefined) target[key] = clone(value);
  });
};

const snapshot = (path: string) => ({
  id: path.split('/').pop()!,
  ref: { path },
  exists: () => docs.has(path),
  data: () => (docs.has(path) ? clone(docs.get(path)) : undefined),
});

const passes = (data: Data, w: Where) => {
  const v = data[w.field] as string;
  const value = w.value as string;
  return w.op === '>=' ? v >= value : w.op === '<=' ? v <= value : w.op === '==' ? v === value : true;
};

// Live queries (onSnapshot): each listener hears about writes to the documents it matches
type Listener = { q: Query; onNext: (snapshot: unknown) => void; known: Map<string, string> };
const listeners = new Set<Listener>();
const matches = (q: Query, path: string) =>
  path.slice(0, path.lastIndexOf('/')) === q.path && docs.has(path) && (q.constraints || []).every(w => passes(docs.get(path)!, w));
const notify = (l: Listener, initial = false) => {
  const changes: { type: 'added' | 'modified' | 'removed'; doc: ReturnType<typeof snapshot> }[] = [];
  const now = new Map([...docs.keys()].filter(p => matches(l.q, p)).map(p => [p, JSON.stringify(docs.get(p))]));
  now.forEach((json, path) => {
    if (!l.known.has(path)) changes.push({ type: 'added', doc: snapshot(path) });
    else if (l.known.get(path) !== json) changes.push({ type: 'modified', doc: snapshot(path) });
  });
  l.known.forEach((json, path) => {
    if (!now.has(path)) changes.push({ type: 'removed', doc: { ...snapshot(path), data: () => JSON.parse(json) } });
  });
  l.known = now;
  // Like Firestore, the first snapshot comes even when nothing matches
  if (changes.length || initial) l.onNext({ docChanges: () => changes, metadata: { hasPendingWrites: false } });
};
const notifyAll = () => listeners.forEach(l => notify(l));

const setDoc = async (ref: Ref, data: Data, options?: { merge?: boolean }) => {
  writes.push(ref.path);
  if (options?.merge) {
    const existing = docs.get(ref.path) ?? {};
    merge(existing, data);
    docs.set(ref.path, existing);
  } else {
    const fresh = {};
    merge(fresh, data);
    docs.set(ref.path, fresh);
  }
  notifyAll();
};

const updateDoc = async (ref: Ref, data: Data) => {
  if (!docs.has(ref.path)) throw Object.assign(new Error(`No document to update: ${ref.path}`), { code: 'not-found' });
  await setDoc(ref, data, { merge: true });
};

const deleteDoc = async (ref: Ref) => { docs.delete(ref.path); notifyAll(); };

const api = {
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  query: (col: Query, ...constraints: (Where | { limit: number } | null)[]) => ({
    path: col.path,
    constraints: constraints.filter((c): c is Where => !!c && 'field' in c),
    max: constraints.find((c): c is { limit: number } => !!c && 'limit' in c)?.limit,
  }),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }),
  orderBy: () => null,
  limit: (n: number) => ({ limit: n }),
  deleteField: () => DELETE,
  arrayUnion: (...values: unknown[]) => ({ arrayUnion: values }),
  arrayRemove: (...values: unknown[]) => ({ arrayRemove: values }),
  getDoc: async (ref: Ref) => snapshot(ref.path),
  getDocs: async (q: Query) => {
    const matching = [...docs.keys()]
      .filter(p => p.slice(0, p.lastIndexOf('/')) === q.path)
      .filter(p => (q.constraints || []).every(w => passes(docs.get(p)!, w)))
      .slice(0, q.max)
      .map(snapshot);
    return { docs: matching, empty: matching.length === 0, size: matching.length, forEach: (fn: (d: ReturnType<typeof snapshot>) => void) => matching.forEach(fn) };
  },
  onSnapshot: (q: Query, onNext: (snapshot: unknown) => void) => {
    const listener: Listener = { q, onNext, known: new Map() };
    listeners.add(listener);
    queueMicrotask(() => { if (listeners.has(listener)) notify(listener, true); });
    return () => { listeners.delete(listener); };
  },
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch: () => {
    const ops: (() => Promise<void>)[] = [];
    const batch = {
      set: (ref: Ref, data: Data, options?: { merge?: boolean }) => { ops.push(() => setDoc(ref, data, options)); return batch; },
      update: (ref: Ref, data: Data) => { ops.push(() => updateDoc(ref, data)); return batch; },
      delete: (ref: Ref) => { ops.push(() => deleteDoc(ref)); return batch; },
      commit: async () => { for (const op of ops) await op(); },
    };
    return batch;
  },
};

export const fakeFirestore = {
  docs,
  writes,
  api,
  /** Tells live queries about documents changed directly in `docs` (as another member's save would) */
  notify: notifyAll,
  reset: () => { docs.clear(); writes.length = 0; listeners.clear(); },
};
