import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useAuthStore } from '../store/useAuthStore';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
import AnimatedSplash from '../components/ui/AnimatedSplash';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initAuth } = useAuthStore();
  const { fetchSettings } = useAppSettingsStore();

  // All fonts loaded from local assets — guarantees they're bundled and served
  // correctly by Firebase Hosting (no external font URL requests that can fail).
  const [fontsLoaded, fontError] = useFonts({
    Ionicons:                  require('../assets/fonts/Ionicons.ttf'),
    DMSerifDisplay_400Regular: require('../assets/fonts/DMSerifDisplay_400Regular.ttf'),
    DMSans_400Regular:         require('../assets/fonts/DMSans_400Regular.ttf'),
    DMSans_500Medium:          require('../assets/fonts/DMSans_500Medium.ttf'),
    DMSans_600SemiBold:        require('../assets/fonts/DMSans_600SemiBold.ttf'),
    DMSans_700Bold:            require('../assets/fonts/DMSans_700Bold.ttf'),
    DMMono_400Regular:         require('../assets/fonts/DMMono_400Regular.ttf'),
    DMMono_500Medium:          require('../assets/fonts/DMMono_500Medium.ttf'),
  });

  // Show the branded animated splash on every fresh app launch. The native
  // splash (expo-splash-screen) hands off to this once fonts are ready —
  // there's no white flash because AnimatedSplash mounts full-screen with
  // the brand gradient, then fades itself out after ~2s.
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    initAuth();
    fetchSettings();
  }, []);

  // Hide native splash as soon as fonts are ready OR if there was an error
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Wait for fonts on ALL platforms so DM Serif Display renders on first paint.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
        {!splashDone && <AnimatedSplash onDone={() => setSplashDone(true)} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
