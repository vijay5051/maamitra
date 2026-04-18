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

  const markSplashShown = () => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    try { window.sessionStorage.setItem('mm_splash_shown', '1'); } catch {}
  };

  // Show the branded animated splash only on a true cold start — NOT on
  // refresh/hot-reload of the same tab. Re-showing a 2s splash every time
  // the user hits refresh felt broken (blank dark screen every reload).
  // On web we use sessionStorage as the cold-start signal; it survives
  // in-tab navigation but clears when the tab/window is closed.
  const [splashDone, setSplashDone] = useState(() => {
    if (Platform.OS !== 'web') return false;
    if (typeof window === 'undefined') return true;
    try {
      return window.sessionStorage.getItem('mm_splash_shown') === '1';
    } catch {
      return true; // storage blocked → err on the side of NOT blocking UI
    }
  });

  useEffect(() => {
    initAuth();
    fetchSettings();
  }, []);

  // HARD safety net: whatever happens with the animated splash (reanimated
  // callback not firing, component erroring, anything), force it offscreen
  // after 3s so the user is never locked out of sign-in.
  useEffect(() => {
    if (splashDone) return;
    const t = setTimeout(() => {
      setSplashDone(true);
      markSplashShown();
    }, 3000);
    return () => clearTimeout(t);
  }, [splashDone]);

  // Hide native splash as soon as fonts are ready OR if there was an error
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Don't block the whole app render on fonts. On web a slow font fetch used
  // to leave the user staring at a blank screen after refresh — the native
  // splash is already hidden and `return null` means nothing is rendered.
  // System fonts will fall back and the custom fonts swap in when they
  // finish loading. Only keep the gate on native, where a first paint
  // before fonts looks significantly worse.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
        {!splashDone && (
          <AnimatedSplash
            onDone={() => {
              setSplashDone(true);
              markSplashShown();
            }}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
