import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Stage = 'pregnant' | 'newborn' | 'planning';

export interface Kid {
  id: string;
  name: string;
  dob: string; // ISO date string
  stage: Stage;
  gender: 'boy' | 'girl' | 'surprise';
  ageInMonths: number;
  ageInWeeks: number;
  isExpecting: boolean;
}

export interface Profile {
  stage: Stage;
  keyDate: string; // due date or baby DOB
  state: string;
  diet: 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan';
  familyType: 'nuclear' | 'joint' | 'in-laws' | 'single-parent';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calculateAgeInMonths(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  const years = today.getFullYear() - birth.getFullYear();
  const months = today.getMonth() - birth.getMonth();
  const days = today.getDate() - birth.getDate();
  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths -= 1;
  return Math.max(0, totalMonths);
}

export function calculateAgeInWeeks(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  const diffMs = today.getTime() - birth.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface CompletedVaccine {
  done: boolean;
  doneDate?: string; // ISO date string when marked done
}

interface ProfileState {
  motherName: string;
  profile: Profile | null;
  kids: Kid[];
  activeKidId: string | null;
  onboardingComplete: boolean;
  completedVaccines: Record<string, CompletedVaccine>; // vaccineId → completion

  setMotherName: (name: string) => void;
  setProfile: (profile: Profile) => void;
  addKid: (kid: Omit<Kid, 'id' | 'ageInMonths' | 'ageInWeeks'>) => void;
  updateKid: (id: string, data: Partial<Omit<Kid, 'id'>>) => void;
  setActiveKidId: (id: string) => void;
  setOnboardingComplete: (val: boolean) => void;
  getActiveKid: () => Kid | null;
  markVaccineDone: (vaccineId: string, doneDate?: string) => void;
  unmarkVaccineDone: (vaccineId: string) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      motherName: '',
      profile: null,
      kids: [],
      activeKidId: null,
      onboardingComplete: false,
      completedVaccines: {},

      setMotherName: (name) => set({ motherName: name }),

      setProfile: (profile) => set({ profile }),

      addKid: (kidData) => {
        const id = Date.now().toString();
        // Safety: if DOB is in the past, never treat as expecting
        const dobDate = kidData.dob ? new Date(kidData.dob) : null;
        const dobInFuture = dobDate ? dobDate > new Date() : false;
        const isExpecting = kidData.isExpecting && dobInFuture;
        const normalizedKidData = { ...kidData, isExpecting, stage: isExpecting ? kidData.stage : 'newborn' as Stage };
        const ageInMonths = isExpecting ? 0 : calculateAgeInMonths(normalizedKidData.dob);
        const ageInWeeks = isExpecting ? 0 : calculateAgeInWeeks(normalizedKidData.dob);
        const kid: Kid = { ...normalizedKidData, id, ageInMonths, ageInWeeks };
        set((state) => ({
          kids: [...state.kids, kid],
          activeKidId: state.activeKidId ?? id,
        }));
      },

      updateKid: (id, data) => {
        set((state) => ({
          kids: state.kids.map((k) => {
            if (k.id !== id) return k;
            const updated = { ...k, ...data };
            if (!updated.isExpecting && updated.dob) {
              updated.ageInMonths = calculateAgeInMonths(updated.dob);
              updated.ageInWeeks = calculateAgeInWeeks(updated.dob);
            }
            return updated;
          }),
        }));
      },

      setActiveKidId: (id) => set({ activeKidId: id }),

      setOnboardingComplete: (val) => set({ onboardingComplete: val }),

      getActiveKid: () => {
        const { kids, activeKidId } = get();
        return kids.find((k) => k.id === activeKidId) ?? kids[0] ?? null;
      },

      markVaccineDone: (vaccineId, doneDate) => {
        set((state) => ({
          completedVaccines: {
            ...state.completedVaccines,
            [vaccineId]: { done: true, doneDate: doneDate ?? new Date().toISOString() },
          },
        }));
      },

      unmarkVaccineDone: (vaccineId) => {
        set((state) => {
          const next = { ...state.completedVaccines };
          delete next[vaccineId];
          return { completedVaccines: next };
        });
      },
    }),
    {
      name: 'maamitra-profile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
