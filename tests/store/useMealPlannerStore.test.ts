import { mock, describe, it, expect, beforeEach } from 'bun:test';

// react-native's index.js uses Flow `import typeof` syntax that Bun cannot
// parse. Stub the module BEFORE importing any module that depends on it.
mock.module('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: any) => obj.ios ?? obj.default },
  NativeModules: {},
  NativeEventEmitter: class {},
}));

// Mock AsyncStorage (native module — unavailable in Bun's Node-like test env)
mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

// Mock the firebase service — auth.currentUser is null so pushToFirestore is a no-op
mock.module('../../services/firebase', () => ({
  auth: { currentUser: null },
  syncMealPlanner: () => Promise.resolve(),
}));

// Dynamic import deferred until after mock.module() registers all stubs.
const { useMealPlannerStore } = await import('../../store/useMealPlannerStore');

beforeEach(() => {
  useMealPlannerStore.getState().resetPlanner();
});

describe('useMealPlannerStore', () => {
  it('starts empty', () => {
    expect(useMealPlannerStore.getState().byKid).toEqual({});
  });

  it('sets a day for a kid', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    const kid = useMealPlannerStore.getState().byKid['kid-1'];
    expect(kid.current.days.mon?.recipeId).toBe('aloo-paratha');
    expect(kid.current.weekStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('overwrites a previously-set day', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'dosa' });
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.mon?.recipeId).toBe('dosa');
  });

  it('clears a day', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    useMealPlannerStore.getState().clearDay('kid-1', 'mon');
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.mon).toBeUndefined();
  });

  it('supports free-text fallback', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'tue', { freeText: 'leftover dal-rice' });
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.tue?.freeText).toBe('leftover dal-rice');
  });

  it('isolates by kid', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    useMealPlannerStore.getState().setDay('kid-2', 'mon', { recipeId: 'dosa' });
    expect(useMealPlannerStore.getState().byKid['kid-1'].current.days.mon?.recipeId).toBe('aloo-paratha');
    expect(useMealPlannerStore.getState().byKid['kid-2'].current.days.mon?.recipeId).toBe('dosa');
  });

  it('hydrate replaces byKid', () => {
    useMealPlannerStore.getState().setDay('kid-1', 'mon', { recipeId: 'aloo-paratha' });
    useMealPlannerStore.getState().hydrate({ 'kid-9': { current: { weekStartDate: '2026-01-05', days: {} }, history: [] } });
    expect(Object.keys(useMealPlannerStore.getState().byKid)).toEqual(['kid-9']);
  });
});
