import { mock, describe, it, expect, beforeEach } from 'bun:test';

mock.module('react-native', () => ({
  Platform: { OS: 'ios', select: (obj: any) => obj.ios ?? obj.default },
  NativeModules: {},
  NativeEventEmitter: class {},
}));
const disk: Record<string, string> = {};
mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => disk[k] ?? null,
    setItem: async (k: string, v: string) => { disk[k] = v; },
    removeItem: async (k: string) => { delete disk[k]; },
  },
}));
const synced: any[] = [];
mock.module('../../services/firebase', () => ({
  auth: { currentUser: { uid: 'u1' } },
  syncGrowthTracking: (uid: string, byKid: any) => { synced.push(JSON.parse(JSON.stringify(byKid))); return Promise.resolve(); },
  // Module mocks are shared across test files — keep the other store's export alive.
  syncMealPlanner: () => Promise.resolve(),
}));

const { useGrowthStore } = await import('../../store/useGrowthStore');
const { visitsFromGrowth } = await import('../../lib/growth');

const visits = (kid: string) => visitsFromGrowth(useGrowthStore.getState().byKid[kid]);

describe('useGrowthStore — measurement visits', () => {
  beforeEach(() => { useGrowthStore.getState().resetGrowth(); synced.length = 0; });

  it('saves a partial visit and keeps children separate', () => {
    const s = useGrowthStore.getState();
    s.saveVisit('navi', { date: '2026-06-01', weightKg: 7.2, place: 'home' });
    s.saveVisit('dhairyaa', { date: '2026-06-01', weightKg: 19.5, lengthCm: 112, lengthMode: 'standing' });
    expect(visits('navi')).toEqual([{ date: '2026-06-01', weightKg: 7.2, place: 'home' }]);
    expect(visits('dhairyaa')[0].lengthCm).toBe(112);
    s.deleteVisit('navi', '2026-06-01');
    expect(visits('navi')).toEqual([]);
    expect(visits('dhairyaa').length).toBe(1);
  });

  it('editing replaces that day only, and can move the date', () => {
    const s = useGrowthStore.getState();
    s.saveVisit('k', { date: '2026-01-14', weightKg: 3.1, lengthCm: 49, headCm: 34 });
    s.saveVisit('k', { date: '2026-03-14', weightKg: 5.4 });
    s.saveVisit('k', { date: '2026-03-14', weightKg: 5.5, headCm: 39, note: 'clinic scale' });
    expect(visits('k')).toEqual([
      { date: '2026-01-14', weightKg: 3.1, lengthCm: 49, headCm: 34 },
      { date: '2026-03-14', weightKg: 5.5, headCm: 39, note: 'clinic scale' },
    ]);
    s.saveVisit('k', { date: '2026-03-16', weightKg: 5.5 }, '2026-03-14');
    expect(visits('k').map((v) => v.date)).toEqual(['2026-01-14', '2026-03-16']);
    expect(useGrowthStore.getState().byKid.k.weight!.length).toBe(2);
  });

  it('preserves records made by the older per-tracker screens and the diaper/sleep logs', () => {
    const s = useGrowthStore.getState();
    s.addEntry('k', 'weight', { at: '2026-02-01T09:00:00.000Z', value: 4.4 });
    s.addEntry('k', 'diaper', { at: '2026-06-01T09:00:00.000Z', diaperKind: 'wet' });
    s.saveVisit('k', { date: '2026-06-01', weightKg: 7.2 });
    expect(visits('k').map((v) => v.weightKg)).toEqual([4.4, 7.2]);
    expect(useGrowthStore.getState().byKid.k.diaper!.length).toBe(1);
  });

  it('persists locally and syncs to Firebase on every change', async () => {
    useGrowthStore.getState().saveVisit('k', { date: '2026-06-01', weightKg: 7.2 });
    expect(synced.length).toBe(1);
    expect(synced[0].k.weight[0].value).toBe(7.2);
    await new Promise((r) => setTimeout(r, 10));
    const stored = JSON.parse(disk['maamitra-growth']).state.byKid;
    expect(stored.k.weight[0].value).toBe(7.2);
    // Rehydrating from what was stored gives the same visit back.
    useGrowthStore.getState().resetGrowth();
    useGrowthStore.getState().hydrate(stored);
    expect(visits('k')).toEqual([{ date: '2026-06-01', weightKg: 7.2 }]);
  });
});
