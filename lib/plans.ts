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

// Paid-only features (unlocked by Plus and Family).
export type GatedFeature =
  | 'photoQuestions'
  | 'readAloud'
  | 'vaccineReminders'
  | 'vaccinePdf'
  | 'fullMilestones'
  | 'journey'
  | 'mealPlannerHistory'
  | 'travelPack';

// Content libraries with per-plan item counts.
export type GatedLibrary = 'tiffin' | 'travel' | 'nuskhe' | 'yoga';

export interface PlanLimits {
  aiQuestionsPerDay: number;
  children: number;
  library: Record<GatedLibrary, number>;
  features: ReadonlySet<GatedFeature>;
}

const ALL_FEATURES: ReadonlySet<GatedFeature> = new Set<GatedFeature>([
  'photoQuestions',
  'readAloud',
  'vaccineReminders',
  'vaccinePdf',
  'fullMilestones',
  'journey',
  'mealPlannerHistory',
  'travelPack',
]);

// "Unlimited" AI on Family is fair use; 200 a day is far above normal personal use.
export const FAMILY_FAIR_USE_AI_PER_DAY = 200;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    aiQuestionsPerDay: 5,
    children: 1,
    library: { tiffin: 16, travel: 10, nuskhe: 10, yoga: 3 },
    features: new Set<GatedFeature>(),
  },
  plus: {
    aiQuestionsPerDay: 40,
    children: 2,
    library: { tiffin: 40, travel: 25, nuskhe: 25, yoga: Infinity },
    features: ALL_FEATURES,
  },
  family: {
    aiQuestionsPerDay: FAMILY_FAIR_USE_AI_PER_DAY,
    children: Infinity,
    library: { tiffin: Infinity, travel: Infinity, nuskhe: Infinity, yoga: Infinity },
    features: ALL_FEATURES,
  },
};

// Used while plan locks are off: nothing is limited on the client.
export const NO_LIMITS: PlanLimits = { ...PLAN_LIMITS.family, aiQuestionsPerDay: Infinity };

const PAID_ORDER: PaidPlanId[] = ['plus', 'family'];

/** Cheapest paid plan whose limits satisfy the check, or null if none does. */
export function cheapestPlanWhere(ok: (limits: PlanLimits) => boolean): PaidPlanId | null {
  return PAID_ORDER.find((p) => ok(PLAN_LIMITS[p])) ?? null;
}

/**
 * Ranks items so the first N are a fair spread across groups (age bands,
 * categories) rather than the first N of one group. Stable for a given array.
 */
export function rankRoundRobin<T>(items: readonly T[], id: (t: T) => string, group: (t: T) => string): Map<string, number> {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const g = group(it);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(it);
  }
  const buckets = [...groups.values()];
  const rank = new Map<string, number>();
  let r = 0;
  for (let i = 0; rank.size < items.length; i++) {
    for (const b of buckets) {
      if (i < b.length) rank.set(id(b[i]), r++);
    }
  }
  return rank;
}
