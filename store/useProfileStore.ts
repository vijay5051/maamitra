import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Stage = 'pregnant' | 'newborn' | 'planning';
export type ParentGender = 'mother' | 'father' | 'other' | '';
export type ParentRelation = 'mother' | 'father' | 'guardian' | 'grandparent' | 'aunt/uncle' | 'other' | '';

export interface Kid {
  id: string;
  name: string;
  dob: string; // ISO date string
  stage: Stage;
  gender: 'boy' | 'girl' | 'surprise';
  ageInMonths: number;
  ageInWeeks: number;
  isExpecting: boolean;
  relation?: ParentRelation; // this parent's relation to the child
}

export interface VisibilitySettings {
  showKids: boolean;
  showState: boolean;
  showExpertise: boolean;
  showBio: boolean;
  showPostCount: boolean;
}

export const DEFAULT_VISIBILITY: VisibilitySettings = {
  showKids: true,
  showState: true,
  showExpertise: true,
  showBio: true,
  showPostCount: true,
};

export interface Profile {
  stage: Stage;
  keyDate: string; // due date or baby DOB
  state: string;
  diet: 'vegetarian' | 'eggetarian' | 'non-vegetarian' | 'vegan';
  familyType: 'nuclear' | 'joint' | 'in-laws' | 'single-parent';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function calculateAgeInMonths(dob: string): number {
  // Append T00:00:00 only if no time component — prevents UTC-midnight day-shift in IST
  const birth = new Date(dob.includes('T') ? dob : dob + 'T00:00:00');
  const today = new Date();
  const years = today.getFullYear() - birth.getFullYear();
  const months = today.getMonth() - birth.getMonth();
  const days = today.getDate() - birth.getDate();
  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths -= 1;
  return Math.max(0, totalMonths);
}

export function calculateAgeInWeeks(dob: string): number {
  const birth = new Date(dob.includes('T') ? dob : dob + 'T00:00:00');
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
  completedVaccines: Record<string, Record<string, CompletedVaccine>>; // { kidId: { vaccineId: CompletedVaccine } }

  // Public profile fields
  photoUrl: string;
  parentGender: ParentGender;
  bio: string;
  expertise: string[];
  visibilitySettings: VisibilitySettings;

  setMotherName: (name: string) => void;
  setProfile: (profile: Profile) => void;
  addKid: (kid: Omit<Kid, 'ageInMonths' | 'ageInWeeks' | 'id'> & { id?: string }) => void;
  updateKid: (id: string, data: Partial<Omit<Kid, 'id'>>) => void;
  removeKid: (id: string) => void;
  setActiveKidId: (id: string) => void;
  setOnboardingComplete: (val: boolean) => void;
  getActiveKid: () => Kid | null;
  markVaccineDone: (vaccineId: string, kidId: string, doneDate?: string) => void;
  unmarkVaccineDone: (vaccineId: string, kidId: string) => void;
  /** Wipes ALL profile data — call on sign-out so no data leaks to the next user */
  resetProfile: () => void;

  // Public profile setters
  setPhotoUrl: (url: string) => void;
  setParentGender: (g: ParentGender) => void;
  setBio: (bio: string) => void;
  setExpertise: (tags: string[]) => void;
  setVisibilitySettings: (s: Partial<VisibilitySettings>) => void;
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

      // Public profile
      photoUrl: '',
      parentGender: '',
      bio: '',
      expertise: [],
      visibilitySettings: DEFAULT_VISIBILITY,

      setMotherName: (name) => set({ motherName: name }),

      setProfile: (profile) => set({ profile }),

      addKid: (kidData) => {
        const id = (kidData as any).id ?? Date.now().toString();
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

      removeKid: (id) => {
        set((state) => {
          const remaining = state.kids.filter((k) => k.id !== id);
          // If the active kid was deleted, use first remaining
          // Also validate that a non-deleted activeKidId still exists (guards against pre-existing stale IDs)
          const currentActiveValid = remaining.some((k) => k.id === state.activeKidId);
          const newActiveId = !currentActiveValid
            ? (remaining[0]?.id ?? null)
            : state.activeKidId;
          const completedVaccines = { ...state.completedVaccines };
          delete completedVaccines[id];
          return { kids: remaining, activeKidId: newActiveId, completedVaccines };
        });
      },

      setActiveKidId: (id) => set({ activeKidId: id }),

      setOnboardingComplete: (val) => set({ onboardingComplete: val }),

      getActiveKid: () => {
        const { kids, activeKidId } = get();
        return kids.find((k) => k.id === activeKidId) ?? kids[0] ?? null;
      },

      markVaccineDone: (vaccineId, kidId, doneDate) => {
        set((state) => ({
          completedVaccines: {
            ...state.completedVaccines,
            [kidId]: {
              ...(state.completedVaccines[kidId] ?? {}),
              [vaccineId]: { done: true, doneDate: doneDate ?? new Date().toISOString() },
            },
          },
        }));
      },

      unmarkVaccineDone: (vaccineId, kidId) => {
        set((state) => {
          const kidVaccines = { ...(state.completedVaccines[kidId] ?? {}) };
          delete kidVaccines[vaccineId];
          return {
            completedVaccines: {
              ...state.completedVaccines,
              [kidId]: kidVaccines,
            },
          };
        });
      },

      resetProfile: () =>
        set({
          motherName: '',
          profile: null,
          kids: [],
          activeKidId: null,
          onboardingComplete: false,
          completedVaccines: {},
          photoUrl: '',
          parentGender: '',
          bio: '',
          expertise: [],
          visibilitySettings: DEFAULT_VISIBILITY,
        }),

      setPhotoUrl: (url) => set({ photoUrl: url }),
      setParentGender: (g) => set({ parentGender: g }),
      setBio: (bio) => set({ bio }),
      setExpertise: (tags) => set({ expertise: tags }),
      setVisibilitySettings: (s) =>
        set((state) => ({ visibilitySettings: { ...state.visibilitySettings, ...s } })),
    }),
    {
      name: 'maamitra-profile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
