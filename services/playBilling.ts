// Android in-app subscriptions through Google Play Billing (expo-iap).
//
// Google Play policy: digital subscriptions sold inside the Android app must use
// Play Billing, so the app never shows Razorpay. A plan bought here writes the
// same entitlements/{uid} doc as a website purchase (server: functions/src/
// billing/play.ts), so it works on the website too.
//
// Flow: buyOnPlay() opens Google's sheet → purchaseUpdatedListener receives the
// purchase → verifyPlayPurchase (server) checks it with Google, acknowledges it
// and writes the plan → finishTransaction. Purchases left unverified (app closed
// mid-way) are re-sent on the next launch from getAvailablePurchases().

import { Platform } from 'react-native';

import { callable } from './billing';
import { BillingInterval, PaidPlanId, PLAY_FOUNDING_BASE_PLAN, PLAY_PRODUCTS, PLAY_TRIAL_OFFER_ID } from '../lib/plans';

type ExpoIap = typeof import('expo-iap');
let iap: ExpoIap | null = null;
let connected: Promise<boolean> | null = null;
let listeners: Array<{ remove: () => void }> = [];
let pending: { resolve: () => void; reject: (e: Error) => void } | null = null;

function lib(): ExpoIap | null {
  if (Platform.OS !== 'android') return null;
  if (!iap) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      iap = require('expo-iap') as ExpoIap;
    } catch {
      return null; // build without the native module (older binary)
    }
  }
  return iap;
}

/**
 * True on Android builds that include the Play Billing module. App binaries
 * from before it was added still receive over-the-air updates, so they must
 * not show buy buttons that cannot work.
 */
export const playBillingSupported = lib() !== null;

export class PlayPurchaseCancelled extends Error {
  constructor() {
    super('Purchase cancelled');
  }
}

async function verifyAndFinish(purchase: any): Promise<void> {
  const m = lib();
  const token: string | undefined = purchase?.purchaseToken ?? purchase?.purchaseTokenAndroid ?? undefined;
  if (!m || !token) return;
  await callable<{ purchaseToken: string }, { plan: string }>('verifyPlayPurchase', { purchaseToken: token });
  await m.finishTransaction({ purchase, isConsumable: false });
}

/** Connect once per signed-in session and re-send any purchase not yet verified. */
export function startPlayBilling(): Promise<boolean> {
  const m = lib();
  if (!m) return Promise.resolve(false);
  if (connected) return connected;
  connected = (async () => {
    try {
      await m.initConnection();
    } catch (e) {
      console.warn('[play] initConnection failed', e);
      connected = null;
      return false;
    }
    listeners.push(
      m.purchaseUpdatedListener((purchase) => {
        verifyAndFinish(purchase)
          .then(() => pending?.resolve())
          .catch((e) => pending?.reject(e instanceof Error ? e : new Error(String(e))))
          .finally(() => {
            pending = null;
          });
      }),
      m.purchaseErrorListener((error) => {
        const cancelled = m.isUserCancelledError(error as any);
        pending?.reject(cancelled ? new PlayPurchaseCancelled() : new Error(m.getUserFriendlyErrorMessage(error as any) || 'Purchase failed.'));
        pending = null;
      }),
    );
    try {
      const owned = await m.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true } as any);
      for (const p of owned ?? []) {
        if ((p as any).isAcknowledgedAndroid === false) await verifyAndFinish(p).catch(() => {});
      }
    } catch {
      /* not fatal: the server also hears about renewals from Google */
    }
    return true;
  })();
  return connected;
}

export function stopPlayBilling(): void {
  const m = lib();
  listeners.forEach((l) => l.remove());
  listeners = [];
  pending = null;
  if (m && connected) void m.endConnection().catch(() => {});
  connected = null;
}

export interface PlayOption {
  plan: PaidPlanId;
  interval: BillingInterval;
  founding: boolean;
  /** Google's 7-day free trial applies (Plus, first time only). */
  trial: boolean;
  displayPrice: string;
  sku: string;
  offerToken: string;
}

/** Offers this Google account can buy right now, with Google's localised prices. */
export async function loadPlayOptions(): Promise<PlayOption[]> {
  const m = lib();
  if (!m || !(await startPlayBilling())) return [];
  const products = (await m.fetchProducts({ skus: Object.values(PLAY_PRODUCTS), type: 'subs' })) ?? [];
  const out: PlayOption[] = [];
  for (const product of products as any[]) {
    const plan = (Object.keys(PLAY_PRODUCTS) as PaidPlanId[]).find((p) => PLAY_PRODUCTS[p] === product.id);
    if (!plan) continue;
    const offers: any[] = product.subscriptionOffers ?? [];
    for (const basePlan of ['monthly', 'yearly', PLAY_FOUNDING_BASE_PLAN]) {
      const forBase = offers.filter((o) => o.basePlanIdAndroid === basePlan && o.offerTokenAndroid);
      if (forBase.length === 0) continue;
      // Google only returns offers this account is eligible for, so a "trial"
      // offer here means the trial is available. Otherwise use the base plan.
      const trialOffer = forBase.find((o) => o.id === PLAY_TRIAL_OFFER_ID);
      const baseOffer = forBase.find((o) => !o.id || o.id === basePlan) ?? forBase[0];
      const chosen = trialOffer ?? baseOffer;
      out.push({
        plan,
        interval: basePlan === 'monthly' ? 'monthly' : 'yearly',
        founding: basePlan === PLAY_FOUNDING_BASE_PLAN,
        trial: !!trialOffer,
        displayPrice: baseOffer.displayPrice ?? chosen.displayPrice,
        sku: product.id,
        offerToken: chosen.offerTokenAndroid,
      });
    }
  }
  return out;
}

/** Opens Google's purchase sheet. Resolves once the server has activated the plan. */
export async function buyOnPlay(option: PlayOption, uid: string): Promise<void> {
  const m = lib();
  if (!m || !(await startPlayBilling())) throw new Error('Google Play is not available on this device.');
  if (pending) throw new Error('A purchase is already in progress.');
  const done = new Promise<void>((resolve, reject) => {
    pending = { resolve, reject };
  });
  try {
    await m.requestPurchase({
      request: {
        google: {
          skus: [option.sku],
          subscriptionOffers: [{ sku: option.sku, offerToken: option.offerToken }],
          // Ties the purchase to this MaaMitra account; the server checks it.
          obfuscatedAccountId: uid,
        },
      },
      type: 'subs',
    } as any);
  } catch (e) {
    pending = null;
    throw m.isUserCancelledError(e as any) ? new PlayPurchaseCancelled() : e;
  }
  return done;
}

/** Google Play's own page to change or cancel a subscription. */
export async function openPlaySubscriptions(sku?: string): Promise<void> {
  const m = lib();
  if (!m) return;
  await m.deepLinkToSubscriptions({ skuAndroid: sku, packageNameAndroid: 'in.maamitra.app' } as any);
}
