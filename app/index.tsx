import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';
import { isAdminEmail } from '../lib/admin';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { onboardingComplete } = useProfileStore();

  // While auth + profile hydration is in flight, show nothing — never redirect
  // during the transient window where isAuthenticated:true but onboardingComplete:false
  if (isLoading) return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  // Admins land straight on the admin dashboard — they shouldn't be routed
  // through parent onboarding (name / kid DOB / etc.) because their account
  // is a management seat, not a family account.
  if (isAdminEmail(user?.email)) return <Redirect href="/admin" />;
  if (!onboardingComplete) return <Redirect href="/(auth)/onboarding" />;
  // Home is now the AI-hero landing. Chat remains available via the center FAB.
  return <Redirect href="/(tabs)" />;
}
