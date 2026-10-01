// Community is switched OFF and shown as "Coming soon" until MaaMitra
// reaches 10,000 downloads (decision 2026-10-01 — too little activity yet).
//
// It is driven by the existing runtime flag `features.community` in
// Firestore `app_config/runtime` (Admin → Visibility → "Community feed"),
// so it can be switched back on without shipping code. Unlike other flags
// this one is NOT optimistic: until the config has loaded we treat
// Community as off, so the feed never flashes up for a moment.

import { useFeatureFlag } from './useFeatureFlag';

export const COMMUNITY_DOWNLOAD_GOAL = 10000;

export function useCommunityEnabled(): { enabled: boolean; ready: boolean } {
  const { enabled, ready } = useFeatureFlag('community');
  return { enabled: ready && enabled, ready };
}
