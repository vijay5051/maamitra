// Library AI settings — single Firestore doc at app_settings/libraryAi.
//
// Drives autopilot for Articles / Books / Products in the Library tab.
// Admin edits this from /admin/library-ai. The cron + callables read it
// at request time (no in-memory cache — admin toggles must take effect
// instantly).

import * as admin from 'firebase-admin';

// ── Per-kind shape ──────────────────────────────────────────────────────────

export type AgeBucketKey = 'pregnancy' | 'newborn' | 'infant' | 'toddler' | 'preschool';

export interface AgeBucket {
  key: AgeBucketKey;
  label: string;
  ageMin: number; // months; -9 = pregnancy
  ageMax: number; // months; 999 = always
}

export const DEFAULT_AGE_BUCKETS: AgeBucket[] = [
  { key: 'pregnancy', label: 'Pregnancy',     ageMin: -9, ageMax: 0 },
  { key: 'newborn',   label: 'Newborn (0-3m)', ageMin: 0,  ageMax: 3 },
  { key: 'infant',    label: 'Infant (3-12m)', ageMin: 3,  ageMax: 12 },
  { key: 'toddler',   label: 'Toddler (1-3y)', ageMin: 12, ageMax: 36 },
  { key: 'preschool', label: 'Preschool (3-5y)', ageMin: 36, ageMax: 60 },
];

export type Frequency = 'daily' | 'biweekly' | 'weekly' | 'monthly' | 'off';

/** Days of the IST week the cron should fire. Based on `frequency`:
 *    daily    → every weekday key (0-6, Sunday=0)
 *    biweekly → Sunday(0) + Wednesday(3)
 *    weekly   → Sunday(0)
 *    monthly  → 1st of month (handled separately)
 *    off      → never
 */
export function frequencyToWeekdays(f: Frequency): number[] {
  switch (f) {
    case 'daily':    return [0, 1, 2, 3, 4, 5, 6];
    case 'biweekly': return [0, 3];
    case 'weekly':   return [0];
    case 'monthly':  return [1]; // run on 1st of month, pubsub handler checks DOM
    case 'off':
    default:         return [];
  }
}

export interface KindSettings {
  enabled: boolean;
  frequency: Frequency;
  /** How many fresh items the cron generates per run (split across age buckets). */
  perRun: number;
  /** If true, AI items go straight to status='published'; else 'draft'. */
  autoPublish: boolean;
  /** Days after which an AI-generated item flips from 'published' → 'archived'. 0 = never expire. */
  expireAfterDays: number;
  /** Topic / category catalog the LLM picks from. */
  topics: string[];
  /** Age buckets to rotate through. Defaults to DEFAULT_AGE_BUCKETS. */
  ageBuckets: AgeBucket[];
  /** Tone / style profile for the writer. */
  tone: string;
}

export interface LibraryAiSettings {
  articles: KindSettings;
  books: KindSettings;
  products: KindSettings;
  /** Optional global pause (mirrors marketing.crisisPaused). */
  paused: boolean;
  updatedAt?: FirebaseFirestore.Timestamp;
  updatedBy?: string;
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_ARTICLE_TOPICS = [
  'Feeding & Weaning',
  'Sleep',
  'Pregnancy Wellness',
  'Postpartum Recovery',
  'Newborn Care',
  'Infant Development',
  'Toddler Behaviour',
  'Indian Home Remedies',
  'Vaccinations & Health',
  'Mental Health for Mothers',
  'Working Mom Tips',
  'Indian Festivals & Babies',
  'Nutrition for Toddlers',
  'Baby-Proofing Your Home',
  'First Foods (Indian Recipes)',
];

const DEFAULT_BOOK_TOPICS = [
  'Pregnancy in India',
  'Breastfeeding',
  'Newborn care',
  'Indian baby food recipes',
  'Toddler discipline',
  'Maternal mental health',
  'Sleep training gentle methods',
  'Indian parenting',
  'Yoga for pregnancy',
  'First-year development',
];

const DEFAULT_PRODUCT_TOPICS = [
  'Feeding',
  'Skincare',
  'Sleep',
  'Development',
  'Mother',
  'Toddler',
  'Bath & hygiene',
  'Diapering',
  'Babyproofing',
];

export const DEFAULT_LIBRARY_AI: LibraryAiSettings = {
  paused: false,
  articles: {
    enabled: false,                    // opt-in
    frequency: 'biweekly',
    perRun: 2,
    autoPublish: true,
    expireAfterDays: 90,
    topics: DEFAULT_ARTICLE_TOPICS,
    ageBuckets: DEFAULT_AGE_BUCKETS,
    tone: 'Warm, evidence-based, judgement-free, written for Indian mothers. Mix English with light Hinglish where natural. Never preachy.',
  },
  books: {
    enabled: false,
    frequency: 'monthly',
    perRun: 3,
    autoPublish: true,
    expireAfterDays: 0, // books don't expire — they're timeless
    topics: DEFAULT_BOOK_TOPICS,
    ageBuckets: DEFAULT_AGE_BUCKETS,
    tone: 'Curate authoritative, well-reviewed books that an Indian mother would actually buy. Prefer Kindle availability.',
  },
  products: {
    enabled: false,
    frequency: 'weekly',
    perRun: 3,
    autoPublish: true,
    expireAfterDays: 60, // pricing/availability drifts faster
    topics: DEFAULT_PRODUCT_TOPICS,
    ageBuckets: DEFAULT_AGE_BUCKETS,
    tone: 'Recommend specific, well-known brand-name products available on Amazon.in / Flipkart. Indian-priced.',
  },
};

// ── Loader ──────────────────────────────────────────────────────────────────

export async function loadLibraryAiSettings(): Promise<LibraryAiSettings> {
  try {
    const snap = await admin.firestore().doc('app_settings/libraryAi').get();
    if (!snap.exists) return DEFAULT_LIBRARY_AI;
    const d = snap.data() as Record<string, any>;
    return mergeDefaults(d);
  } catch (e) {
    console.warn('[libraryAi.settings] load failed, using defaults', e);
    return DEFAULT_LIBRARY_AI;
  }
}

function mergeDefaults(d: Record<string, any>): LibraryAiSettings {
  const merge = (base: KindSettings, over: any): KindSettings => {
    if (!over || typeof over !== 'object') return base;
    return {
      enabled: typeof over.enabled === 'boolean' ? over.enabled : base.enabled,
      frequency: isFrequency(over.frequency) ? over.frequency : base.frequency,
      perRun: clampInt(over.perRun, 1, 10, base.perRun),
      autoPublish: typeof over.autoPublish === 'boolean' ? over.autoPublish : base.autoPublish,
      expireAfterDays: clampInt(over.expireAfterDays, 0, 365, base.expireAfterDays),
      topics: Array.isArray(over.topics) && over.topics.length > 0
        ? over.topics.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 50)
        : base.topics,
      ageBuckets: Array.isArray(over.ageBuckets) && over.ageBuckets.length > 0
        ? over.ageBuckets.filter(isAgeBucket).slice(0, 10)
        : base.ageBuckets,
      tone: typeof over.tone === 'string' && over.tone.trim() ? over.tone : base.tone,
    };
  };
  return {
    paused: typeof d.paused === 'boolean' ? d.paused : DEFAULT_LIBRARY_AI.paused,
    articles: merge(DEFAULT_LIBRARY_AI.articles, d.articles),
    books: merge(DEFAULT_LIBRARY_AI.books, d.books),
    products: merge(DEFAULT_LIBRARY_AI.products, d.products),
    updatedAt: d.updatedAt,
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
  };
}

function isFrequency(v: any): v is Frequency {
  return v === 'daily' || v === 'biweekly' || v === 'weekly' || v === 'monthly' || v === 'off';
}

function isAgeBucket(v: any): v is AgeBucket {
  return v && typeof v === 'object'
    && typeof v.key === 'string'
    && typeof v.label === 'string'
    && typeof v.ageMin === 'number'
    && typeof v.ageMax === 'number';
}

function clampInt(v: any, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? Math.round(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

// ── IST helpers ─────────────────────────────────────────────────────────────

export function nowInIst(): { weekday: number; dayOfMonth: number; isoDate: string } {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return {
    weekday: ist.getUTCDay(),
    dayOfMonth: ist.getUTCDate(),
    isoDate: ist.toISOString().slice(0, 10),
  };
}

/** Returns true if `frequency` says "fire today". */
export function shouldFireToday(f: Frequency, today: { weekday: number; dayOfMonth: number }): boolean {
  if (f === 'off') return false;
  if (f === 'monthly') return today.dayOfMonth === 1;
  return frequencyToWeekdays(f).includes(today.weekday);
}
