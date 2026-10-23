// Paid plan catalogue for the app. Keep prices in sync with functions/src/billing/plans.ts.

export type PlanId = 'free' | 'plus' | 'family';
export type PaidPlanId = Exclude<PlanId, 'free'>;
export type BillingInterval = 'monthly' | 'yearly';

// Rupees, GST included.
export const PLAN_PRICES: Record<PaidPlanId, Record<BillingInterval, number>> = {
  plus: { monthly: 149, yearly: 999 },
  family: { monthly: 249, yearly: 1799 },
};

export const FOUNDING_PLUS_YEARLY = 699;
export const FOUNDING_LIMIT = 1000;
export const TRIAL_DAYS = 7;

export const PLAN_NAMES: Record<PlanId, string> = {
  free: 'Free',
  plus: 'Plus',
  family: 'Family',
};
