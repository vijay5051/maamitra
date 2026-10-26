// Client side of paid plans. Purchases happen only on the website (Razorpay);
// the Android app must not sell or link to web purchases (Google Play policy),
// but it reads the same entitlement so a plan bought on the web works everywhere.

import { doc, onSnapshot, Timestamp, Unsubscribe } from 'firebase/firestore';

import { app, db } from './firebase';
import { EARLY_ACCESS_DAYS, type BillingInterval, type PaidPlanId, type PlanId } from '../lib/plans';

export interface BillingSettings {
  webCheckoutEnabled: boolean;
  trialEnabled: boolean;
  foundingOfferEnabled: boolean;
  foundingLimit: number;
  foundingCount: number;
  /** Plan locks on the website. Off unless app_settings/billing.locks.web is true. */
  locksWeb: boolean;
  /** Plan locks in the Android/iOS app. Keep off until in-app purchase exists. */
  locksApp: boolean;
  /** When plans went live (ms). Accounts created before it are early members. Null until locks are first turned on. */
  earlyAccessStart: number | null;
  earlyAccessDays: number;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  webCheckoutEnabled: false,
  trialEnabled: true,
  foundingOfferEnabled: true,
  foundingLimit: 1000,
  foundingCount: 0,
  locksWeb: false,
  locksApp: false,
  earlyAccessStart: null,
  earlyAccessDays: EARLY_ACCESS_DAYS,
};

export interface Entitlement {
  plan: PlanId;
  interval: BillingInterval | null;
  status: string | null;
  activeUntil: number | null;
  trialEndsAt: number | null;
  cancelAtPeriodEnd: boolean;
  founding: boolean;
  trialUsed: boolean;
  source: 'razorpay' | null;
  /** The subscription's first payment waits for the end of the early-member free period. */
  earlyAccessDeferred: boolean;
}

export const FREE_ENTITLEMENT: Entitlement = {
  plan: 'free',
  interval: null,
  status: null,
  activeUntil: null,
  trialEndsAt: null,
  cancelAtPeriodEnd: false,
  founding: false,
  trialUsed: false,
  source: null,
  earlyAccessDeferred: false,
};

const millis = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : null);

export function isEntitlementActive(e: Entitlement, now = Date.now()): boolean {
  return e.plan !== 'free' && e.activeUntil !== null && e.activeUntil > now;
}

export function subscribeBillingSettings(cb: (s: BillingSettings) => void): Unsubscribe {
  if (!db) {
    cb(DEFAULT_BILLING_SETTINGS);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'app_settings/billing'),
    (snap) => {
      const d = snap.data() ?? {};
      cb({
        webCheckoutEnabled: d.webCheckoutEnabled === true,
        trialEnabled: d.trialEnabled !== false,
        foundingOfferEnabled: d.foundingOffer?.enabled !== false,
        foundingLimit: typeof d.foundingOffer?.limit === 'number' ? d.foundingOffer.limit : DEFAULT_BILLING_SETTINGS.foundingLimit,
        foundingCount: typeof d.foundingCount === 'number' ? d.foundingCount : 0,
        locksWeb: d.locks?.web === true,
        locksApp: d.locks?.app === true,
        earlyAccessStart: millis(d.earlyAccess?.start),
        earlyAccessDays: typeof d.earlyAccess?.days === 'number' ? d.earlyAccess.days : EARLY_ACCESS_DAYS,
      });
    },
    () => cb(DEFAULT_BILLING_SETTINGS),
  );
}

export function subscribeEntitlement(uid: string, cb: (e: Entitlement) => void): Unsubscribe {
  if (!db) {
    cb(FREE_ENTITLEMENT);
    return () => {};
  }
  return onSnapshot(
    doc(db, 'entitlements', uid),
    (snap) => {
      const d = snap.data();
      if (!d) {
        cb(FREE_ENTITLEMENT);
        return;
      }
      cb({
        plan: d.plan === 'plus' || d.plan === 'family' ? d.plan : 'free',
        interval: d.interval === 'monthly' || d.interval === 'yearly' ? d.interval : null,
        status: typeof d.status === 'string' ? d.status : null,
        activeUntil: millis(d.activeUntil),
        trialEndsAt: millis(d.trialEndsAt),
        cancelAtPeriodEnd: d.cancelAtPeriodEnd === true,
        founding: d.founding === true,
        trialUsed: d.trialUsed === true,
        source: d.source === 'razorpay' ? 'razorpay' : null,
        earlyAccessDeferred: d.earlyAccessDeferred === true,
      });
    },
    () => cb(FREE_ENTITLEMENT),
  );
}

async function callable<In, Out>(name: string, data: In): Promise<Out> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fn = httpsCallable<In, Out>(getFunctions(app ?? undefined), name);
  return (await fn(data)).data;
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayCheckout(): Promise<any> {
  const w = globalThis as any;
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = CHECKOUT_SRC;
    el.async = true;
    el.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error('Razorpay checkout did not load.')));
    el.onerror = () => reject(new Error('Could not load Razorpay checkout. Check your connection and try again.'));
    document.head.appendChild(el);
  });
}

export class CheckoutDismissed extends Error {
  constructor() {
    super('Checkout closed');
  }
}

export interface CheckoutOptions {
  plan: PaidPlanId;
  interval: BillingInterval;
  founding: boolean;
  prefill: { name?: string; email?: string; contact?: string };
  description: string;
}

/** Web only. Resolves after the customer completes payment authorisation in Razorpay checkout. */
export async function startWebCheckout(opts: CheckoutOptions): Promise<{ subscriptionId: string }> {
  const [Razorpay, created] = await Promise.all([
    loadRazorpayCheckout(),
    callable<
      { plan: PaidPlanId; interval: BillingInterval; founding: boolean },
      { subscriptionId: string; keyId: string }
    >('createRazorpaySubscription', { plan: opts.plan, interval: opts.interval, founding: opts.founding }),
  ]);

  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: created.keyId,
      subscription_id: created.subscriptionId,
      name: 'MaaMitra',
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: '#7B5E9C' },
      handler: () => resolve({ subscriptionId: created.subscriptionId }),
      modal: { ondismiss: () => reject(new CheckoutDismissed()) },
    });
    rzp.on('payment.failed', (resp: any) => {
      reject(new Error(resp?.error?.description ?? 'Payment failed. You have not been charged.'));
    });
    rzp.open();
  });
}

export async function cancelWebSubscription(): Promise<{ activeUntil: number | null }> {
  return callable<Record<string, never>, { ok: boolean; activeUntil: number | null }>('cancelRazorpaySubscription', {});
}
