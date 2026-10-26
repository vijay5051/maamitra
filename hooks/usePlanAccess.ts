import { Platform } from 'react-native';

import { isEntitlementActive } from '../services/billing';
import { usePlanStore, UpgradeReason } from '../store/usePlanStore';
import { earlyAccessUntil, GatedFeature, GatedLibrary, NO_LIMITS, PLAN_LIMITS, PlanId, PlanLimits } from '../lib/plans';

export interface PlanAccess {
  /** True when plan locks are switched on for this platform. */
  enforced: boolean;
  plan: PlanId;
  limits: PlanLimits;
  /** Set while this account is in its early-member free period (ms): everything is unlocked until then. */
  earlyAccessUntil: number | null;
  has: (feature: GatedFeature) => boolean;
  /** rank = item's position from lib/libraryTiers; Infinity-safe. */
  allowsItem: (library: GatedLibrary, rank: number | undefined) => boolean;
  upgrade: (reason: UpgradeReason) => void;
}

export function usePlanAccess(): PlanAccess {
  const settings = usePlanStore((s) => s.settings);
  const entitlement = usePlanStore((s) => s.entitlement);
  const openUpgrade = usePlanStore((s) => s.openUpgrade);
  const accountCreatedAt = usePlanStore((s) => s.accountCreatedAt);

  const enforced = Platform.OS === 'web' ? settings.locksWeb : settings.locksApp;
  const plan: PlanId = isEntitlementActive(entitlement) ? entitlement.plan : 'free';
  const early = activeEarlyAccess(settings, accountCreatedAt);
  const limits = !enforced ? NO_LIMITS : early !== null ? PLAN_LIMITS.family : PLAN_LIMITS[plan];

  return {
    enforced,
    plan,
    limits,
    earlyAccessUntil: early,
    has: (feature) => limits.features.has(feature),
    allowsItem: (library, rank) => rank === undefined || rank < limits.library[library],
    upgrade: openUpgrade,
  };
}

/** Non-hook read for stores and services (e.g. addKid). */
export function currentPlanLimits(): PlanLimits {
  const { settings, entitlement, accountCreatedAt } = usePlanStore.getState();
  const enforced = Platform.OS === 'web' ? settings.locksWeb : settings.locksApp;
  if (!enforced) return NO_LIMITS;
  if (activeEarlyAccess(settings, accountCreatedAt) !== null) return PLAN_LIMITS.family;
  return PLAN_LIMITS[isEntitlementActive(entitlement) ? entitlement.plan : 'free'];
}

/** End of this account's early-member free period if it is still running, else null. */
export function activeEarlyAccess(
  settings: { earlyAccessStart: number | null; earlyAccessDays: number },
  accountCreatedAt: number | null,
  now = Date.now(),
): number | null {
  const until = earlyAccessUntil(settings.earlyAccessStart, settings.earlyAccessDays, accountCreatedAt);
  return until !== null && until > now ? until : null;
}
