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
  ensureWebAuthPersistence,
  saveUserProfile,
  loadFullProfile,
  loadFullProfileStrict,
  saveFullProfile,
  deleteUserAccount,
  finaliseGoogleSignIn,
  getGoogleRedirectResult,
  sendVerificationEmail,
  type FullProfileData,
} from '../services/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfileStore, awaitProfileHydration } from './useProfileStore';
import { useWellnessStore } from './useWellnessStore';
import { useThemeStore } from './useThemeStore';
import { useChatStore } from './useChatStore';
import { useTeethStore } from './useTeethStore';
import { useFoodTrackerStore } from './useFoodTrackerStore';
import { useGrowthStore } from './useGrowthStore';
import { useDMStore } from './useDMStore';

// Lazy-accessed to avoid circular dependency (useSocialStore imports useAuthStore)
const getSocialStore = () => require('./useSocialStore').useSocialStore;
const getCommunityStore = () => require('./useCommunityStore').useCommunityStore;

// Tracks in-flight hydration promises per uid so concurrent callers (the
// sign-in path + the onAuthStateChanged listener) both await the SAME
// result instead of timing out and returning stale state. This used to be
// a Set with a 1.5s sleep, which races against the retry loop below
// (worst-case ~1.3s) and could return stale `onboardingComplete=false`.
const _hydrationInFlight = new Map<string, Promise<boolean>>();

async function hydrateProfileFromFirestore(uid: string): Promise<boolean> {
  const existing = _hydrationInFlight.get(uid);
  if (existing) return existing;
  const p = (async () => {
  // Wait for the profile store's persisted state to finish rehydrating from
  // AsyncStorage. Without this, reads of `cachedProfileUid` /
  // `onboardingComplete` below see the default state on the very first call
  // after a cold start (common after the user changes accent colour and is
  // prompted to restart on Android) — which silently disables the
  // returning-user fallback and routes already-onboarded users back into
  // the onboarding flow.
  try { await awaitProfileHydration(); } catch {}
  const knownSnapshot = useProfileStore.getState().knownProfilesByUid[uid];
  try {
    // Retry the Firestore fetch on transient errors (incognito Safari is the
    // main culprit — IndexedDB / cookie partitioning delays auth-token
    // propagation to the Firestore SDK for the first few hundred ms after
    // sign-in). We only retry on 'error'; a definitive 'missing' means the
    // user genuinely has no doc and should go to onboarding.
    // Retry budget extended from ~1.3s to ~6s. Web App Check (reCAPTCHA v3)
    // can take 2-3s to mint its first token in a fresh tab, especially on
    // slow connections; the original 1.3s ceiling left existing users
    // staring at "error" and getting routed back through onboarding.
    const delays = [0, 500, 1000, 1500, 3000]; // ms — cumulative ~6s
    let res: { status: 'ok' | 'missing' | 'error'; data?: FullProfileData; error?: unknown } =
      { status: 'error' };
    for (const wait of delays) {
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      res = await loadFullProfileStrict(uid);
      if (res.status !== 'error') break;
    }

    const fullProfile = res.data ?? null;

    if (!fullProfile) {
      // `res.status` is either 'missing' (new account, route to onboarding)
      // or 'error' (still unreachable after retries).
      const cached = useProfileStore.getState().cachedProfileUid;

      // Returning-user fast path: if we have cache for this uid, trust it.
      if (res.status === 'error' && cached === uid) {
        return useProfileStore.getState().onboardingComplete;
      }

      // Durable returning-user fallback: if this browser has EVER
      // successfully hydrated this uid before, trust that snapshot over a
      // transient Safari / App Check / Firestore wobble. Restore the
      // minimum fields needed to avoid bouncing an old user into
      // onboarding or phone setup.
      if (knownSnapshot?.onboardingComplete) {
        useProfileStore.getState().setCachedProfileUid(uid);
        useProfileStore.getState().setOnboardingComplete(true);
        if (knownSnapshot.motherName) useProfileStore.getState().setMotherName(knownSnapshot.motherName);
        if (knownSnapshot.phone) useProfileStore.getState().setPhone(knownSnapshot.phone);
        useProfileStore.getState().setPhoneVerified(!!knownSnapshot.phoneVerified);
        return true;
      }

      // New-tab existing-user safety net: if Firestore says 'error' AND we
      // have no cache match BUT Firebase auth says this account was created
      // more than 2 minutes ago, this is NOT a new user — it's an existing
      // user whose Firestore read failed transiently (App Check cold start,
      // network hiccup). Do NOT dump them in onboarding. Mark onboarding
      // complete locally; the home tab's listeners will re-attempt the
      // hydrate in the background and fill in the rest of the profile.
      // Without this, a returning user signing in on a fresh browser hits
      // the 4-step onboarding form again — exactly the bug Vijay reported.
      if (res.status === 'error' && auth?.currentUser?.uid === uid) {
        const creationTime = auth.currentUser.metadata.creationTime;
        const ageMs = creationTime ? Date.now() - new Date(creationTime).getTime() : 0;
        if (ageMs > 2 * 60 * 1000) {
          // Existing account → assume onboarded.
          useProfileStore.getState().setOnboardingComplete(true);
          useProfileStore.getState().setCachedProfileUid(uid);
          return true;
        }
      }

      // Truly new (status='missing') OR fresh account (created <2min ago)
      // with a transient error — caller will route to onboarding. Both are
      // safe outcomes: the user re-fills the form and we re-write the doc.
      return false;
    }
    useProfileStore.getState().resetProfile();
    const { setMotherName, setProfile, addKid, setOnboardingComplete, markVaccineDone, setCachedProfileUid, rememberKnownProfile } = useProfileStore.getState();
    // Remember this uid so we can trust the persisted cache next time
    // the same user signs in with a flaky network.
    setCachedProfileUid(uid);
    setMotherName(fullProfile.motherName);
    if (fullProfile.profile) setProfile(fullProfile.profile as any);
    fullProfile.kids.forEach((kid: any) =>
      addKid({
        id: kid.id,
        name: kid.name,
        dob: kid.dob,
        stage: kid.stage,
        gender: kid.gender,
        photoUrl: kid.photoUrl || '',
        milestoneStates: kid.milestoneStates || {},
        isExpecting: kid.isExpecting,
        relation: kid.relation || '',
      })
    );
    Object.entries(fullProfile.completedVaccines).forEach(([kidId, vaccines]: [string, any]) => {
      if (typeof vaccines === 'object' && vaccines !== null && !('done' in vaccines)) {
        Object.entries(vaccines).forEach(([vaccineId, val]: [string, any]) => {
          if (val?.done) markVaccineDone(vaccineId, kidId, val.doneDate);
        });
      }
    });
    setOnboardingComplete(fullProfile.onboardingComplete);
    const { setParentGender, setBio, setExpertise, setPhotoUrl, setVisibilitySettings, setHasSeenIntro, setHasDismissedFeatureGuide, setPhone, setPhoneVerified } = useProfileStore.getState();
    if (fullProfile.parentGender) setParentGender(fullProfile.parentGender as any);
    if (fullProfile.bio) setBio(fullProfile.bio);
    if (fullProfile.expertise?.length) setExpertise(fullProfile.expertise);
    if (fullProfile.photoUrl) setPhotoUrl(fullProfile.photoUrl);
    if (fullProfile.visibilitySettings) setVisibilitySettings(fullProfile.visibilitySettings);
    setHasSeenIntro(!!fullProfile.hasSeenIntro);
    setHasDismissedFeatureGuide(!!(fullProfile as any).hasDismissedFeatureGuide);
    if (fullProfile.phone) setPhone(fullProfile.phone);
    setPhoneVerified(!!fullProfile.phoneVerified);
    rememberKnownProfile(uid, {
      onboardingComplete: fullProfile.onboardingComplete,
      motherName: fullProfile.motherName,
      phone: fullProfile.phone,
      phoneVerified: !!fullProfile.phoneVerified,
    });

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

    // Restore per-kid food tracker into food store
    if (fullProfile.foodTracking && Object.keys(fullProfile.foodTracking).length > 0) {
      useFoodTrackerStore.getState().hydrate(fullProfile.foodTracking as any);
    }

    // Restore per-kid growth + routine tracker (weight/height/head/diaper/sleep)
    if ((fullProfile as any).growthTracking && Object.keys((fullProfile as any).growthTracking).length > 0) {
      useGrowthStore.getState().hydrate((fullProfile as any).growthTracking);
    }

    // Apply the user's picked accent colour (if any saved in Firestore).
    // Fire-and-forget — non-blocking, missing colour just keeps the
    // locally-persisted / default one.
    useThemeStore.getState().loadFromFirestore(uid);

    return fullProfile.onboardingComplete;
  } catch (error) {
    console.error('hydrateProfileFromFirestore error:', error);
    return false;
  }
  })();
  _hydrationInFlight.set(uid, p);
  try {
    return await p;
  } finally {
    _hydrationInFlight.delete(uid);
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
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      // Only wipe local profile state when a DIFFERENT user is signing
      // in. For a returning user (same uid as the cached profile), we
      // keep the cache as a fallback so a transient Firestore failure
      // during hydrate doesn't flip onboardingComplete back to false
      // and route them into the onboarding flow by mistake.
      try { await awaitProfileHydration(); } catch {}
      const cached = useProfileStore.getState().cachedProfileUid;
      if (cached && cached !== credential.user.uid) {
        useProfileStore.getState().resetProfile();
      }
      // CRITICAL: set the user in the store BEFORE awaiting hydrate. This
      // primes onAuthStateChanged's same-uid guard so it doesn't race us
      // by calling resetProfile() + hydrate concurrently. Without this,
      // onboardingComplete can flip to false between here and the caller
      // reading the store → user gets routed to onboarding by mistake.
      const providerIds = credential.user.providerData.map((p) => p.providerId);
      const preliminaryUser: AuthUser = {
        uid: credential.user.uid,
        name: credential.user.displayName || 'Mom',
        email: credential.user.email ?? email,
        emailVerified: credential.user.emailVerified,
        isGoogleSignIn: providerIds.includes('google.com'),
      };
      set({ user: preliminaryUser, isAuthenticated: true });

      // Hydrate profile — this reads users/{uid} once. Previously we also called
      // getUserProfile() separately for the name, which was a redundant read
      // through App Check (+1-2s). Pull the name from the hydrated store.
      await hydrateProfileFromFirestore(credential.user.uid);
      const hydratedName = useProfileStore.getState().motherName;
      set({
        user: { ...preliminaryUser, name: hydratedName || preliminaryUser.name },
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false, user: null, isAuthenticated: false });
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
      // Pin this uid as the "owner" of the local profile cache. Without this,
      // newly-signed-up users who complete onboarding but never trigger a
      // full hydrate (= never cold-reboot the app) leave cachedProfileUid
      // as null. When they later sign in from a new tab and Firestore is
      // briefly unreachable, the cache-fallback branch in
      // hydrateProfileFromFirestore can't match and they get routed back
      // through onboarding. Setting it here closes that gap.
      useProfileStore.getState().setCachedProfileUid(credential.user.uid);
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
    // Keep the persisted profile if this is the SAME user returning. Only
    // reset when the incoming uid differs from the last cached one —
    // protects onboardingComplete from being lost on a flaky Firestore
    // read (see signIn for the same pattern).
    try { await awaitProfileHydration(); } catch {}
    const cachedUid = useProfileStore.getState().cachedProfileUid;
    if (cachedUid && cachedUid !== credential.user.uid) {
      useProfileStore.getState().resetProfile();
    }
    set({ isLoading: true });
    try {
      // Persist the minimal user doc (name/email/createdAt) so the subsequent
      // hydrate has something to read for first-time Google users.
      const result = await finaliseGoogleSignIn(credential);

      // Prime onAuthStateChanged's same-uid guard (see signIn for details).
      // Without this, the Firebase auth-state listener fires concurrently
      // and calls resetProfile() mid-hydrate, flipping onboardingComplete
      // back to false before the caller reads it.
      const preliminaryUser: AuthUser = {
        ...result,
        emailVerified: auth.currentUser?.emailVerified ?? true,
        isGoogleSignIn: true,
      };
      set({ user: preliminaryUser, isAuthenticated: true });

      const hadProfile = await hydrateProfileFromFirestore(result.uid);
      set({ isLoading: false });

      // Route: need onboarding → onboarding. Onboarded but no phone → phone.
      // Fully ready → tabs.
      if (!hadProfile) return 'onboarding';
      const phone = useProfileStore.getState().phone;
      if (!phone) return 'phone';
      return 'tabs';
    } catch (error) {
      set({ isLoading: false, user: null, isAuthenticated: false });
      throw error;
    }
  },

  signOut: async () => {
    // Flip auth FIRST so route guards send the user straight to welcome.
    // Resetting the profile store before flipping `isAuthenticated` used
    // to leave the app in a half-state (authenticated but onboarding=false)
    // for the brief window before `firebaseSignOut` resolved — the
    // (tabs) layout would route to /(auth)/onboarding in that window,
    // causing the "signup form" flash users reported on web/Android.
    set({ user: null, isAuthenticated: false });
    useProfileStore.getState().resetProfile();
    useWellnessStore.getState().resetWellness();
    useChatStore.getState().resetAll();
    useTeethStore.getState().resetTeeth();
    useFoodTrackerStore.getState().resetFoods();
    useGrowthStore.getState().resetGrowth();
    useDMStore.getState().reset();
    getSocialStore().getState().reset();
    getCommunityStore().getState().resetCommunity();
    if (!isFirebaseConfigured() || !auth) return;
    try {
      await firebaseSignOut(auth);
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
    useFoodTrackerStore.getState().resetFoods();
    useGrowthStore.getState().resetGrowth();
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

    let unsubscribe: (() => void) | undefined;

    void (async () => {
      // Critical on incognito/private browsers: establish a working
      // persistence layer BEFORE we subscribe to auth state or route based
      // on it. Otherwise the first boot after refresh can transiently look
      // signed-out and bounce the user to /welcome.
      try {
        await ensureWebAuthPersistence();
      } catch (err) {
        console.warn('ensureWebAuthPersistence failed:', err);
      }

      // If the user just came back from a Google redirect sign-in (mobile web
      // flow), resolve it here. This writes the profile doc for first-time
      // Google users so the subsequent onAuthStateChanged + hydrate can find
      // their name. Fire-and-forget — onAuthStateChanged picks up the user
      // state regardless of this resolving first.
      getGoogleRedirectResult().catch(() => {});

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const existing = get().user;
          if (existing && existing.uid === firebaseUser.uid) {
            if (get().isLoading) set({ isLoading: false });
            try { getSocialStore().getState().subscribeAll(firebaseUser.uid); } catch {}
            try { useDMStore.getState().subscribeConversations(firebaseUser.uid); } catch {}
            return;
          }

          const providerIds = firebaseUser.providerData.map((p) => p.providerId);
          const isGoogle = providerIds.includes('google.com');
          try { await awaitProfileHydration(); } catch {}
          const cachedUid = useProfileStore.getState().cachedProfileUid;
          if (cachedUid && cachedUid !== firebaseUser.uid) {
            useProfileStore.getState().resetProfile();
          }
          try {
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
            try { getSocialStore().getState().subscribeAll(firebaseUser.uid); } catch {}
            try { useDMStore.getState().subscribeConversations(firebaseUser.uid); } catch {}
          } catch {
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
    })();

    return () => {
      try { unsubscribe?.(); } catch {}
    };
  },
}));
