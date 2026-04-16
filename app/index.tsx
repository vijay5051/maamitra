import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileStore } from '../store/useProfileStore';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const { onboardingComplete } = useProfileStore();

  // DEMO BYPASS: if localStorage has demo flag, skip auth for UI testing
  if (typeof window !== 'undefined' && localStorage.getItem('maamitra-demo') === 'true') {
    return <Redirect href="/(tabs)/chat" />;
  }

  // While auth + profile hydration is in flight, show nothing — never redirect
  // during the transient window where isAuthenticated:true but onboardingComplete:false
  if (isLoading) return <View style={{ flex: 1, backgroundColor: '#fdf6ff' }} />;

  if (!isAuthenticated) return <Redirect href="/(auth)/welcome" />;
  if (!onboardingComplete) return <Redirect href="/(auth)/onboarding" />;
  return <Redirect href="/(tabs)/chat" />;
}
