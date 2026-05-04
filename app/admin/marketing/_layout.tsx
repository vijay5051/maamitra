/**
 * Marketing module layout — Studio v2 redesign.
 *
 * Replaces the bare Stack from v1 with the MarketingShell chrome
 * (pill-tab nav + greeting + health chip). Forces the onboarding wizard
 * on first visit (`brand.onboardedAt == null`) so non-techies aren't
 * dropped into an empty admin maze. Auth + role gating already happens
 * in /admin/_layout.tsx upstream.
 */

import { Redirect, Stack, usePathname } from 'expo-router';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

import MarketingShell, { HealthStatus } from '../../../components/marketing/MarketingShell';
import { fetchBrandKit, subscribeBrandKit, subscribeMarketingHealth } from '../../../services/marketing';
import { BrandKit, MarketingHealth, UNKNOWN_MARKETING_HEALTH } from '../../../lib/marketingTypes';

const ONBOARDING_PATH = '/admin/marketing/onboarding';

// Dev preview bypass — the onboarding gate redirects to the wizard when the
// brand kit doesn't have onboardedAt set. In local-dev preview mode (no real
// Firestore writes), this bounces forever. Bypass when __DEV__ + the
// previewAdmin flag is on, so Today/Posts/Settings can be screenshotted
// without setting up a real brand kit.
function isDevPreviewBypass(): boolean {
  if (!__DEV__) return false;
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage?.getItem('previewAdmin') === 'true';
  } catch {
    return false;
  }
}

export default function MarketingLayout() {
  const pathname = usePathname() ?? '';
  const [brand, setBrand] = useState<BrandKit | null | undefined>(undefined); // undefined = loading
  const [health, setHealth] = useState<MarketingHealth | null>(null);
  const isOnboarding = pathname.startsWith(ONBOARDING_PATH);

  useEffect(() => {
    let unsubBrand: (() => void) | undefined;
    let unsubHealth: (() => void) | undefined;
    void fetchBrandKit().then(setBrand);
    unsubBrand = subscribeBrandKit(setBrand);
    unsubHealth = subscribeMarketingHealth(setHealth);
    return () => {
      if (unsubBrand) unsubBrand();
      if (unsubHealth) unsubHealth();
    };
  }, []);

  // Onboarding screen runs without the shell (modal-feel).
  if (isOnboarding) {
    return (
      <MarketingShell bare>
        <Stack screenOptions={{ headerShown: false }} />
      </MarketingShell>
    );
  }

  // Force onboarding on first visit. Brand kit doc not existing OR
  // onboardedAt null both trigger the wizard.
  // We only redirect once we've actually loaded the brand state, to avoid
  // bouncing on a flicker.
  // Dev preview mode skips the gate so Today/Posts/Settings can be reviewed
  // without a real signed-in admin + Firestore brand-kit write.
  if (!isDevPreviewBypass() && (brand === null || (brand && !brand.onboardedAt))) {
    return <Redirect href={ONBOARDING_PATH as any} />;
  }

  // Live token-validity from probeMarketingHealth (hourly cron + admin
  // callable). Pre-first-probe (doc missing) we degrade to "unknown" rather
  // than the previous always-green optimistic state — the chip now reflects
  // reality. cronEnabled / crisisPaused still come from the brand kit.
  const liveHealth = health ?? UNKNOWN_MARKETING_HEALTH;
  const shellHealth: HealthStatus = {
    igConnected: liveHealth.ig.ok,
    fbConnected: liveHealth.fb.ok,
    igHandle: liveHealth.ig.handle,
    fbHandle: liveHealth.fb.handle,
    igError: liveHealth.ig.error,
    fbError: liveHealth.fb.error,
    cronEnabled: brand?.cronEnabled === true,
    crisisPaused: brand?.crisisPaused === true,
    /** True until the first probe lands (or if Firestore subscription failed). */
    healthUnknown: health === null,
  };

  return (
    <MarketingShell health={shellHealth}>
      <Stack screenOptions={{ headerShown: false }} />
    </MarketingShell>
  );
}
