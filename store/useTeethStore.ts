import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, syncTeethTracking } from '../services/firebase';

export type ToothState = 'not-erupted' | 'erupted' | 'shed';

export interface ToothEntry {
  state: ToothState;
  /** ISO date YYYY-MM-DD when the tooth first appeared. */
  eruptDate?: string;
  /** ISO date YYYY-MM-DD when the tooth was shed. */
  shedDate?: string;
  note?: string;
}

export type KidTeethMap = Record<string /*toothId (FDI)*/, ToothEntry>;

interface TeethState {
  byKid: Record<string /*kidId*/, KidTeethMap>;

  /** Replace local map with the one loaded from Firestore on auth bootstrap. */
  hydrate: (byKid: Record<string, KidTeethMap>) => void;
  setToothState: (kidId: string, toothId: string, entry: ToothEntry) => void;
  clearTooth: (kidId: string, toothId: string) => void;
  getKidTeeth: (kidId: string) => KidTeethMap;
  getEruptedCount: (kidId: string) => number;
  getShedCount: (kidId: string) => number;
  resetTeeth: () => void;
}

function pushToFirestore(byKid: Record<string, KidTeethMap>) {
  const uid = auth?.currentUser?.uid;
  if (uid) {
    syncTeethTracking(uid, byKid).catch(() => {
      // sync failure is non-blocking — local state still saved via persist
    });
  }
}

export const useTeethStore = create<TeethState>()(
  persist(
    (set, get) => ({
      byKid: {},

      hydrate: (byKid) => set({ byKid: byKid ?? {} }),

      setToothState: (kidId, toothId, entry) => {
        set((state) => {
          const kidMap: KidTeethMap = { ...(state.byKid[kidId] ?? {}), [toothId]: entry };
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      clearTooth: (kidId, toothId) => {
        set((state) => {
          const existing = state.byKid[kidId];
          if (!existing || !(toothId in existing)) return state;
          const kidMap = { ...existing };
          delete kidMap[toothId];
          const byKid = { ...state.byKid, [kidId]: kidMap };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      getKidTeeth: (kidId) => get().byKid[kidId] ?? {},

      getEruptedCount: (kidId) => {
        const map = get().byKid[kidId] ?? {};
        return Object.values(map).filter((e) => e.state === 'erupted').length;
      },

      getShedCount: (kidId) => {
        const map = get().byKid[kidId] ?? {};
        return Object.values(map).filter((e) => e.state === 'shed').length;
      },

      resetTeeth: () => set({ byKid: {} }),
    }),
    {
      name: 'maamitra-teeth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
