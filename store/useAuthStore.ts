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
// Returns true if Firestore had data, false if not (used for migration trigger).
async function hydrateProfileFromFirestore(uid: string): Promise<boolean> {
  try {
    const fullProfile = await loadFullProfile(uid);
    if (!fullProfile) {
      // Firestore has no data — check if local store has completed onboarding data
      // (user completed onboarding before Firestore sync was added — migrate it now)
      const { onboardingComplete, motherName, profile, kids, completedVaccines } = useProfileStore.getState();
      if (onboardingComplete && motherName) {
        saveFullProfile(uid, { motherName, profile, kids, completedVaccines, onboardingComplete: true }).catch(console.error);
      }
      return false;
    }
    const { setMotherName, setProfile, addKid, setOnboardingComplete, markVaccineDone } = useProfileStore.getState();
    setMotherName(fullProfile.motherName);
    if (fullProfile.profile) setProfile(fullProfile.profile as any);
    // Avoid duplicate kids if store already has data
    const currentKids = useProfileStore.getState().kids;
    if (currentKids.length === 0 && fullProfile.kids.length > 0) {
      fullProfile.kids.forEach((kid: any) =>
        addKid({ name: kid.name, dob: kid.dob, stage: kid.stage, gender: kid.gender, isExpecting: kid.isExpecting })
      );
    }
    Object.entries(fullProfile.completedVaccines).forEach(([id, val]: [string, any]) => {
      markVaccineDone(id, val.doneDate);
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
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await getUserProfile(credential.user.uid);
      const authUser: AuthUser = {
        uid: credential.user.uid,
        name: profile?.name ?? credential.user.displayName ?? 'Mom',
        email: credential.user.email ?? email,
      };
      set({ user: authUser, isAuthenticated: true, isLoading: false });
      await hydrateProfileFromFirestore(credential.user.uid);
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
    const result = await firebaseSignInWithGoogle();
    if (!result) return null; // User cancelled
    const profile = await getUserProfile(result.uid);
    set({ user: result, isAuthenticated: true, isLoading: false });
    await hydrateProfileFromFirestore(result.uid);
    // If profile has onboardingComplete, go to tabs; otherwise onboarding
    return profile?.onboardingComplete ? 'tabs' : 'onboarding';
  },

  signOut: async () => {
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
    if (!isFirebaseConfigured() || !auth) {
      // No Firebase — use demo user so the app can be previewed
      set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            name: profile?.name ?? firebaseUser.displayName ?? 'Mom',
            email: firebaseUser.email ?? '',
          };
          set({ user: authUser, isAuthenticated: true, isLoading: false });
          await hydrateProfileFromFirestore(firebaseUser.uid);
        } catch {
          set({
            user: {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName ?? 'Mom',
              email: firebaseUser.email ?? '',
            },
            isAuthenticated: true,
            isLoading: false,
          });
          await hydrateProfileFromFirestore(firebaseUser.uid);
        }
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    });

    // Return unsubscribe — callers can store this if needed
    return unsubscribe;
  },
}));
