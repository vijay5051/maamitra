import { describe, expect, test, mock } from 'bun:test';

// react-native's index.js uses Flow `import typeof` syntax that Bun cannot
// parse. Stub the module BEFORE importing any module that depends on it.
mock.module('react-native', () => ({
  Platform: { OS: 'ios' }, // native path — avoids the web branch
}));

// Dynamic import deferred until after mock.module() registers the stub.
const { wipeAllLocalStorage } = await import('../lib/storageEscape');

describe('wipeAllLocalStorage', () => {
  test('no-throw when window is undefined (native path)', async () => {
    // In Bun test env, window may be stubbed by tests/setup.ts. Save & restore.
    const originalWindow = (globalThis as any).window;
    delete (globalThis as any).window;
    // The function may try to import expo-updates which won't resolve in Bun;
    // it will catch and continue. Just verify it doesn't throw.
    await expect(wipeAllLocalStorage()).resolves.toBeUndefined();
    if (originalWindow !== undefined) (globalThis as any).window = originalWindow;
  });
});
