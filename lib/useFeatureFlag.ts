// React hook to evaluate a feature flag for the current user.
//
// Behaviour:
//   - Returns `enabled: boolean` derived from app_config/runtime.
//   - Sticky per-uid via FNV-hashed bucket → same uid stays in the cohort
//     across reloads.
//   - Defaults to `true` until the first config snapshot lands, so the
//     UI doesn't flicker hidden→visible on cold start. (Cohort cuts that
//     run a feature on for <100% will still flicker briefly off → on if
//     this user is OUT of the cohort. That's acceptable; rollout %s aren't
//     meant for guarding security-critical paths.)
//
// Usage:
//   const { enabled } = useFeatureFlag('community');
//   if (!enabled) return <FeatureDisabled name="Community" />;

import { useMemo } from 'react';

import { useAuthStore } from '../store/useAuthStore';
import { useRuntimeConfigStore } from '../store/useRuntimeConfigStore';
import { isAdminEmail } from './admin';
import { FeatureKey } from '../services/featureFlags';

export interface UseFeatureFlagResult {
  enabled: boolean;
  /** True when the runtime config has loaded at least once. */
  ready: boolean;
}

export function useFeatureFlag(key: FeatureKey): UseFeatureFlagResult {
  const config = useRuntimeConfigStore((s) => s.config);
  const ready = useRuntimeConfigStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);

  return useMemo(() => {
    // Optimistic default: until the snapshot loads, we render the feature
    // as enabled to avoid a hidden→visible flicker. Once `ready` is true
    // the real evaluation kicks in.
    if (!ready) return { enabled: true, ready: false };
    const f = config.features[key];
    if (!f) return { enabled: true, ready };
    if (!f.enabled) return { enabled: false, ready };
    if (f.audience === 'admins' && !isAdminEmail(user?.email)) return { enabled: false, ready };
    if (f.rolloutPct >= 100) return { enabled: true, ready };
    if (f.rolloutPct <= 0) return { enabled: isAdminEmail(user?.email), ready };
    if (!user?.uid) return { enabled: false, ready };
    // FNV-1a inlined to avoid re-importing the hashing fn.
    const s = key + ':' + user.uid;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    const bucket = h % 100;
    return { enabled: bucket < f.rolloutPct, ready };
  }, [config, ready, key, user]);
}

/** Convenience: are we in maintenance mode? */
export function useMaintenanceMode(): {
  enabled: boolean;
  title: string;
  message: string;
  allowReadOnly: boolean;
  ready: boolean;
} {
  const config = useRuntimeConfigStore((s) => s.config);
  const ready = useRuntimeConfigStore((s) => s.ready);
  return {
    enabled: config.maintenance.enabled,
    title: config.maintenance.title,
    message: config.maintenance.message,
    allowReadOnly: config.maintenance.allowReadOnly,
    ready,
  };
}
