// Feature-flag client gate.
//
// `featureFlags[key]` toggles full on/off. `flagRollouts[key]` (optional, 0–100)
// adds a percentage roll-out — only users whose hashed uid % 100 < pct get
// the feature even if the bool is on. Use `useFeatureFlag(key)` from any
// component; the hook resolves both layers.
//
// The hash is a deterministic FNV-1a over the uid so the same user always
// gets the same bucket. No PII leaves the device.

import { useMemo } from 'react';
import { useAppSettingsStore } from '../store/useAppSettingsStore';
import { useAuthStore } from '../store/useAuthStore';

function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h;
}

export function bucketForUid(uid: string | null | undefined): number {
  if (!uid) return 0;
  return fnv1a(uid) % 100;
}

export function useFeatureFlag(key: string): boolean {
  const { settings } = useAppSettingsStore();
  const { user } = useAuthStore();
  return useMemo(() => {
    const on = settings.featureFlags?.[key] !== false; // default true if key absent
    if (!on) return false;
    const pct = settings.flagRollouts?.[key];
    if (typeof pct !== 'number') return true;
    if (pct >= 100) return true;
    if (pct <= 0) return false;
    return bucketForUid(user?.uid) < pct;
  }, [settings, user, key]);
}
