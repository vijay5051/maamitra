import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { isAdminEmail } from '../lib/admin';
import { logAuthEvent } from '../lib/authObservability';
import { savePhoneVerification } from '../lib/savePhoneVerification';

// Synthetic placeholder number written to admin accounts so they can skip
// the phone-gate without burning one of the family's real numbers. The
// 0000000000 mantissa is invalid by Indian numbering rules, so it can
// never collide with a real user.
const ADMIN_PLACEHOLDER_PHONE = '+910000000000';
const adminPhoneSyncedFor = new Set<string>();

// Module-level dedup set for gate-pending logs. On a slow Firestore
// round-trip the component re-renders many times while the gate is
// pending — we only want one log line per (reason, uid) per session,
// not one per render. Cleared when the gate releases (logTransition()
// resets the set).
const loggedGatePending = new Set<string>();

function logGatePending(reason: 'auth-loading' | 'profile-hydrating' | 'firestore-fetching', uid?: string) {
  const key = `${reason}:${uid ?? ''}`;
  if (loggedGatePending.has(key)) return;
  loggedGatePending.add(key);
  logAuthEvent({ type: 'auth:gate-pending', reason, uid });
}

function logTransition(to: 'UNAUTHED' | 'PHONE_GATE' | 'ONBOARDING' | 'APP', uid?: string) {
  // Once we make a real routing decision, clear the gate-pending dedup
  // so a subsequent sign-out + sign-in will re-log gate progress.
  loggedGatePending.clear();
  logAuthEvent({ type: 'auth:transition', from: 'SPLASH', to, uid });
}

export default function Index() {
  const { isAuthenticated, isLoading, user, firestoreHydratedForUid } = useAuthStore();
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);
  const phoneVerified = useProfileStore((s) => s.phoneVerified);
  const profileHydrated = useProfileStore((s) => s._hasHydrated);
  const isCacheTrustedFor = useProfileStore((s) => s.isCacheTrustedFor);

  // ── Three-gate cold-start guard ────────────────────────────────────────
  // G1: Firebase auth resolved.
  if (isLoading) {
    logGatePending('auth-loading');
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }
  // G2: zustand-persist finished reading local cache.
  if (!profileHydrated) {
    logGatePending('profile-hydrating');
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }

  if (!isAuthenticated) {
    logTransition('UNAUTHED');
    return <Redirect href="/(auth)/welcome" />;
  }

  // G3: Profile-cache-trust — the locally-cached profile actually belongs to
  // THIS user. If not, block until Firestore round-trip has resolved for
  // their uid. This is the gate that was missing; its absence sent returning
  // users to the signup form when their local cache was stale, missing, or
  // from another identity. One trusted signal is sufficient — we don't need
  // both cache-trust AND firestore-ready.
  const cacheTrusted = !!user && isCacheTrustedFor(user.uid);
  const firestoreReady = !!user && firestoreHydratedForUid === user.uid;
  if (!cacheTrusted && !firestoreReady) {
    logGatePending('firestore-fetching', user?.uid);
    return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;
  }

  // ── Routing decisions — four branches mapping to five named states
  // (admin + tabs both → APP).
  //
  // Admin check runs BEFORE the phone gate: admins use shared email accounts
  // and shouldn't have to burn a real phone number on the OTP gate. If the
  // admin has no phoneVerified record yet, write a synthetic +910000000000
  // placeholder to Firestore (fire-and-forget) so subsequent boots also
  // skip the gate. Original audit (stores-services LOW #37) wanted phone
  // before admin to prevent slipping past via email alone — that's still
  // true for NON-admins (the email is itself authoritative for admins
  // because it's gated by Google/email sign-in + the ADMIN_EMAILS list).
  if (isAdminEmail(user?.email)) {
    if (user && !phoneVerified && !adminPhoneSyncedFor.has(user.uid)) {
      adminPhoneSyncedFor.add(user.uid);
      void savePhoneVerification({ uid: user.uid, e164: ADMIN_PLACEHOLDER_PHONE, verified: true });
    }
    logTransition('APP', user?.uid);
    return <Redirect href="/admin" />;
  }
  if (!phoneVerified) {
    logTransition('PHONE_GATE', user?.uid);
    return <Redirect href="/(auth)/phone" />;
  }
  if (!onboardingComplete) {
    logTransition('ONBOARDING', user?.uid);
    return <Redirect href="/(auth)/onboarding" />;
  }
  logTransition('APP', user?.uid);
  return <Redirect href="/(tabs)" />;
}
