// Library AI — client service shim.
//
// Wraps the Cloud Function callables and Firestore reads used by the admin
// /admin/library-ai page and the Library tab. All Firestore reads obey the
// existing rules (articles/books/products are readable when status !=
// 'draft', writes are admin-only).

import {
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

import { app, db } from './firebase';
import { logAdminAction } from './audit';

// ── Settings shape (mirrors functions/src/library/settings.ts) ─────────────

export type AgeBucketKey = 'pregnancy' | 'newborn' | 'infant' | 'toddler' | 'preschool';

export interface AgeBucket {
  key: AgeBucketKey;
  label: string;
  ageMin: number;
  ageMax: number;
}

export const DEFAULT_AGE_BUCKETS: AgeBucket[] = [
  { key: 'pregnancy', label: 'Pregnancy',     ageMin: -9, ageMax: 0 },
  { key: 'newborn',   label: 'Newborn (0-3m)', ageMin: 0,  ageMax: 3 },
  { key: 'infant',    label: 'Infant (3-12m)', ageMin: 3,  ageMax: 12 },
  { key: 'toddler',   label: 'Toddler (1-3y)', ageMin: 12, ageMax: 36 },
  { key: 'preschool', label: 'Preschool (3-5y)', ageMin: 36, ageMax: 60 },
];

export type Frequency = 'daily' | 'biweekly' | 'weekly' | 'monthly' | 'off';
export const FREQUENCIES: Frequency[] = ['off', 'monthly', 'weekly', 'biweekly', 'daily'];
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  off: 'Off',
  monthly: 'Monthly (1st of month)',
  weekly: 'Weekly (Sundays)',
  biweekly: 'Bi-weekly (Sun + Wed)',
  daily: 'Daily',
};

export interface KindSettings {
  enabled: boolean;
  frequency: Frequency;
  perRun: number;
  autoPublish: boolean;
  expireAfterDays: number;
  topics: string[];
  ageBuckets: AgeBucket[];
  tone: string;
}

export interface LibraryAiSettings {
  paused: boolean;
  articles: KindSettings;
  books: KindSettings;
  products: KindSettings;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

const DEFAULT_ARTICLE_TOPICS = [
  'Feeding & Weaning', 'Sleep', 'Pregnancy Wellness', 'Postpartum Recovery',
  'Newborn Care', 'Infant Development', 'Toddler Behaviour',
  'Indian Home Remedies', 'Vaccinations & Health', 'Mental Health for Mothers',
  'Working Mom Tips', 'Indian Festivals & Babies', 'Nutrition for Toddlers',
  'Baby-Proofing Your Home', 'First Foods (Indian Recipes)',
];
const DEFAULT_BOOK_TOPICS = [
  'Pregnancy in India', 'Breastfeeding', 'Newborn care',
  'Indian baby food recipes', 'Toddler discipline', 'Maternal mental health',
  'Sleep training gentle methods', 'Indian parenting',
  'Yoga for pregnancy', 'First-year development',
];
const DEFAULT_PRODUCT_TOPICS = [
  'Feeding', 'Skincare', 'Sleep', 'Development', 'Mother', 'Toddler',
  'Bath & hygiene', 'Diapering', 'Babyproofing',
];

export const DEFAULT_LIBRARY_AI: LibraryAiSettings = {
  paused: false,
  articles: {
    enabled: false, frequency: 'biweekly', perRun: 2, autoPublish: true,
    expireAfterDays: 90, topics: DEFAULT_ARTICLE_TOPICS, ageBuckets: DEFAULT_AGE_BUCKETS,
    tone: 'Warm, evidence-based, judgement-free, written for Indian mothers. Mix English with light Hinglish where natural. Never preachy.',
  },
  books: {
    enabled: false, frequency: 'monthly', perRun: 3, autoPublish: true,
    expireAfterDays: 0, topics: DEFAULT_BOOK_TOPICS, ageBuckets: DEFAULT_AGE_BUCKETS,
    tone: 'Curate authoritative, well-reviewed books that an Indian mother would actually buy. Prefer Kindle availability.',
  },
  products: {
    enabled: false, frequency: 'weekly', perRun: 3, autoPublish: true,
    expireAfterDays: 60, topics: DEFAULT_PRODUCT_TOPICS, ageBuckets: DEFAULT_AGE_BUCKETS,
    tone: 'Recommend specific, well-known brand-name products available on Amazon.in / Flipkart. Indian-priced.',
  },
};

// ── Settings I/O ────────────────────────────────────────────────────────────

const SETTINGS_PATH = ['app_settings', 'libraryAi'] as const;

export function subscribeLibraryAiSettings(cb: (s: LibraryAiSettings) => void): () => void {
  if (!db) {
    cb(DEFAULT_LIBRARY_AI);
    return () => {};
  }
  return onSnapshot(
    doc(db, SETTINGS_PATH[0], SETTINGS_PATH[1]),
    (snap) => {
      if (!snap.exists()) {
        cb(DEFAULT_LIBRARY_AI);
        return;
      }
      cb(mergeDefaults(snap.data() as Record<string, any>));
    },
    () => cb(DEFAULT_LIBRARY_AI),
  );
}

export async function updateLibraryAiSettings(
  actor: { uid: string; email: string | null | undefined },
  patch: Partial<LibraryAiSettings>,
): Promise<void> {
  if (!db) throw new Error('Firestore not ready');
  await setDoc(
    doc(db, SETTINGS_PATH[0], SETTINGS_PATH[1]),
    {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: actor.email ?? actor.uid,
    },
    { merge: true },
  );
  await logAdminAction(actor, 'library_ai.settings.update', { label: Object.keys(patch).join(',') });
}

function mergeDefaults(d: Record<string, any>): LibraryAiSettings {
  const merge = (base: KindSettings, over: any): KindSettings => {
    if (!over || typeof over !== 'object') return base;
    return {
      enabled: typeof over.enabled === 'boolean' ? over.enabled : base.enabled,
      frequency: FREQUENCIES.includes(over.frequency) ? over.frequency : base.frequency,
      perRun: clamp(over.perRun, 1, 10, base.perRun),
      autoPublish: typeof over.autoPublish === 'boolean' ? over.autoPublish : base.autoPublish,
      expireAfterDays: clamp(over.expireAfterDays, 0, 365, base.expireAfterDays),
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
    paused: typeof d.paused === 'boolean' ? d.paused : false,
    articles: merge(DEFAULT_LIBRARY_AI.articles, d.articles),
    books: merge(DEFAULT_LIBRARY_AI.books, d.books),
    products: merge(DEFAULT_LIBRARY_AI.products, d.products),
    updatedAt: d.updatedAt,
    updatedBy: typeof d.updatedBy === 'string' ? d.updatedBy : undefined,
  };
}

function isAgeBucket(v: any): v is AgeBucket {
  return v && typeof v === 'object'
    && typeof v.key === 'string' && typeof v.label === 'string'
    && typeof v.ageMin === 'number' && typeof v.ageMax === 'number';
}

function clamp(v: any, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? Math.round(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

// ── Callables ───────────────────────────────────────────────────────────────

export interface GenArticleInput {
  topic?: string;
  ageBucketKey?: AgeBucketKey;
  imageModel?: 'imagen' | 'flux' | 'dalle' | 'pexels' | 'none';
  publish?: 'published' | 'draft';
}
export interface GenArticleOk {
  ok: true;
  articleId: string;
  title: string;
  topic: string;
  ageBucketKey: string;
  imageUrl: string | null;
  imageSource: string;
  status: 'published' | 'draft';
  costInr: number;
  flags: { type: string; phrase: string }[];
}
export interface GenErr { ok: false; code: string; message: string }

export async function generateArticleNow(input: GenArticleInput = {}): Promise<GenArticleOk | GenErr> {
  if (!app) return { ok: false, code: 'no-app', message: 'Firebase not configured' };
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'us-central1');
  const call = httpsCallable<GenArticleInput, GenArticleOk | GenErr>(fns, 'generateArticleNow');
  const r = await call(input);
  return r.data;
}

export interface GenBooksInput {
  topic?: string;
  ageBucketKey?: AgeBucketKey;
  count?: number;
  publish?: 'published' | 'draft';
}
export interface GenBooksOk {
  ok: true;
  inserted: { id: string; title: string; author: string; status: 'published' | 'draft'; url: string }[];
  skipped: { reason: string; title?: string }[];
  costInr: number;
}

export async function generateBooksNow(input: GenBooksInput = {}): Promise<GenBooksOk | GenErr> {
  if (!app) return { ok: false, code: 'no-app', message: 'Firebase not configured' };
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'us-central1');
  const call = httpsCallable<GenBooksInput, GenBooksOk | GenErr>(fns, 'generateBooksNow');
  const r = await call(input);
  return r.data;
}

export interface GenProductsInput {
  category?: string;
  ageBucketKey?: AgeBucketKey;
  count?: number;
  publish?: 'published' | 'draft';
  imageModel?: 'imagen' | 'flux' | 'pexels' | 'none';
  preferredStore?: 'amazon' | 'flipkart' | 'both';
}
export interface GenProductsOk {
  ok: true;
  inserted: { id: string; name: string; status: 'published' | 'draft'; url: string }[];
  skipped: { reason: string; name?: string }[];
  costInr: number;
}

export async function generateProductsNow(input: GenProductsInput = {}): Promise<GenProductsOk | GenErr> {
  if (!app) return { ok: false, code: 'no-app', message: 'Firebase not configured' };
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'us-central1');
  const call = httpsCallable<GenProductsInput, GenProductsOk | GenErr>(fns, 'generateProductsNow');
  const r = await call(input);
  return r.data;
}

export async function archiveLibraryItem(kind: 'articles' | 'books' | 'products', id: string): Promise<{ ok: boolean }> {
  if (!app) throw new Error('Firebase not configured');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const fns = getFunctions(app, 'us-central1');
  const call = httpsCallable<{ kind: string; id: string }, { ok: boolean }>(fns, 'archiveLibraryItem');
  const r = await call({ kind, id });
  return r.data;
}

// ── All library items (unified content library) ──────────────────────────────

/** Full doc shape returned by subscribeAllLibraryItems.
 *  `raw` contains the complete Firestore doc so the form modal can show every
 *  field without a second round-trip. */
export interface LibraryContentItem {
  id: string;
  kind: 'articles' | 'books' | 'products';
  title: string;
  topic: string;
  ageMin: number;
  ageMax: number;
  status: 'published' | 'draft' | 'archived';
  imageUrl: string | null;
  url: string | null;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  source: 'ai' | 'manual';
  flags: string[];
  raw: Record<string, any>; // full doc data for editing
}

export function subscribeAllLibraryItems(
  kind: 'articles' | 'books' | 'products',
  cb: (rows: LibraryContentItem[]) => void,
  limitN = 100,
): () => void {
  if (!db) { cb([]); return () => {}; }
  const q = query(
    collection(db, kind),
    orderBy('createdAt', 'desc'),
    fbLimit(limitN),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: LibraryContentItem[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const titleField = kind === 'products' ? 'name' : 'title';
        return {
          id: d.id,
          kind,
          title: typeof data[titleField] === 'string' ? data[titleField] : '(untitled)',
          topic: data.topic ?? data.category ?? data.aiTopic ?? '',
          ageMin: typeof data.ageMin === 'number' ? data.ageMin
            : typeof data.ageMinMonths === 'number' ? data.ageMinMonths : 0,
          ageMax: typeof data.ageMax === 'number' ? data.ageMax
            : typeof data.ageMaxMonths === 'number' ? data.ageMaxMonths : 999,
          status: data.status === 'archived' ? 'archived'
            : data.status === 'draft' ? 'draft' : 'published',
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
          url: typeof data.url === 'string' ? data.url : null,
          createdAt: data.createdAt ?? null,
          expiresAt: data.expiresAt ?? null,
          source: data.source === 'manual' ? 'manual' : 'ai',
          flags: Array.isArray(data.aiFlags)
            ? data.aiFlags.filter((f: any) => typeof f === 'string') : [],
          raw: { ...data, id: d.id },
        };
      });
      cb(rows);
    },
    () => cb([]),
  );
}

// ── Recent AI items (for the admin queue) ───────────────────────────────────

export interface AiItem {
  id: string;
  kind: 'articles' | 'books' | 'products';
  title: string;       // article.title / book.title / product.name
  topic: string;
  ageMin: number;
  ageMax: number;
  status: 'published' | 'draft' | 'archived';
  imageUrl: string | null;
  url: string | null;
  createdAt: Timestamp | null;
  expiresAt: Timestamp | null;
  flags: string[];
  source: 'ai' | 'manual';
}

export function subscribeRecentAiItems(
  kind: 'articles' | 'books' | 'products',
  cb: (rows: AiItem[]) => void,
  limitN: number = 30,
): () => void {
  if (!db) {
    cb([]);
    return () => {};
  }
  const q = query(
    collection(db, kind),
    where('source', '==', 'ai'),
    orderBy('createdAt', 'desc'),
    fbLimit(limitN),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows: AiItem[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const titleField = kind === 'products' ? 'name' : 'title';
        return {
          id: d.id,
          kind,
          title: typeof data[titleField] === 'string' ? data[titleField] : '(untitled)',
          topic: data.topic ?? data.category ?? data.aiTopic ?? '',
          ageMin: typeof data.ageMin === 'number' ? data.ageMin : (typeof data.ageMinMonths === 'number' ? data.ageMinMonths : 0),
          ageMax: typeof data.ageMax === 'number' ? data.ageMax : (typeof data.ageMaxMonths === 'number' ? data.ageMaxMonths : 999),
          status: data.status === 'archived' ? 'archived' : data.status === 'draft' ? 'draft' : 'published',
          imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : null,
          url: typeof data.url === 'string' ? data.url : null,
          createdAt: data.createdAt ?? null,
          expiresAt: data.expiresAt ?? null,
          flags: Array.isArray(data.aiFlags) ? data.aiFlags.filter((f: any) => typeof f === 'string') : [],
          source: data.source === 'manual' ? 'manual' : 'ai',
        };
      });
      cb(rows);
    },
    () => cb([]),
  );
}

// ── Library AI run history (admin dashboard) ────────────────────────────────

export interface AiRunRow {
  id: string;
  ts: Timestamp | null;
  kindSummary: Record<string, any>;
}

export async function listRecentRuns(limitN = 20): Promise<AiRunRow[]> {
  if (!db) return [];
  const q = query(collection(db, 'library_ai_runs'), orderBy('ts', 'desc'), fbLimit(limitN));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const { ts, ...rest } = d.data() as any;
    return { id: d.id, ts: ts ?? null, kindSummary: rest };
  });
}
