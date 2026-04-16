import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  isFirebaseConfigured,
  auth,
  saveUserProfile,
  getUserProfile,
  loadFullProfile,
  saveFullProfile,
  deleteUserAccount,
  signInWithGoogle as firebaseSignInWithGoogle,
  sendVerificationEmail,
} from '../services/firebase';
import { useProfileStore } from './useProfileStore';

// Helper — populate profile store from Firestore after any successful login.
// IMPORTANT: always call resetProfile() before this so no previous user's data leaks.
// Returns true if Firestore had data, false if not.
async function hydrateProfileFromFirestore(uid: string): Promise<boolean> {
  try {
    const fullProfile = await loadFullProfile(uid);
    if (!fullProfile) {
      return false;
    }
    // Reset before populating — makes this function idempotent even if called twice
    // (prevents duplicate kids when both signIn and onAuthStateChanged call this)
    useProfileStore.getState().resetProfile();
    const { setMotherName, setProfile, addKid, setOnboardingComplete, markVaccineDone } = useProfileStore.getState();
    setMotherName(fullProfile.motherName);
    if (fullProfile.profile) setProfile(fullProfile.profile as any);
    // Restore kids with their saved IDs so completedVaccines mapping stays intact
    fullProfile.kids.forEach((kid: any) =>
      addKid({ id: kid.id, name: kid.name, dob: kid.dob, stage: kid.stage, gender: kid.gender, isExpecting: kid.isExpecting })
    );
    // Per-kid vaccine structure: { kidId: { vaccineId: { done, doneDate } } }
    // Old flat format (vaccineId → { done, doneDate }) is silently ignored
    Object.entries(fullProfile.completedVaccines).forEach(([kidId, vaccines]: [string, any]) => {
      if (typeof vaccines === 'object' && vaccines !== null && !('done' in vaccines)) {
        Object.entries(vaccines).forEach(([vaccineId, val]: [string, any]) => {
          if (val?.done) markVaccineDone(vaccineId, kidId, val.doneDate);
        });
      }
    });
    setOnboardingComplete(true);
    return true;
  } catch (error) {
    console.error('hydrateProfileFromFirestore error:', error);
    return false;
  }
}

interface AuthUser {
  uid: string;
  name: string;
  email: string;
}

const MOCK_USER: AuthUser = {
  uid: 'demo-user',
  name: 'Demo Mom',
  email: 'demo@maamitra.app',
};

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<'onboarding' | 'tabs' | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  signIn: async (email: string, password: string) => {
    if (!isFirebaseConfigured() || !auth) {
      // Mock auth — demo mode
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }
    set({ isLoading: true });
    // Always wipe local profile data before loading a new user's data
    useProfileStore.getState().resetProfile();
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(credential.user.uid);
      const authUser: AuthUser = {
        uid: credential.user.uid,
        name: profile?.name ?? credential.user.displayName ?? 'Mom',
        email: credential.user.email ?? email,
      };
      // Hydrate profile BEFORE setting isAuthenticated — prevents index.tsx from
      // seeing the transient state: isAuthenticated:true + onboardingComplete:false
      await hydrateProfileFromFirestore(credential.user.uid);
      set({ user: authUser, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, name: string) => {
    if (!isFirebaseConfigured() || !auth) {
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }
    // Wipe any stale data from a previous user before creating new account
    useProfileStore.getState().resetProfile();
    set({ isLoading: true });
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const authUser: AuthUser = {
        uid: credential.user.uid,
        name,
        email: credential.user.email ?? email,
      };
      await saveUserProfile(credential.user.uid, { name, email, createdAt: new Date().toISOString() });
      // Send email verification
      await sendVerificationEmail().catch(() => {}); // non-blocking
      set({ user: authUser, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signInWithGoogle: async () => {
    if (!isFirebaseConfigured() || !auth) {
      // Demo mode
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return 'tabs';
    }
    // Wipe local data before loading new user
    useProfileStore.getState().resetProfile();
    set({ isLoading: true });
    const result = await firebaseSignInWithGoogle();
    if (!result) { set({ isLoading: false }); return null; } // User cancelled
    const profile = await getUserProfile(result.uid);
    // Hydrate profile BEFORE setting isAuthenticated to avoid the transient
    // state where isAuthenticated:true but onboardingComplete:false
    const hadProfile = await hydrateProfileFromFirestore(result.uid);
    set({ user: result, isAuthenticated: true, isLoading: false });
    // If profile has onboardingComplete, go to tabs; otherwise onboarding
    return (profile?.onboardingComplete || hadProfile) ? 'tabs' : 'onboarding';
  },

  signOut: async () => {
    // Always wipe local profile data immediately on sign-out — before any async calls
    useProfileStore.getState().resetProfile();
    if (!isFirebaseConfigured() || !auth) {
      set({ user: null, isAuthenticated: false });
      return;
    }
    try {
      await firebaseSignOut(auth);
      set({ user: null, isAuthenticated: false });
    } catch (error) {
      console.error('signOut error:', error);
      throw error;
    }
  },

  deleteAccount: async () => {
    const { user } = useAuthStore.getState();
    if (!isFirebaseConfigured() || !auth) {
      // Mock mode — just sign out
      set({ user: null, isAuthenticated: false });
      return;
    }
    if (!user) throw new Error('Not logged in');
    await deleteUserAccount(user.uid);
    set({ user: null, isAuthenticated: false });
  },

  initAuth: () => {
    // Demo bypass: if maamitra-demo flag is set in localStorage, skip Firebase auth
    if (typeof window !== 'undefined' && localStorage.getItem('maamitra-demo') === 'true') {
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }

    if (!isFirebaseConfigured() || !auth) {
      // No Firebase — use demo user so the app can be previewed
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Clear any stale profile data from a previous session/user
        useProfileStore.getState().resetProfile();
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            name: profile?.name ?? firebaseUser.displayName ?? 'Mom',
            email: firebaseUser.email ?? '',
          };
          // Hydrate profile BEFORE setting isAuthenticated so index.tsx never sees
          // the transient state: isAuthenticated:true + onboardingComplete:false
          await hydrateProfileFromFirestore(firebaseUser.uid);
          set({ user: authUser, isAuthenticated: true, isLoading: false });
        } catch {
          // Even on error, try to hydrate then set authenticated
          await hydrateProfileFromFirestore(firebaseUser.uid);
          set({
            user: {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName ?? 'Mom',
              email: firebaseUser.email ?? '',
            },
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else {
        useProfileStore.getState().resetProfile();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    });

    // Return unsubscribe — callers can store this if needed
    return unsubscribe;
  },
}));
