import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, syncGrowthTracking } from '../services/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────
// Five trackers, each stored as an ordered list of entries per kid.
//   weight  — value in kg
//   height  — value in cm (UI converts to inches on demand)
//   head    — head circumference in cm
//   diaper  — categorical (wet / dirty / mixed), occurredAt is the log time
//   sleep   — startAt + endAt, duration derived
//
// A uniform envelope keeps the store simple; the `value` field is null for
// trackers that don't carry a single numeric value (diaper/sleep).

export type GrowthTracker = 'weight' | 'height' | 'head' | 'diaper' | 'sleep';

export type DiaperKind = 'wet' | 'dirty' | 'mixed';

export interface GrowthEntry {
  id: string;
  /** ISO timestamp the measurement / event refers to. */
  at: string;
  /** Numeric value in the canonical unit: kg for weight, cm for height & head. */
  value?: number;
  /** Diaper-only fields. */
  diaperKind?: DiaperKind;
  /** Sleep-only fields — ISO timestamps. Duration minutes is derived. */
  sleepStart?: string;
  sleepEnd?: string;
  note?: string;
}

export type KidGrowthMap = Partial<Record<GrowthTracker, GrowthEntry[]>>;

interface GrowthState {
  byKid: Record<string /*kidId*/, KidGrowthMap>;

  hydrate: (byKid: Record<string, KidGrowthMap>) => void;
  addEntry: (kidId: string, tracker: GrowthTracker, entry: Omit<GrowthEntry, 'id'>) => void;
  updateEntry: (kidId: string, tracker: GrowthTracker, entryId: string, patch: Partial<GrowthEntry>) => void;
  deleteEntry: (kidId: string, tracker: GrowthTracker, entryId: string) => void;
  getEntries: (kidId: string, tracker: GrowthTracker) => GrowthEntry[];
  resetGrowth: () => void;
}

function pushToFirestore(byKid: Record<string, KidGrowthMap>) {
  const uid = auth?.currentUser?.uid;
  if (uid) {
    syncGrowthTracking(uid, byKid).catch(() => {
      // non-blocking — local persist still keeps the write
    });
  }
}

function newId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Entries are stored sorted DESC by `at` so the latest is always index 0.
function sortDesc(list: GrowthEntry[]): GrowthEntry[] {
  return [...list].sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return tb - ta;
  });
}

export const useGrowthStore = create<GrowthState>()(
  persist(
    (set, get) => ({
      byKid: {},

      hydrate: (byKid) => set({ byKid: byKid ?? {} }),

      addEntry: (kidId, tracker, entry) => {
        set((state) => {
          const kidMap: KidGrowthMap = { ...(state.byKid[kidId] ?? {}) };
          const list = kidMap[tracker] ?? [];
          const next: GrowthEntry = { id: newId(), ...entry };
          kidMap[tracker] = sortDesc([next, ...list]);
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      updateEntry: (kidId, tracker, entryId, patch) => {
        set((state) => {
          const kidMap = state.byKid[kidId];
          if (!kidMap || !kidMap[tracker]) return state;
          const list = kidMap[tracker]!.map((e) => (e.id === entryId ? { ...e, ...patch } : e));
          const nextKidMap: KidGrowthMap = { ...kidMap, [tracker]: sortDesc(list) };
          const byKid = { ...state.byKid, [kidId]: nextKidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      deleteEntry: (kidId, tracker, entryId) => {
        set((state) => {
          const kidMap = state.byKid[kidId];
          if (!kidMap || !kidMap[tracker]) return state;
          const list = kidMap[tracker]!.filter((e) => e.id !== entryId);
          const nextKidMap: KidGrowthMap = { ...kidMap, [tracker]: list };
          const byKid = { ...state.byKid, [kidId]: nextKidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      getEntries: (kidId, tracker) => {
        const list = get().byKid[kidId]?.[tracker] ?? [];
        return list;
      },

      resetGrowth: () => set({ byKid: {} }),
    }),
    {
      name: 'maamitra-growth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ─── Display helpers ──────────────────────────────────────────────────────────

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

export function sleepDurationMinutes(e: GrowthEntry): number {
  if (!e.sleepStart || !e.sleepEnd) return 0;
  const ms = new Date(e.sleepEnd).getTime() - new Date(e.sleepStart).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
