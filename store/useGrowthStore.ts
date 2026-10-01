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
  /** Growth measurements only: where it was taken. */
  place?: 'home' | 'clinic';
  /** Height entries only: measured lying down (length) or standing (height). */
  lengthMode?: 'lying' | 'standing';
}

/** One day's measurements, as saved by the Growth & Milestones form. */
export interface VisitInput {
  /** YYYY-MM-DD */
  date: string;
  weightKg?: number;
  lengthCm?: number;
  headCm?: number;
  lengthMode?: 'lying' | 'standing';
  place?: 'home' | 'clinic';
  note?: string;
}

const MEASURE_TRACKERS = ['weight', 'height', 'head'] as const;

function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type KidGrowthMap = Partial<Record<GrowthTracker, GrowthEntry[]>>;

interface GrowthState {
  byKid: Record<string /*kidId*/, KidGrowthMap>;

  hydrate: (byKid: Record<string, KidGrowthMap>) => void;
  addEntry: (kidId: string, tracker: GrowthTracker, entry: Omit<GrowthEntry, 'id'>) => void;
  updateEntry: (kidId: string, tracker: GrowthTracker, entryId: string, patch: Partial<GrowthEntry>) => void;
  deleteEntry: (kidId: string, tracker: GrowthTracker, entryId: string) => void;
  /**
   * Save one day's measurements for a child (add or edit). Values left
   * undefined are removed for that day; `replaceDate` is the visit's
   * previous date when the parent changed it. Other days, other children
   * and the diaper/sleep logs are never touched.
   */
  saveVisit: (kidId: string, visit: VisitInput, replaceDate?: string) => void;
  deleteVisit: (kidId: string, date: string) => void;
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

      saveVisit: (kidId, visit, replaceDate) => {
        set((state) => {
          const kidMap: KidGrowthMap = { ...(state.byKid[kidId] ?? {}) };
          const at = new Date(`${visit.date}T12:00:00`).toISOString();
          const values = { weight: visit.weightKg, height: visit.lengthCm, head: visit.headCm } as const;
          const drop = new Set([visit.date, replaceDate].filter(Boolean) as string[]);
          for (const tracker of MEASURE_TRACKERS) {
            const kept = (kidMap[tracker] ?? []).filter((e) => !drop.has(localDateKey(e.at)));
            const value = values[tracker];
            if (typeof value === 'number' && isFinite(value)) {
              const entry: GrowthEntry = { id: newId(), at, value };
              if (visit.note?.trim()) entry.note = visit.note.trim();
              if (visit.place) entry.place = visit.place;
              if (tracker === 'height' && visit.lengthMode) entry.lengthMode = visit.lengthMode;
              kept.push(entry);
            }
            kidMap[tracker] = sortDesc(kept);
          }
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      deleteVisit: (kidId, date) => {
        set((state) => {
          const existing = state.byKid[kidId];
          if (!existing) return state;
          const kidMap: KidGrowthMap = { ...existing };
          for (const tracker of MEASURE_TRACKERS) {
            kidMap[tracker] = (kidMap[tracker] ?? []).filter((e) => localDateKey(e.at) !== date);
          }
          const byKid = { ...state.byKid, [kidId]: kidMap };
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

// Formats a height in cm as `X ft Y in` (e.g. 67 cm → `2 ft 2.4 in`).
// Used by the Growth card so a parent can read their child's height in
// imperial units even when the underlying value was logged in cm.
export function cmToFtIn(cm: number): string {
  if (!isFinite(cm) || cm <= 0) return '— ft';
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inch = totalInches - ft * 12;
  return `${ft} ft ${inch.toFixed(1)} in`;
}

// Inverse of `cmToFtIn` — converts a feet+inches pair into cm. Used by the
// log sheet when the user enters height in imperial.
export function ftInToCm(ft: number, inch: number): number {
  const totalInches = (ft || 0) * 12 + (inch || 0);
  return totalInches * 2.54;
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
