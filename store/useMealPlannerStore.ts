import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, syncMealPlanner } from '../services/firebase';
import { DayKey, getMondayOf, formatYMD } from '../lib/weekKeys';

export interface PlannedDay {
  recipeId?: string;
  freeText?: string;
  plannedAt: string;
}

export interface PlannerWeek {
  weekStartDate: string; // YYYY-MM-DD of local Monday
  days: Partial<Record<DayKey, PlannedDay>>;
}

export interface KidPlanner {
  current: PlannerWeek;
  history: PlannerWeek[]; // last 8 weeks, FIFO
}

interface MealPlannerState {
  byKid: Record<string /* kidId */, KidPlanner>;

  hydrate: (byKid: Record<string, KidPlanner>) => void;
  setDay: (kidId: string, dayKey: DayKey, payload: { recipeId?: string; freeText?: string }) => void;
  clearDay: (kidId: string, dayKey: DayKey) => void;
  /** Called on mount — archives the current week into history if it's no longer this week. */
  rolloverIfStale: (kidId: string) => void;
  resetPlanner: () => void;
}

function freshWeek(): PlannerWeek {
  return {
    weekStartDate: formatYMD(getMondayOf(new Date())),
    days: {},
  };
}

function freshKidPlanner(): KidPlanner {
  return { current: freshWeek(), history: [] };
}

function pushToFirestore(byKid: Record<string, KidPlanner>) {
  const uid = auth?.currentUser?.uid;
  if (uid) {
    syncMealPlanner(uid, byKid).catch(() => {
      // non-blocking — local persist still saves
    });
  }
}

export const useMealPlannerStore = create<MealPlannerState>()(
  persist(
    (set, get) => ({
      byKid: {},

      hydrate: (byKid) => set({ byKid: byKid ?? {} }),

      setDay: (kidId, dayKey, payload) => {
        set((state) => {
          const kid = state.byKid[kidId] ?? freshKidPlanner();
          const today = new Date();
          const currentMonday = formatYMD(getMondayOf(today));
          // Rollover inline if needed
          let current = kid.current;
          let history = kid.history;
          if (current.weekStartDate !== currentMonday) {
            history = [current, ...history].slice(0, 8);
            current = freshWeek();
          }
          const days = {
            ...current.days,
            [dayKey]: {
              ...payload,
              plannedAt: new Date().toISOString(),
            },
          };
          const nextKid: KidPlanner = { current: { ...current, days }, history };
          const byKid = { ...state.byKid, [kidId]: nextKid };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      clearDay: (kidId, dayKey) => {
        set((state) => {
          const kid = state.byKid[kidId];
          if (!kid) return state;
          const days = { ...kid.current.days };
          delete days[dayKey];
          const nextKid: KidPlanner = { ...kid, current: { ...kid.current, days } };
          const byKid = { ...state.byKid, [kidId]: nextKid };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      rolloverIfStale: (kidId) => {
        set((state) => {
          const kid = state.byKid[kidId];
          if (!kid) return state;
          const currentMonday = formatYMD(getMondayOf(new Date()));
          if (kid.current.weekStartDate === currentMonday) return state;
          const history = [kid.current, ...kid.history].slice(0, 8);
          const nextKid: KidPlanner = { current: freshWeek(), history };
          const byKid = { ...state.byKid, [kidId]: nextKid };
          pushToFirestore(byKid);
          return { byKid };
        });
      },

      resetPlanner: () => set({ byKid: {} }),
    }),
    {
      name: 'maamitra-meal-planner',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Convenience: get the recipe IDs the kid has planned in the current + history weeks within the last 7 days. */
export function getLast7DaysRecipeIds(kidPlanner: KidPlanner | undefined): string[] {
  if (!kidPlanner) return [];
  const ids: string[] = [];
  const allWeeks = [kidPlanner.current, ...kidPlanner.history.slice(0, 1)]; // current + previous
  for (const w of allWeeks) {
    for (const d of Object.values(w.days)) {
      if (d?.recipeId) ids.push(d.recipeId);
    }
  }
  return ids;
}
