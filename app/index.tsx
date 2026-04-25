import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { isAdminEmail } from '../lib/admin';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const onboardingComplete = useProfileStore((s) => s.onboardingComplete);
  const profileHydrated = useProfileStore((s) => s._hasHydrated);

  // Hold the splash until BOTH gates are open:
  //  1. Firebase auth has reported (isLoading=false), and
  //  2. zustand-persist has finished reading the cached profile from
  //     AsyncStorage (profileHydrated). Without (2), the very first render
  //     after a cold start reads `onboardingComplete: false` from the
  //     default state and redirects an already-onboarded user back into
  //     the onboarding flow — the bug users hit after restarting the app
  //     post-theme change on Android.
  if (isLoading || !profileHydrated) return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  // Admins land straight on the admin dashboard — they shouldn't be routed
  // through parent onboarding (name / kid DOB / etc.) because their account
  // is a management seat, not a family account.
  if (isAdminEmail(user?.email)) return <Redirect href="/admin" />;
  if (!onboardingComplete) return <Redirect href="/(auth)/onboarding" />;
  // Home is now the AI-hero landing. Chat remains available via the center FAB.
  return <Redirect href="/(tabs)" />;
}
