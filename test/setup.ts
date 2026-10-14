import { beforeEach } from 'vitest';

// An in-memory localStorage (Node has none), emptied before each test.
const store = new Map<string, string>();
const memoryStorage: Storage = {
  get length() { return store.size; },
  key: i => [...store.keys()][i] ?? null,
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => { store.set(key, String(value)); },
  removeItem: key => { store.delete(key); },
  clear: () => store.clear(),
};
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });

beforeEach(() => store.clear());
