import { useEffect, useState } from 'react';

import { useAuthStore } from '../store/useAuthStore';
import {
  BillingSettings,
  DEFAULT_BILLING_SETTINGS,
  Entitlement,
  FREE_ENTITLEMENT,
  isEntitlementActive,
  subscribeBillingSettings,
  subscribeEntitlement,
} from '../services/billing';

export function useBillingSettings(): BillingSettings {
  const [settings, setSettings] = useState<BillingSettings>(DEFAULT_BILLING_SETTINGS);
  useEffect(() => subscribeBillingSettings(setSettings), []);
  return settings;
}

export function useEntitlement(): { entitlement: Entitlement; isActive: boolean; loading: boolean } {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [loading, setLoading] = useState(!!uid);

  useEffect(() => {
    if (!uid) {
      setEntitlement(FREE_ENTITLEMENT);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeEntitlement(uid, (e) => {
      setEntitlement(e);
      setLoading(false);
    });
  }, [uid]);

  return { entitlement, isActive: isEntitlementActive(entitlement), loading };
}
