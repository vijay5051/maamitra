import 'react-native-reanimated';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  DMSerifDisplay_400Regular,
} from '@expo-google-fonts/dm-serif-display';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import { useAuthStore } from '../store/useAuthStore';
import { useAppSettingsStore } from '../store/useAppSettingsStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initAuth } = useAuthStore();
  const { fetchSettings } = useAppSettingsStore();

  // Load Ionicons from project assets (not node_modules) — ensures expo export includes the TTF
  // and Firebase Hosting can serve it from a clean /assets path without @ scoped package issues
  const [fontsLoaded, fontError] = useFonts({
    Ionicons: require('../assets/fonts/Ionicons.ttf'),
    DMSerifDisplay_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    initAuth();
    fetchSettings();
  }, []);

  // Hide splash as soon as fonts are ready OR if there was an error (don't block forever)
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
