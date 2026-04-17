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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from './useProfileStore';
import { useWellnessStore } from './useWellnessStore';
import { useChatStore } from './useChatStore';

// Lazy-accessed to avoid circular dependency (useSocialStore imports useAuthStore)
const getSocialStore = () => require('./useSocialStore').useSocialStore;
const getCommunityStore = () => require('./useCommunityStore').useCommunityStore;

// Tracks UIDs currently being hydrated to prevent duplicate concurrent calls
const _hydratingUids = new Set<string>();

// Helper — populate profile store from Firestore after any successful login.
// IMPORTANT: always call resetProfile() before this so no previous user's data leaks.
// Returns true if Firestore had data, false if not.
async function hydrateProfileFromFirestore(uid: string): Promise<boolean> {
  if (_hydratingUids.has(uid)) {
    // Another call is already hydrating this UID — wait for it then return current state
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    return useProfileStore.getState().onboardingComplete;
  }
  _hydratingUids.add(uid);
  try {
    const fullProfile = await loadFullProfile(uid);
    if (!fullProfile) {
      return false;
    }
    useProfileStore.getState().resetProfile();
    const { setMotherName, setProfile, addKid, setOnboardingComplete, markVaccineDone } = useProfileStore.getState();
    setMotherName(fullProfile.motherName);
    if (fullProfile.profile) setProfile(fullProfile.profile as any);
    fullProfile.kids.forEach((kid: any) =>
      addKid({ id: kid.id, name: kid.name, dob: kid.dob, stage: kid.stage, gender: kid.gender, isExpecting: kid.isExpecting, relation: kid.relation || '' })
    );
    Object.entries(fullProfile.completedVaccines).forEach(([kidId, vaccines]: [string, any]) => {
      if (typeof vaccines === 'object' && vaccines !== null && !('done' in vaccines)) {
        Object.entries(vaccines).forEach(([vaccineId, val]: [string, any]) => {
          if (val?.done) markVaccineDone(vaccineId, kidId, val.doneDate);
        });
      }
    });
    setOnboardingComplete(fullProfile.onboardingComplete);
    const { setParentGender, setBio, setExpertise, setPhotoUrl, setVisibilitySettings } = useProfileStore.getState();
    if (fullProfile.parentGender) setParentGender(fullProfile.parentGender as any);
    if (fullProfile.bio) setBio(fullProfile.bio);
    if (fullProfile.expertise?.length) setExpertise(fullProfile.expertise);
    if (fullProfile.photoUrl) setPhotoUrl(fullProfile.photoUrl);
    if (fullProfile.visibilitySettings) setVisibilitySettings(fullProfile.visibilitySettings);

    // Restore My Health checklist into AsyncStorage so health.tsx picks it up on mount
    if (fullProfile.healthTracking && Object.keys(fullProfile.healthTracking).length > 0) {
      const healthKey = `maamitra-health-${uid}`;
      AsyncStorage.setItem(healthKey, JSON.stringify(fullProfile.healthTracking)).catch(() => {});
    }

    // Restore mood history + health conditions into wellness store
    const { moodHistory: firestoreMoods, healthConditions: firestoreConds } = fullProfile as any;
    if (firestoreMoods?.length) {
      useWellnessStore.setState({ moodHistory: firestoreMoods });
    }
    if (firestoreConds !== null && firestoreConds !== undefined) {
      useWellnessStore.setState({ healthConditions: firestoreConds });
    }

    // Restore allergies into chat store
    if ((fullProfile as any).allergies !== null && (fullProfile as any).allergies !== undefined) {
      useChatStore.setState({ allergies: (fullProfile as any).allergies });
    }

    return fullProfile.onboardingComplete;
  } catch (error) {
    console.error('hydrateProfileFromFirestore error:', error);
    return false;
  } finally {
    _hydratingUids.delete(uid);
  }
}

interface AuthUser {
  uid: string;
  name: string;
  email: string;
}

// Sign-in / sign-up / Google flows hit this when Firebase env vars are missing.
// Rather than silently succeed with a mock identity (which masks a real config
// problem and ships a fake account to production), throw a clear error.
const NOT_CONFIGURED = new Error(
  'Authentication is not configured. Please check your Firebase env vars.'
);

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
      throw NOT_CONFIGURED;
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
      throw NOT_CONFIGURED;
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
      throw NOT_CONFIGURED;
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
    // Always wipe ALL local data immediately on sign-out — before any async calls
    useProfileStore.getState().resetProfile();
    useWellnessStore.getState().resetWellness();
    useChatStore.getState().resetAll();
    getSocialStore().getState().reset();
    getCommunityStore().getState().resetCommunity();
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
      useProfileStore.getState().resetProfile();
      set({ user: null, isAuthenticated: false });
      return;
    }
    if (!user) throw new Error('Not logged in');
    // Wipe ALL local data first so it never leaks to a subsequent user
    useProfileStore.getState().resetProfile();
    useWellnessStore.getState().resetWellness();
    useChatStore.getState().resetAll();
    getSocialStore().getState().reset();
    getCommunityStore().getState().resetCommunity();
    await deleteUserAccount(user.uid);
    set({ user: null, isAuthenticated: false });
  },

  initAuth: () => {
    if (!isFirebaseConfigured() || !auth) {
      // No Firebase config at build time (local dev without .env). Leave the
      // user signed out — production must never fall back to a mock identity.
      set({ user: null, isAuthenticated: false, isLoading: false });
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
