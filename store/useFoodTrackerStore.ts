import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, syncFoodTracking } from '../services/firebase';

export type FoodReaction = 'none' | 'rash' | 'upset' | 'vomit' | 'fussy' | 'other';

export interface FoodEntry {
  /** YYYY-MM-DD strings — one per 3-day-rule slot. */
  d1Date?: string;
  d2Date?: string;
  d3Date?: string;
  reaction?: FoodReaction;
  reactionNote?: string;
  notes?: string;
  /** Convenience flag derived from d1+d2+d3 — kept so old data is forward-compatible. */
  cleared?: boolean;
}

export type KidFoodMap = Record<string /*foodId*/, FoodEntry>;

interface FoodTrackerState {
  byKid: Record<string /*kidId*/, KidFoodMap>;

  hydrate: (byKid: Record<string, KidFoodMap>) => void;
  /** Toggle a single day off/on. Date defaults to today (local). */
  toggleDay: (kidId: string, foodId: string, day: 1 | 2 | 3, date?: string) => void;
  setReaction: (kidId: string, foodId: string, reaction: FoodReaction, note?: string) => void;
  setNotes: (kidId: string, foodId: string, notes: string) => void;
  /** Replace the entire entry for a food (used by the detail sheet save). */
  setEntry: (kidId: string, foodId: string, entry: FoodEntry) => void;
  clearFood: (kidId: string, foodId: string) => void;
  getKidFoods: (kidId: string) => KidFoodMap;
  resetFoods: () => void;
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pushToFirestore(byKid: Record<string, KidFoodMap>) {
  const uid = auth?.currentUser?.uid;
  if (uid) {
    syncFoodTracking(uid, byKid).catch(() => {
      // sync failure is non-blocking — local persist still saves
    });
  }
}

function deriveCleared(entry: FoodEntry): boolean {
  return !!(entry.d1Date && entry.d2Date && entry.d3Date && entry.reaction !== 'rash' && entry.reaction !== 'vomit');
}

export const useFoodTrackerStore = create<FoodTrackerState>()(
  persist(
    (set, get) => ({
      byKid: {},

      hydrate: (byKid) => set({ byKid: byKid ?? {} }),

      toggleDay: (kidId, foodId, day, date) => {
        const safeDate = date ?? todayLocal();
        set((state) => {
          const kidMap: KidFoodMap = { ...(state.byKid[kidId] ?? {}) };
          const existing: FoodEntry = { ...(kidMap[foodId] ?? {}) };
          const key = day === 1 ? 'd1Date' : day === 2 ? 'd2Date' : 'd3Date';
          // Toggle: if already set, clear it; otherwise stamp today.
          if (existing[key]) {
            existing[key] = undefined;
          } else {
            existing[key] = safeDate;
          }
          existing.cleared = deriveCleared(existing);
          kidMap[foodId] = existing;
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      setReaction: (kidId, foodId, reaction, note) => {
        set((state) => {
          const kidMap: KidFoodMap = { ...(state.byKid[kidId] ?? {}) };
          const existing: FoodEntry = { ...(kidMap[foodId] ?? {}) };
          existing.reaction = reaction;
          if (note !== undefined) existing.reactionNote = note;
          existing.cleared = deriveCleared(existing);
          kidMap[foodId] = existing;
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      setNotes: (kidId, foodId, notes) => {
        set((state) => {
          const kidMap: KidFoodMap = { ...(state.byKid[kidId] ?? {}) };
          const existing: FoodEntry = { ...(kidMap[foodId] ?? {}) };
          existing.notes = notes;
          kidMap[foodId] = existing;
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      setEntry: (kidId, foodId, entry) => {
        set((state) => {
          const kidMap: KidFoodMap = { ...(state.byKid[kidId] ?? {}) };
          const merged: FoodEntry = { ...entry, cleared: deriveCleared(entry) };
          kidMap[foodId] = merged;
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      clearFood: (kidId, foodId) => {
        set((state) => {
          const existing = state.byKid[kidId];
          if (!existing || !(foodId in existing)) return state;
          const kidMap = { ...existing };
          delete kidMap[foodId];
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      getKidFoods: (kidId) => get().byKid[kidId] ?? {},

      resetFoods: () => set({ byKid: {} }),
    }),
    {
      name: 'maamitra-foods',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
