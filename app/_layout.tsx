import 'react-native-reanimated';
// Side-effect import: registers the FCM background message handler at
// module-load time. Per RNFB docs this MUST run before the app mounts,
// so it has to be imported here (the root) and not inside a useEffect.
import { attachForegroundMessaging } from '../lib/setupNativeMessaging';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useAuthStore } from '../store/useAuthStore';
// Dev-only: lets local browser previews bypass auth as the demo admin via
// `?previewAdmin=1`. The module no-ops in production builds because the
// import is guarded by __DEV__ at the call site below.
import { maybeEnablePreviewAdmin } from '../lib/devPreviewAdmin';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
import { useFeedbackStore } from '../store/useFeedbackStore';
import { useRuntimeConfigStore } from '../store/useRuntimeConfigStore';
import FeedbackSurveyModal from '../components/feedback/FeedbackSurveyModal';
import MaintenanceOverlay from '../components/MaintenanceOverlay';
import ForceUpdateOverlay from '../components/ForceUpdateOverlay';
import ImpersonationBanner from '../components/ImpersonationBanner';
import RootErrorBoundary from '../components/ui/RootErrorBoundary';
import { SplashAnimation } from '../components/ui/SplashAnimation';
import { hasSubmittedTesterFeedback } from '../services/firebase';
import { captureFirstVisitAttribution, writeAttributionToUser } from '../services/attribution';
// Importing useThemeStore at the root runs its rehydration (via zustand
// persist's onRehydrateStorage) which calls setPrimaryAtRuntime() before
// any screen renders. That's how the user's picked accent colour is
// applied at startup — otherwise first paint flashes the default.
import '../store/useThemeStore';

SplashScreen.preventAutoHideAsync();

// Safari bfcache guard (web only). When the user uses the back/forward
// button or — in some Safari builds — refresh, the page is restored from
// bfcache. Restored pages can have stale JS module state (Firebase
// listeners disposed, network connections closed) which manifests as a
// blank screen until the user opens a new tab. Force a full reload when
// we detect a bfcache-restore so the app always boots from a clean slate.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('pageshow', (e: any) => {
    if (e.persisted) {
      try { window.location.reload(); } catch (_) { /* ignore */ }
    }
  });

  // Stale-chunk guard. After a deploy, an open tab still has the previous
  // build's index.html in memory; when it tries to lazy-load a chunk, the
  // hash no longer exists so the SPA's `**` rewrite serves index.html
  // back as text, and the JS module loader throws "Loading module …
  // failed". Listen for that exact pattern and force one reload so the
  // tab fetches the fresh index.html + new chunk hashes. SessionStorage
  // flag prevents reload loops in case the error is genuine.
  const RELOAD_FLAG = '__chunk_reload_attempted__';
  const isChunkLoadError = (msg: string) =>
    /Loading module .+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg);
  const handleChunkError = (msg: string) => {
    if (!isChunkLoadError(msg)) return;
    try {
      if (sessionStorage.getItem(RELOAD_FLAG) === '1') return; // already tried
      sessionStorage.setItem(RELOAD_FLAG, '1');
    } catch (_) { /* sessionStorage may be unavailable */ }
    try { window.location.reload(); } catch (_) { /* ignore */ }
  };
  window.addEventListener('error', (e) => {
    if (e?.message) handleChunkError(String(e.message));
  });
  window.addEventListener('unhandledrejection', (e: any) => {
    const reason = e?.reason;
    const msg = typeof reason === 'string' ? reason : reason?.message ?? '';
    if (msg) handleChunkError(String(msg));
  });
  // Clear the reload flag once the fresh page loads cleanly. On the next
  // tick — far enough in that any chunk-load error from this load would
  // have surfaced — we trust the page is healthy and reset the guard so
  // a future stale-bundle scenario can self-heal again.
  setTimeout(() => {
    try { sessionStorage.removeItem(RELOAD_FLAG); } catch (_) { /* ignore */ }
  }, 30_000);
}

export default function RootLayout() {
  const { initAuth, user } = useAuthStore();
  const { fetchSettings } = useAppSettingsStore();
  const { markInstalledIfNeeded, manualOpen, closeSurvey } = useFeedbackStore();
  const pathname = usePathname();
  const [autoSurveyVisible, setAutoSurveyVisible] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
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
    // Lora — warm humanist serif for greetings, section titles, and other
    // headline moments. Pairs with DM Sans for body. Adds the motherly/
    // editorial feel the brand wanted (vs. the prior all-sans uniform look).
    Lora_500Medium:            require('@expo-google-fonts/lora/500Medium/Lora_500Medium.ttf'),
    Lora_700Bold:              require('@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf'),
  });

  useEffect(() => {
    if (__DEV__) maybeEnablePreviewAdmin();
    // First-touch attribution capture — must run before initAuth so the
    // localStorage record exists by the time the user-uid effect tries to
    // flush it onto users/{uid}.
    captureFirstVisitAttribution();
    initAuth();
    fetchSettings();
    markInstalledIfNeeded();
    // Subscribe once at root so every screen reads from a single live source.
    useRuntimeConfigStore.getState().subscribe();
    return () => useRuntimeConfigStore.getState().unsubscribe();
  }, []);

  // Wire native FCM token-refresh + foreground message listeners once
  // the user is signed in. Idempotent and unsubscribes cleanly on
  // sign-out so a stranger's device doesn't silently keep our token
  // attached. Web is a no-op (services/push.ts owns that path).
  useEffect(() => {
    if (!user?.uid) return;
    const detach = attachForegroundMessaging(user.uid);
    // First-touch attribution writeback — server-side guard inside
    // writeAttributionToUser ensures we never overwrite a prior capture.
    void writeAttributionToUser(user.uid);
    return detach;
  }, [user?.uid]);

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
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <ImpersonationBanner />
          <Stack screenOptions={{ headerShown: false }} />
          <FeedbackSurveyModal
            visible={surveyVisible}
            onClose={() => { setAutoSurveyVisible(false); closeSurvey(); }}
          />
          {/* Visibility-control overlays — non-admins only. Order matters:
              ForceUpdate sits underneath Maintenance so a maintenance window
              during a forced rollout still wins. */}
          <ForceUpdateOverlay />
          <MaintenanceOverlay />
          {!splashDone && (fontsLoaded || fontError) && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <SplashAnimation onComplete={() => setSplashDone(true)} />
            </View>
          )}
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </RootErrorBoundary>
  );
}
