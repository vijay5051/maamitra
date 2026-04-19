import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  reload as reloadFirebaseUser,
  UserCredential,
} from 'firebase/auth';
import {
  isFirebaseConfigured,
  auth,
  saveUserProfile,
  loadFullProfile,
  saveFullProfile,
  deleteUserAccount,
  finaliseGoogleSignIn,
  getGoogleRedirectResult,
  sendVerificationEmail,
} from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore } from './useProfileStore';
import { useWellnessStore } from './useWellnessStore';
import { useChatStore } from './useChatStore';
import { useTeethStore } from './useTeethStore';

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
    const { setParentGender, setBio, setExpertise, setPhotoUrl, setVisibilitySettings, setHasSeenIntro, setPhone, setPhoneVerified } = useProfileStore.getState();
    if (fullProfile.parentGender) setParentGender(fullProfile.parentGender as any);
    if (fullProfile.bio) setBio(fullProfile.bio);
    if (fullProfile.expertise?.length) setExpertise(fullProfile.expertise);
    if (fullProfile.photoUrl) setPhotoUrl(fullProfile.photoUrl);
    if (fullProfile.visibilitySettings) setVisibilitySettings(fullProfile.visibilitySettings);
    setHasSeenIntro(!!fullProfile.hasSeenIntro);
    if (fullProfile.phone) setPhone(fullProfile.phone);
    setPhoneVerified(!!fullProfile.phoneVerified);

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

    // Restore per-kid teething tracker into teeth store
    if (fullProfile.teethTracking && Object.keys(fullProfile.teethTracking).length > 0) {
      useTeethStore.getState().hydrate(fullProfile.teethTracking as any);
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
  emailVerified: boolean;
  isGoogleSignIn: boolean;
}

// Sign-in / sign-up / Google flows hit this when Firebase env vars are missing.
// Rather than silently succeed with a mock identity (which masks a real config
// problem and ships a fake account to production), throw a clear error.
const NOT_CONFIGURED = new Error(
  'Authentication is not configured. Please check your Firebase env vars.'
);

export type AuthDestination = 'onboarding' | 'phone' | 'tabs';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  /**
   * Hydrate the store from a Firebase UserCredential that the caller
   * obtained by calling `signInWithPopup` synchronously. The split is
   * critical on iOS Safari where any await between click and popup kills
   * the user gesture.
   */
  onGoogleCredential: (credential: UserCredential) => Promise<AuthDestination>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerified: () => Promise<boolean>;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
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
      // Hydrate profile — this reads users/{uid} once. Previously we also called
      // getUserProfile() separately for the name, which was a redundant read
      // through App Check (+1-2s). Pull the name from the hydrated store.
      await hydrateProfileFromFirestore(credential.user.uid);
      const providerIds = credential.user.providerData.map((p) => p.providerId);
      const hydratedName = useProfileStore.getState().motherName;
      const authUser: AuthUser = {
        uid: credential.user.uid,
        name: hydratedName || credential.user.displayName || 'Mom',
        email: credential.user.email ?? email,
        emailVerified: credential.user.emailVerified,
        isGoogleSignIn: providerIds.includes('google.com'),
      };
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
        emailVerified: credential.user.emailVerified,
        isGoogleSignIn: false,
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

  onGoogleCredential: async (credential: UserCredential): Promise<AuthDestination> => {
    if (!isFirebaseConfigured() || !auth) {
      throw NOT_CONFIGURED;
    }
    // Wipe local data before loading new user
    useProfileStore.getState().resetProfile();
    set({ isLoading: true });
    try {
      // Persist the minimal user doc (name/email/createdAt) so the subsequent
      // hydrate has something to read for first-time Google users.
      const result = await finaliseGoogleSignIn(credential);
      const hadProfile = await hydrateProfileFromFirestore(result.uid);
      const authUser: AuthUser = {
        ...result,
        emailVerified: auth.currentUser?.emailVerified ?? true,
        isGoogleSignIn: true,
      };
      set({ user: authUser, isAuthenticated: true, isLoading: false });

      // Route: need onboarding → onboarding. Onboarded but no phone → phone.
      // Fully ready → tabs.
      if (!hadProfile) return 'onboarding';
      const phone = useProfileStore.getState().phone;
      if (!phone) return 'phone';
      return 'tabs';
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    // Always wipe ALL local data immediately on sign-out — before any async calls
    useProfileStore.getState().resetProfile();
    useWellnessStore.getState().resetWellness();
    useChatStore.getState().resetAll();
    useTeethStore.getState().resetTeeth();
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
    useTeethStore.getState().resetTeeth();
    getSocialStore().getState().reset();
    getCommunityStore().getState().resetCommunity();
    await deleteUserAccount(user.uid);
    set({ user: null, isAuthenticated: false });
  },

  resendVerificationEmail: async () => {
    await sendVerificationEmail();
  },

  refreshEmailVerified: async (): Promise<boolean> => {
    if (!auth?.currentUser) return false;
    await reloadFirebaseUser(auth.currentUser);
    const verified = auth.currentUser.emailVerified;
    const current = get().user;
    if (current && current.emailVerified !== verified) {
      set({ user: { ...current, emailVerified: verified } });
    }
    return verified;
  },

  initAuth: () => {
    if (!isFirebaseConfigured() || !auth) {
      // No Firebase config at build time (local dev without .env). Leave the
      // user signed out — production must never fall back to a mock identity.
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // If the user just came back from a Google redirect sign-in (mobile web
    // flow), resolve it here. This writes the profile doc for first-time
    // Google users so the subsequent onAuthStateChanged + hydrate can find
    // their name. Fire-and-forget — onAuthStateChanged picks up the user
    // state regardless of this resolving first.
    getGoogleRedirectResult().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const providerIds = firebaseUser.providerData.map((p) => p.providerId);
        const isGoogle = providerIds.includes('google.com');
        // Clear any stale profile data from a previous session/user
        useProfileStore.getState().resetProfile();
        try {
          // Single Firestore read via hydrate (was previously two — hydrate +
          // getUserProfile for the name). Name is pulled from hydrated state.
          await hydrateProfileFromFirestore(firebaseUser.uid);
          const hydratedName = useProfileStore.getState().motherName;
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            name: hydratedName || firebaseUser.displayName || 'Mom',
            email: firebaseUser.email ?? '',
            emailVerified: firebaseUser.emailVerified,
            isGoogleSignIn: isGoogle,
          };
          set({ user: authUser, isAuthenticated: true, isLoading: false });
        } catch {
          // Even on error, try to hydrate then set authenticated
          await hydrateProfileFromFirestore(firebaseUser.uid);
          set({
            user: {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName ?? 'Mom',
              email: firebaseUser.email ?? '',
              emailVerified: firebaseUser.emailVerified,
              isGoogleSignIn: isGoogle,
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
