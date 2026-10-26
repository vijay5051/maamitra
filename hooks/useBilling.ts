import { BillingSettings, Entitlement, isEntitlementActive } from '../services/billing';
import { usePlanStore } from '../store/usePlanStore';

export function useBillingSettings(): BillingSettings {
  return usePlanStore((s) => s.settings);
}

export function useEntitlement(): { entitlement: Entitlement; isActive: boolean; loading: boolean } {
  const entitlement = usePlanStore((s) => s.entitlement);
  const loaded = usePlanStore((s) => s.entitlementLoaded);
  return { entitlement, isActive: isEntitlementActive(entitlement), loading: !loaded };
}
