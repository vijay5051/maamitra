import 'react-native-reanimated';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { useAppSettingsStore } from '../store/useAppSettingsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initAuth } = useAuthStore();
  const { fetchSettings } = useAppSettingsStore();

  // fontError is returned as second element — if loading fails we still render the app
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font });

  useEffect(() => {
    initAuth();
    fetchSettings();
  }, []);

  // Hide splash as soon as fonts are ready OR if there was an error (don't block forever)
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // On web there is no native splash screen — always render immediately.
  // On native, wait until fonts are loaded (or failed) so icons don't flash as empty boxes.
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
