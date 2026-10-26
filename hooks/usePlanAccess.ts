import { Platform } from 'react-native';

import { isEntitlementActive } from '../services/billing';
import { usePlanStore, UpgradeReason } from '../store/usePlanStore';
import { GatedFeature, GatedLibrary, NO_LIMITS, PLAN_LIMITS, PlanId, PlanLimits } from '../lib/plans';

export interface PlanAccess {
  /** True when plan locks are switched on for this platform. */
  enforced: boolean;
  plan: PlanId;
  limits: PlanLimits;
  has: (feature: GatedFeature) => boolean;
  /** rank = item's position from lib/libraryTiers; Infinity-safe. */
  allowsItem: (library: GatedLibrary, rank: number | undefined) => boolean;
  upgrade: (reason: UpgradeReason) => void;
}

export function usePlanAccess(): PlanAccess {
  const settings = usePlanStore((s) => s.settings);
  const entitlement = usePlanStore((s) => s.entitlement);
  const openUpgrade = usePlanStore((s) => s.openUpgrade);

  const enforced = Platform.OS === 'web' ? settings.locksWeb : settings.locksApp;
  const plan: PlanId = isEntitlementActive(entitlement) ? entitlement.plan : 'free';
  const limits = enforced ? PLAN_LIMITS[plan] : NO_LIMITS;

  return {
    enforced,
    plan,
    limits,
    has: (feature) => limits.features.has(feature),
    allowsItem: (library, rank) => rank === undefined || rank < limits.library[library],
    upgrade: openUpgrade,
  };
}

/** Non-hook read for stores and services (e.g. addKid). */
export function currentPlanLimits(): PlanLimits {
  const { settings, entitlement } = usePlanStore.getState();
  const enforced = Platform.OS === 'web' ? settings.locksWeb : settings.locksApp;
  if (!enforced) return NO_LIMITS;
  return PLAN_LIMITS[isEntitlementActive(entitlement) ? entitlement.plan : 'free'];
}
