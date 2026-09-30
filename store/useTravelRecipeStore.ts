import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  TravelRecipe,
  TravelCategory,
  TravelAllergen,
  TravelType,
  TRAVEL_RECIPES,
  filterTravelRecipes,
} from '../data/travelRecipes';
import { fetchTravelRecipes, syncTravelBookmarks, TravelBookmark } from '../services/travelRecipes';

// ─── Active filter state ──────────────────────────────────────────────────────

export interface TravelFilter {
  categories: TravelCategory[];
  noFridge: boolean;
  allergenFreeOf: TravelAllergen[];
  travelType: TravelType | null;
  hotWeather: boolean; // halves all eat-within times
}

const DEFAULT_FILTER: TravelFilter = {
  categories: [],
  noFridge: false,
  allergenFreeOf: [],
  travelType: null,
  hotWeather: false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

interface TravelRecipeState {
  recipes: TravelRecipe[];
  isLoading: boolean;
  lastFetchedAt: string | null;

  filter: TravelFilter;
  setFilter: (patch: Partial<TravelFilter>) => void;
  resetFilter: () => void;

  // Bookmarks (Mode A — My Travel Pack)
  bookmarks: Record<string, TravelBookmark>;
  toggleBookmark: (recipeId: string) => void;
  setTestedAtHome: (recipeId: string, tested: boolean) => void;
  isBookmarked: (recipeId: string) => boolean;

  /**
   * "Already tested at home?" per child, per recipe. Kept separate from
   * bookmarks — it used to live only on the bookmark, so the switch did
   * nothing for recipes that weren't saved to My Travel Pack.
   */
  testedByKid: Record<string /*kidId*/, Record<string /*recipeId*/, boolean>>;
  setTestedForKid: (kidId: string, recipeId: string, tested: boolean) => void;

  // Derived
  getFiltered: (ageMonths?: number) => TravelRecipe[];
  getBookmarkedRecipes: () => TravelRecipe[];

  // Actions
  fetchRecipes: () => Promise<void>;
  reset: () => void;
}

export const useTravelRecipeStore = create<TravelRecipeState>()(
  persist(
    (set, get) => ({
      recipes: TRAVEL_RECIPES,
      isLoading: false,
      lastFetchedAt: null,

      filter: DEFAULT_FILTER,

      setFilter: (patch) =>
        set((s) => ({ filter: { ...s.filter, ...patch } })),

      resetFilter: () => set({ filter: DEFAULT_FILTER }),

      bookmarks: {},

      toggleBookmark: (recipeId) => {
        set((s) => {
          const existing = s.bookmarks[recipeId];
          const next = { ...s.bookmarks };
          if (existing) {
            delete next[recipeId];
          } else {
            next[recipeId] = {
              recipeId,
              savedAt: new Date().toISOString(),
              testedAtHome: false,
            };
          }
          void syncTravelBookmarks(next);
          return { bookmarks: next };
        });
      },

      setTestedAtHome: (recipeId, tested) => {
        set((s) => {
          const bm = s.bookmarks[recipeId];
          if (!bm) return s;
          const next = { ...s.bookmarks, [recipeId]: { ...bm, testedAtHome: tested } };
          void syncTravelBookmarks(next);
          return { bookmarks: next };
        });
      },

      isBookmarked: (recipeId) => !!get().bookmarks[recipeId],

      testedByKid: {},
      setTestedForKid: (kidId, recipeId, tested) => {
        set((s) => ({
          testedByKid: {
            ...s.testedByKid,
            [kidId]: { ...(s.testedByKid[kidId] ?? {}), [recipeId]: tested },
          },
        }));
        // Mirror onto the bookmark (synced to Firestore) when there is one.
        get().setTestedAtHome(recipeId, tested);
      },

      getFiltered: (ageMonths) => {
        const { recipes, filter } = get();
        return filterTravelRecipes(recipes, {
          ageMonths,
          categories: filter.categories.length ? filter.categories : undefined,
          noFridge: filter.noFridge || undefined,
          allergenFreeOf: filter.allergenFreeOf.length ? filter.allergenFreeOf : undefined,
          travelType: filter.travelType ?? undefined,
        });
      },

      getBookmarkedRecipes: () => {
        const { recipes, bookmarks } = get();
        const ids = Object.keys(bookmarks);
        return recipes.filter((r) => ids.includes(r.id));
      },

      fetchRecipes: async () => {
        set({ isLoading: true });
        try {
          const fetched = await fetchTravelRecipes();
          set({ recipes: fetched, lastFetchedAt: new Date().toISOString() });
        } catch {
          // keep local seed
        } finally {
          set({ isLoading: false });
        }
      },

      reset: () =>
        set({
          bookmarks: {},
          testedByKid: {},
          filter: DEFAULT_FILTER,
          lastFetchedAt: null,
        }),
    }),
    {
      name: 'maamitra-travel-recipes',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        bookmarks: s.bookmarks,
        testedByKid: s.testedByKid,
        filter: s.filter,
        lastFetchedAt: s.lastFetchedAt,
      }),
    },
  ),
);
