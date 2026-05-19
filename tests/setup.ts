/**
 * Bun test environment setup — loaded via bunfig.toml [test] preload.
 *
 * AsyncStorage's web shim requires `window.localStorage`. In Bun's node-like
 * test environment there is no DOM, so we stub it out with a no-op in-memory
 * store so the Zustand persist middleware doesn't throw unhandled rejections.
 */
const store: Record<string, string> = {};

const localStorageStub = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  key: (index: number) => Object.keys(store)[index] ?? null,
  get length() { return Object.keys(store).length; },
};

// @ts-ignore — intentionally adding to global in test environment only
globalThis.window = { localStorage: localStorageStub };
