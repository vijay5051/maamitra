import 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useAuthStore } from '../store/useAuthStore';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
import { useFeedbackStore } from '../store/useFeedbackStore';
import FeedbackSurveyModal from '../components/feedback/FeedbackSurveyModal';
import { hasSubmittedTesterFeedback } from '../services/firebase';
// Importing useThemeStore at the root runs its rehydration (via zustand
// persist's onRehydrateStorage) which calls setPrimaryAtRuntime() before
// any screen renders. That's how the user's picked accent colour is
// applied at startup — otherwise first paint flashes the default.
import '../store/useThemeStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initAuth, user } = useAuthStore();
  const { fetchSettings } = useAppSettingsStore();
  const { markInstalledIfNeeded, manualOpen, closeSurvey } = useFeedbackStore();
  const pathname = usePathname();
  const [autoSurveyVisible, setAutoSurveyVisible] = useState(false);
  const surveyVisible = autoSurveyVisible || manualOpen;

  // All fonts loaded from local assets — guarantees they're bundled and served
  // correctly by Firebase Hosting (no external font URL requests that can fail).
  const [fontsLoaded, fontError] = useFonts({
    Ionicons:                  require('../assets/fonts/Ionicons.ttf'),
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
    markInstalledIfNeeded();
  }, []);

  // Auto-prompt the tester survey once the user is signed in, the cooldown
  // rules in useFeedbackStore have cleared, and they're NOT in the middle of
  // auth / onboarding (those routes live under /(auth)/* — we skip them so
  // the modal doesn't slam a brand-new signup).
  //
  // The persist layer hydrates asynchronously, so we must wait for it before
  // reading submittedAt / dismissedAt. Without this gate the survey re-fires
  // on next sign-in after a successful submit, because the effect reads the
  // default (null) state before hydration lands.
  useEffect(() => {
    if (!user) return;
    if (pathname && pathname.startsWith('/(auth)')) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const trigger = async () => {
      if (!useFeedbackStore.getState().shouldAutoPrompt(user.email)) return;
      // Server-backed check. Covers iOS Safari incognito + fresh device cases
      // where the local `submittedAt` flag has been wiped but the user has
      // already responded on another session.
      const alreadyOnServer = await hasSubmittedTesterFeedback(user.uid);
      if (cancelled) return;
      if (alreadyOnServer) {
        // Sync to local store so manualOpen / profile-sheet entry still
        // respect the submitted state across the rest of this session.
        useFeedbackStore.setState({ submittedAt: new Date().toISOString() });
        return;
      }
      timer = setTimeout(() => setAutoSurveyVisible(true), 1500);
    };

    if (useFeedbackStore.persist.hasHydrated()) {
      void trigger();
    } else {
      const unsub = useFeedbackStore.persist.onFinishHydration(() => void trigger());
      return () => {
        cancelled = true;
        unsub();
        if (timer) clearTimeout(timer);
      };
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user, pathname]);

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
        <FeedbackSurveyModal
          visible={surveyVisible}
          onClose={() => { setAutoSurveyVisible(false); closeSurvey(); }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
