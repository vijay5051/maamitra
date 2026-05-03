// Live-subscribed runtime configuration store. One subscription, shared
// across the entire app — every screen that needs to read a flag pulls
// from here instead of opening its own onSnapshot.
//
// Bootstrapped from `app/_layout.tsx`. Do not call `subscribe()` from
// individual screens.

import { create } from 'zustand';

import {
  defaultRuntimeConfig,
  isFeatureEnabled,
  FeatureKey,
  FlagEvalContext,
  RuntimeConfig,
  subscribeRuntimeConfig,
} from '../services/featureFlags';

interface RuntimeConfigState {
  config: RuntimeConfig;
  /** True once the first onSnapshot callback has fired. */
  ready: boolean;
  _unsub: (() => void) | null;
  subscribe: () => void;
  unsubscribe: () => void;
  isFeatureEnabled: (key: FeatureKey, ctx: FlagEvalContext) => boolean;
}

export const useRuntimeConfigStore = create<RuntimeConfigState>((set, get) => ({
  config: defaultRuntimeConfig(),
  ready: false,
  _unsub: null,
  subscribe: () => {
    if (get()._unsub) return; // idempotent
    const unsub = subscribeRuntimeConfig((cfg) => {
      set({ config: cfg, ready: true });
    });
    set({ _unsub: unsub });
  },
  unsubscribe: () => {
    const u = get()._unsub;
    if (u) u();
    set({ _unsub: null });
  },
  isFeatureEnabled: (key, ctx) => isFeatureEnabled(get().config, key, ctx),
}));
