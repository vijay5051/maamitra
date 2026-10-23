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
