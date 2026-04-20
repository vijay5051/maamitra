import 'react-native-reanimated';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useAuthStore } from '../store/useAuthStore';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
// Importing useThemeStore at the root runs its rehydration (via zustand
// persist's onRehydrateStorage) which calls setPrimaryAtRuntime() before
// any screen renders. That's how the user's picked accent colour is
// applied at startup — otherwise first paint flashes the default.
import '../store/useThemeStore';

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

  useEffect(() => {
    initAuth();
    fetchSettings();
  }, []);

  // Hide native splash as soon as fonts are ready OR if there was an error
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Don't block the whole app render on fonts on web — a slow font fetch
  // used to leave the user staring at a blank screen after refresh. System
  // fonts fall back and custom fonts swap in when they finish loading.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
