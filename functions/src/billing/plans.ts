// Paid plan catalogue for the server. Keep in sync with lib/plans.ts in the app.

export type PaidPlanId = 'plus' | 'family';
export type BillingInterval = 'monthly' | 'yearly';

// Amounts in paise, GST included.
export const PLAN_PRICES: Record<PaidPlanId, Record<BillingInterval, number>> = {
  plus: { monthly: 14900, yearly: 99900 },
  family: { monthly: 24900, yearly: 179900 },
};

export const FOUNDING_PLUS_YEARLY = 69900;
export const DEFAULT_FOUNDING_LIMIT = 1000;
export const TRIAL_DAYS = 7;

export const PLAN_LABELS: Record<PaidPlanId, string> = {
  plus: 'MaaMitra Plus',
  family: 'MaaMitra Family',
};

export function isPaidPlan(v: unknown): v is PaidPlanId {
  return v === 'plus' || v === 'family';
}

export function isInterval(v: unknown): v is BillingInterval {
  return v === 'monthly' || v === 'yearly';
}

// ─── Google Play (Android in-app) ─────────────────────────────────────
// Create these in Play Console → Monetize → Subscriptions. Keep in sync with
// lib/plans.ts PLAY_PRODUCTS in the app.
export const PLAY_PACKAGE_NAME = 'in.maamitra.app';
export const PLAY_PRODUCT_IDS: Record<PaidPlanId, string> = {
  plus: 'maamitra_plus',
  family: 'maamitra_family',
};
// Base plans on each product. "founding" exists on maamitra_plus only (₹699/yr).
export const PLAY_BASE_PLANS = { monthly: 'monthly', yearly: 'yearly', founding: 'founding' } as const;
// Free-trial offer id on the Plus base plans (7 days, new customers only).
export const PLAY_TRIAL_OFFER_ID = 'trial';
