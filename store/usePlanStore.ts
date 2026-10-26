import { create } from 'zustand';
import type { Unsubscribe } from 'firebase/firestore';

import {
  BillingSettings,
  DEFAULT_BILLING_SETTINGS,
  Entitlement,
  FREE_ENTITLEMENT,
  subscribeBillingSettings,
  subscribeEntitlement,
} from '../services/billing';
import type { GatedFeature, GatedLibrary } from '../lib/plans';

export type UpgradeReason =
  | { kind: 'feature'; feature: GatedFeature }
  | { kind: 'library'; library: GatedLibrary }
  | { kind: 'children' }
  | { kind: 'aiQuestions' };

interface PlanState {
  settings: BillingSettings;
  entitlement: Entitlement;
  entitlementLoaded: boolean;
  upgradeReason: UpgradeReason | null;
  start: () => void;
  stop: () => void;
  watchUser: (uid: string | null) => void;
  openUpgrade: (reason: UpgradeReason) => void;
  closeUpgrade: () => void;
}

let settingsUnsub: Unsubscribe | null = null;
let entitlementUnsub: Unsubscribe | null = null;
let watchedUid: string | null = null;

export const usePlanStore = create<PlanState>((set) => ({
  settings: DEFAULT_BILLING_SETTINGS,
  entitlement: FREE_ENTITLEMENT,
  entitlementLoaded: false,
  upgradeReason: null,

  start: () => {
    if (settingsUnsub) return;
    settingsUnsub = subscribeBillingSettings((settings) => set({ settings }));
  },

  stop: () => {
    settingsUnsub?.();
    settingsUnsub = null;
    entitlementUnsub?.();
    entitlementUnsub = null;
    watchedUid = null;
  },

  watchUser: (uid) => {
    if (uid === watchedUid) return;
    entitlementUnsub?.();
    entitlementUnsub = null;
    watchedUid = uid;
    if (!uid) {
      set({ entitlement: FREE_ENTITLEMENT, entitlementLoaded: true });
      return;
    }
    set({ entitlementLoaded: false });
    entitlementUnsub = subscribeEntitlement(uid, (entitlement) => set({ entitlement, entitlementLoaded: true }));
  },

  openUpgrade: (reason) => set({ upgradeReason: reason }),
  closeUpgrade: () => set({ upgradeReason: null }),
}));
