import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { isAdminEmail } from '../lib/admin';
import { logAuthEvent } from '../lib/authObservability';

export default function Index() {
  const { isAuthenticated, isLoading, user, firestoreHydratedForUid } = useAuthStore();
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);
  const phoneVerified = useProfileStore((s) => s.phoneVerified);
  const profileHydrated = useProfileStore((s) => s._hasHydrated);
  const isCacheTrustedFor = useProfileStore((s) => s.isCacheTrustedFor);

  // ── Three-gate cold-start guard ────────────────────────────────────────
  // G1: Firebase auth resolved.
  if (isLoading) {
    logAuthEvent({ type: 'auth:gate-pending', reason: 'auth-loading' });
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }
  // G2: zustand-persist finished reading local cache.
  if (!profileHydrated) {
    logAuthEvent({ type: 'auth:gate-pending', reason: 'profile-hydrating' });
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }

  if (!isAuthenticated) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'UNAUTHED' });
    return <Redirect href="/(auth)/welcome" />;
  }

  // G3: Profile-cache-trust — the locally-cached profile actually belongs to
  // THIS user. If not, block until Firestore round-trip has resolved for
  // their uid. This is the gate that was missing; its absence sent returning
  // users to the signup form when their local cache was stale, missing, or
  // from another identity.
  const cacheTrusted = !!user && isCacheTrustedFor(user.uid);
  const firestoreReady = !!user && firestoreHydratedForUid === user.uid;
  if (!cacheTrusted && !firestoreReady) {
    logAuthEvent({ type: 'auth:gate-pending', reason: 'firestore-fetching', uid: user?.uid });
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }

  // ── Five legal states from here on ─────────────────────────────────────
  if (isAdminEmail(user?.email)) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'APP', uid: user?.uid });
    return <Redirect href="/admin" />;
  }
  if (!phoneVerified) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'PHONE_GATE', uid: user?.uid });
    return <Redirect href="/(auth)/phone" />;
  }
  if (!onboardingComplete) {
    logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'ONBOARDING', uid: user?.uid });
    return <Redirect href="/(auth)/onboarding" />;
  }
  logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to: 'APP', uid: user?.uid });
  return <Redirect href="/(tabs)" />;
}
