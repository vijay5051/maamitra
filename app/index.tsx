import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const { onboardingComplete } = useProfileStore();

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!onboardingComplete) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)/chat" />;
}
