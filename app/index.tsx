import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const { onboardingComplete } = useProfileStore();

  // DEMO BYPASS: if localStorage has demo flag, skip auth for UI testing
  if (typeof window !== 'undefined' && localStorage.getItem('maamitra-demo') === 'true') {
    return <Redirect href="/(tabs)/chat" />;
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!onboardingComplete) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)/chat" />;
}
